import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import {
  NotificationStatus,
  PLATFORM_ORG_SLUG,
  UserRole,
  isPlatformOrgSlug,
  parseReminderOffsetsJson,
} from '@pkg/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugifyName, uniqueOrganizationSlug } from '../common/slug.util';
import { buildTenantBookingRootUrl } from '../common/booking-link.util';
import { EmailService } from '../notifications/email.service';
import { emailVerificationEmail } from '../notifications/templates';
import { SignupBusinessDto } from './dto/signup-business.dto';
import { UpdatePlatformOrganizationDto } from './dto/update-platform-organization.dto';

const DEFAULT_REMINDER_OFFSETS = '[1440,120,60,30]';
const RESET_TRANSACTION_TIMEOUT_MS = 60_000;
const RESET_TRANSACTION_MAX_WAIT_MS = 10_000;

type PlatformScopeQuery = {
  search?: string;
  status?: string;
  orgId?: string;
};

type PlatformNotificationsQuery = PlatformScopeQuery & {
  deliveryStatus?: string;
  channel?: string;
  q?: string;
  limit?: number;
};

type TableExistsRow = {
  table_exists: bigint | number | string;
};

@Injectable()
export class PlatformService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  private async databaseTableExists(tableName: string) {
    const rows = await this.prisma.$queryRaw<TableExistsRow[]>`
      SELECT COUNT(*) AS table_exists
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ${tableName}
    `;

    return Number(rows[0]?.table_exists ?? 0) > 0;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private bookingUrlForOrg(slug: string) {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    return buildTenantBookingRootUrl(webUrl, slug);
  }

  private verificationUrl(token: string, email: string): string {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3002';
    const url = new URL('/verify-email', webUrl);
    url.searchParams.set('token', token);
    url.searchParams.set('email', email);
    url.searchParams.set('role', UserRole.ORG_ADMIN);
    return url.toString();
  }

  private tenantWhere(scope?: PlatformScopeQuery) {
    const search = scope?.search?.trim();
    const status = scope?.status?.trim().toLowerCase();
    const and: Record<string, unknown>[] = [];

    if (scope?.orgId?.trim()) {
      and.push({ id: scope.orgId.trim() });
    }

    if (search) {
      and.push({
        OR: [{ name: { contains: search } }, { slug: { contains: search } }],
      });
    }

    if (status === 'active') {
      and.push({ isActive: true });
    } else if (status === 'suspended') {
      and.push({ isActive: false });
    } else if (status === 'trial') {
      and.push({
        isActive: true,
        OR: [{ subscriptionPlan: 'free' }, { subscriptionStatus: { not: 'active' } }],
      });
    }

    return {
      slug: { not: PLATFORM_ORG_SLUG },
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }

  async signupBusiness(dto: SignupBusinessDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const baseSlug = slugifyName(dto.companyName);
    if (isPlatformOrgSlug(baseSlug)) {
      throw new BadRequestException('Choose a different company name');
    }
    const slug = await uniqueOrganizationSlug(this.prisma, baseSlug);
    const timezone = dto.timezone?.trim() || 'Asia/Dubai';
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const verifyToken = randomBytes(32).toString('hex');
    const verifyHash = this.hashToken(verifyToken);
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.companyName.trim(),
          slug,
          bookingCurrency: 'aed',
          isActive: false,
        },
      });

      await tx.location.create({
        data: {
          organizationId: organization.id,
          name: 'Main Office',
          timezone,
          reminderOffsetsMinutes: DEFAULT_REMINDER_OFFSETS,
        },
      });

      await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          passwordHash,
          name: dto.adminName.trim(),
          role: UserRole.ORG_ADMIN,
          emailVerified: false,
          emailVerifyToken: verifyHash,
          emailVerifyTokenExpires: verifyExpires,
        },
      });

      return organization;
    });

    const { subject, html } = emailVerificationEmail({
      name: dto.adminName.trim(),
      verifyUrl: this.verificationUrl(verifyToken, email),
    });
    await this.email.send(email, subject, html);

    return {
      requiresEmailVerification: true,
      email,
      message:
        'Verify your email to activate your organization and access the admin dashboard.',
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        isActive: org.isActive,
        bookingUrl: this.bookingUrlForOrg(org.slug),
      },
    };
  }

  private monthWindow() {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }

  async getOverview(scope?: PlatformScopeQuery) {
    const tenantWhere = this.tenantWhere(scope);
    const { start, end } = this.monthWindow();
    const tenantOrgs = await this.prisma.organization.findMany({
      where: tenantWhere,
      select: { id: true },
    });
    const tenantOrgIds = tenantOrgs.map((o) => o.id);

    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      appointmentsThisMonth,
      totalAppointments,
      proCount,
      freeCount,
      recentOrgs,
    ] = await Promise.all([
      this.prisma.organization.count({ where: tenantWhere }),
      this.prisma.organization.count({ where: { ...tenantWhere, isActive: true } }),
      this.prisma.organization.count({ where: { ...tenantWhere, isActive: false } }),
      tenantOrgIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.appointment.count({
            where: {
              organizationId: { in: tenantOrgIds },
              createdAt: { gte: start, lt: end },
              status: { not: 'cancelled' },
            },
          }),
      tenantOrgIds.length === 0
        ? Promise.resolve(0)
        : this.prisma.appointment.count({
            where: { organizationId: { in: tenantOrgIds }, status: { not: 'cancelled' } },
          }),
      this.prisma.organization.count({
        where: {
          ...tenantWhere,
          subscriptionPlan: { in: ['pro', 'scale'] },
          subscriptionStatus: 'active',
        },
      }),
      this.prisma.organization.count({
        where: {
          ...tenantWhere,
          OR: [{ subscriptionPlan: 'free' }, { subscriptionStatus: { not: 'active' } }],
        },
      }),
      this.prisma.organization.findMany({
        where: tenantWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          subscriptionPlan: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      appointmentsThisMonth,
      totalAppointments,
      proSubscriptions: proCount,
      freeOrInactive: freeCount,
      recentOrganizations: recentOrgs,
    };
  }

  async getPaymentsSummary(scope?: PlatformScopeQuery) {
    const orgs = await this.prisma.organization.findMany({
      where: this.tenantWhere(scope),
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        paymentMethodLast4: true,
        paymentMethodBrand: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    const proActive = orgs.filter(
      (o) =>
        (o.subscriptionPlan === 'pro' || o.subscriptionPlan === 'scale') &&
        o.subscriptionStatus === 'active',
    ).length;

    return {
      totalOrganizations: orgs.length,
      proActive,
      free: orgs.length - proActive,
      organizations: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        isActive: o.isActive,
        plan: o.subscriptionPlan,
        status: o.subscriptionStatus,
        subscriptionExpiresAt: o.subscriptionExpiresAt,
        paymentMethod: o.paymentMethodLast4
          ? { last4: o.paymentMethodLast4, brand: o.paymentMethodBrand ?? 'card' }
          : null,
        hasStripeCustomer: Boolean(o.stripeCustomerId),
        hasStripeSubscription: Boolean(o.stripeSubscriptionId),
      })),
    };
  }

  async getReportsSummary(scope?: PlatformScopeQuery) {
    const tenantWhere = this.tenantWhere(scope);
    const { start, end } = this.monthWindow();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const orgs = await this.prisma.organization.findMany({
      where: tenantWhere,
      select: { id: true, name: true, slug: true },
    });
    const orgIds = orgs.map((o) => o.id);

    const [byStatus, byOrg, signupsLast30] = await Promise.all([
      orgIds.length === 0
        ? []
        : this.prisma.appointment.groupBy({
            by: ['status'],
            where: { organizationId: { in: orgIds }, createdAt: { gte: start, lt: end } },
            _count: { id: true },
          }),
      orgIds.length === 0
        ? []
        : this.prisma.appointment.groupBy({
            by: ['organizationId'],
            where: {
              organizationId: { in: orgIds },
              createdAt: { gte: start, lt: end },
              status: { not: 'cancelled' },
            },
            _count: { id: true },
          }),
      this.prisma.organization.count({
        where: { ...tenantWhere, createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));
    const appointmentsByOrg = byOrg
      .map((row) => ({
        organizationId: row.organizationId,
        organizationName: orgNameById.get(row.organizationId) ?? 'Unknown',
        count: row._count.id,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      signupsLast30Days: signupsLast30,
      appointmentsByStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
      })),
      topOrganizationsByAppointments: appointmentsByOrg,
    };
  }

  private normalizeNotificationStatus(status?: string): NotificationStatus | undefined {
    if (!status || status === 'all') return undefined;
    if (
      status === NotificationStatus.PENDING ||
      status === NotificationStatus.SENT ||
      status === NotificationStatus.FAILED
    ) {
      return status;
    }
    return undefined;
  }

  private normalizeNotificationChannel(channel?: string): 'email' | 'whatsapp' | undefined {
    if (!channel || channel === 'all') return undefined;
    if (channel === 'email' || channel === 'whatsapp') return channel;
    return undefined;
  }

  private parseNotificationType(type: string): {
    channel: 'email' | 'whatsapp' | 'system';
    eventType: string;
    audience: 'customer' | 'provider';
  } {
    const [channelRaw, eventRaw, audienceRaw] = type.split(':');
    const channel =
      channelRaw === 'email' || channelRaw === 'whatsapp' ? channelRaw : ('system' as const);
    return {
      channel,
      eventType: eventRaw ?? type,
      audience: audienceRaw === 'provider' ? 'provider' : 'customer',
    };
  }

  async getNotifications(query: PlatformNotificationsQuery) {
    const whereScope = this.tenantWhere({
      search: query.search,
      status: query.status,
      orgId: query.orgId,
    });
    const tenantOrgs = await this.prisma.organization.findMany({
      where: whereScope,
      select: { id: true, name: true, slug: true },
    });
    const tenantOrgIds = tenantOrgs.map((org) => org.id);
    const orgById = new Map(tenantOrgs.map((org) => [org.id, org]));

    if (tenantOrgIds.length === 0) {
      return {
        items: [],
        summary: {
          total: 0,
          pending: 0,
          sent: 0,
          failed: 0,
        },
      };
    }

    const status = this.normalizeNotificationStatus(query.deliveryStatus);
    const channel = this.normalizeNotificationChannel(query.channel);
    const q = query.q?.trim() ?? '';
    const limit = Math.min(Math.max(Number(query.limit) || 100, 10), 200);

    const where: Prisma.NotificationLogWhereInput = {
      appointment: {
        organizationId: { in: tenantOrgIds },
      },
      ...(status ? { status } : {}),
      ...(channel ? { type: { startsWith: `${channel}:` } } : {}),
      ...(q
        ? {
            OR: [
              { recipient: { contains: q } },
              { type: { contains: q } },
              { appointment: { customer: { name: { contains: q } } } },
              { appointment: { provider: { name: { contains: q } } } },
              { appointment: { service: { name: { contains: q } } } },
              { appointment: { location: { name: { contains: q } } } },
            ],
          }
        : {}),
    };

    const [items, total, pending, sent, failed] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          appointment: {
            select: {
              id: true,
              organizationId: true,
              startUtc: true,
              endUtc: true,
              status: true,
              service: { select: { name: true } },
              provider: { select: { name: true } },
              customer: { select: { name: true } },
              location: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.notificationLog.count({ where }),
      this.prisma.notificationLog.count({
        where: { ...where, status: NotificationStatus.PENDING },
      }),
      this.prisma.notificationLog.count({
        where: { ...where, status: NotificationStatus.SENT },
      }),
      this.prisma.notificationLog.count({
        where: { ...where, status: NotificationStatus.FAILED },
      }),
    ]);

    return {
      items: items.map((item) => {
        const parsed = this.parseNotificationType(item.type);
        const org = orgById.get(item.appointment.organizationId);
        return {
          id: item.id,
          type: item.type,
          status: item.status,
          recipient: item.recipient,
          errorMessage: item.errorMessage,
          sentAt: item.sentAt,
          createdAt: item.createdAt,
          channel: parsed.channel,
          eventType: parsed.eventType,
          audience: parsed.audience,
          appointment: {
            id: item.appointment.id,
            startUtc: item.appointment.startUtc,
            endUtc: item.appointment.endUtc,
            status: item.appointment.status,
            serviceName: item.appointment.service.name,
            providerName: item.appointment.provider.name,
            customerName: item.appointment.customer.name,
            locationName: item.appointment.location.name,
            organizationId: item.appointment.organizationId,
            organizationName: org?.name ?? 'Unknown organization',
            organizationSlug: org?.slug ?? '',
          },
        };
      }),
      summary: {
        total,
        pending,
        sent,
        failed,
      },
    };
  }

  async listOrganizations(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    orgId?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = this.tenantWhere({
      search: query.search,
      status: query.status,
      orgId: query.orgId,
    });

    const [rows, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { users: true, locations: true } },
          locations: { take: 1, orderBy: { name: 'asc' } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    const ids = rows.map((r) => r.id);
    const appointmentCounts =
      ids.length === 0
        ? []
        : await this.prisma.appointment.groupBy({
            by: ['organizationId'],
            where: { organizationId: { in: ids }, status: { not: 'cancelled' } },
            _count: { id: true },
          });
    const countByOrg = new Map(appointmentCounts.map((c) => [c.organizationId, c._count.id]));

    return {
      data: rows.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        isActive: org.isActive,
        subscriptionPlan: org.subscriptionPlan,
        subscriptionStatus: org.subscriptionStatus,
        createdAt: org.createdAt,
        locationCount: org._count.locations,
        userCount: org._count.users,
        appointmentCount: countByOrg.get(org.id) ?? 0,
        primaryTimezone: org.locations[0]?.timezone ?? null,
        bookingUrl: this.bookingUrlForOrg(org.slug),
      })),
      total,
      page,
      limit,
    };
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, ...this.tenantWhere() },
      include: {
        locations: { orderBy: { name: 'asc' } },
        _count: { select: { users: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const [appointmentCount, adminUsers] = await Promise.all([
      this.prisma.appointment.count({
        where: { organizationId: org.id, status: { not: 'cancelled' } },
      }),
      this.prisma.user.findMany({
        where: {
          organizationId: org.id,
          role: { in: [UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER] },
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
    ]);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isActive: org.isActive,
      subscriptionPlan: org.subscriptionPlan,
      subscriptionStatus: org.subscriptionStatus,
      subscriptionExpiresAt: org.subscriptionExpiresAt,
      bookingCurrency: org.bookingCurrency,
      createdAt: org.createdAt,
      locations: org.locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        timezone: loc.timezone,
        reminderOffsetsMinutes: parseReminderOffsetsJson(loc.reminderOffsetsMinutes),
      })),
      userCount: org._count.users,
      appointmentCount,
      adminUsers,
      bookingUrl: this.bookingUrlForOrg(org.slug),
    };
  }

  async updateOrganization(id: string, dto: UpdatePlatformOrganizationDto) {
    const org = await this.prisma.organization.findFirst({
      where: { id, ...this.tenantWhere() },
    });
    if (!org) throw new NotFoundException('Organization not found');

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
      },
    });
  }

  async resetAllTenantData(confirmText: string) {
    if (confirmText !== 'RESET_ALL_DATA') {
      throw new BadRequestException('Confirmation text is invalid');
    }

    const platformOrg = await this.prisma.organization.findUnique({
      where: { slug: PLATFORM_ORG_SLUG },
      select: { id: true },
    });
    if (!platformOrg) {
      throw new NotFoundException('Platform organization not found');
    }

    const tenantOrgs = await this.prisma.organization.findMany({
      where: { id: { not: platformOrg.id } },
      select: { id: true },
    });
    const tenantOrgIds = tenantOrgs.map((org) => org.id);
    const hasCustomerAssistantThreadsTable = await this.databaseTableExists(
      'customer_assistant_threads',
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
      let appointmentCount = 0;
      let organizationCount = 0;
      let userCount = 0;
      let providerCount = 0;
      let serviceCount = 0;
      let customerCount = 0;

      const nonSuperAdminUsers = await tx.user.findMany({
        where: { role: { not: UserRole.SUPER_ADMIN } },
        select: { id: true },
      });
      const nonSuperAdminUserIds = nonSuperAdminUsers.map((user) => user.id);

      if (tenantOrgIds.length > 0) {
        const [providerIds, serviceIds, appointmentIds, tenantUsers] = await Promise.all([
          tx.provider.findMany({
            where: { organizationId: { in: tenantOrgIds } },
            select: { id: true },
          }),
          tx.service.findMany({
            where: { organizationId: { in: tenantOrgIds } },
            select: { id: true },
          }),
          tx.appointment.findMany({
            where: { organizationId: { in: tenantOrgIds } },
            select: { id: true },
          }),
          tx.user.findMany({
            where: { organizationId: { in: tenantOrgIds } },
            select: { id: true },
          }),
        ]);

        const providerIdList = providerIds.map((row) => row.id);
        const serviceIdList = serviceIds.map((row) => row.id);
        const appointmentIdList = appointmentIds.map((row) => row.id);
        const tenantUserIdList = tenantUsers.map((row) => row.id);

        if (appointmentIdList.length > 0) {
          await tx.appointmentNote.deleteMany({
            where: { appointmentId: { in: appointmentIdList } },
          });
          await tx.review.deleteMany({
            where: { appointmentId: { in: appointmentIdList } },
          });
          await tx.intakeResponse.deleteMany({
            where: { appointmentId: { in: appointmentIdList } },
          });
          await tx.notificationLog.deleteMany({
            where: { appointmentId: { in: appointmentIdList } },
          });
          await tx.appointmentEvent.deleteMany({
            where: { appointmentId: { in: appointmentIdList } },
          });
        }

        if (tenantUserIdList.length > 0) {
          await tx.appointmentNote.deleteMany({
            where: { authorId: { in: tenantUserIdList } },
          });
          if (hasCustomerAssistantThreadsTable) {
            await tx.customerAssistantThread.deleteMany({
              where: { userId: { in: tenantUserIdList } },
            });
          }
          await tx.teamInvite.deleteMany({
            where: { invitedById: { in: tenantUserIdList } },
          });
        }

        if (serviceIdList.length > 0) {
          await tx.waitlist.deleteMany({
            where: { serviceId: { in: serviceIdList } },
          });
          await tx.intakeField.deleteMany({
            where: { serviceId: { in: serviceIdList } },
          });
        }

        if (providerIdList.length > 0) {
          await tx.providerCalendarConnection.deleteMany({
            where: { providerId: { in: providerIdList } },
          });
          await tx.availabilityRule.deleteMany({
            where: { providerId: { in: providerIdList } },
          });
          await tx.blockedTime.deleteMany({
            where: { providerId: { in: providerIdList } },
          });
        }

        if (serviceIdList.length > 0 || providerIdList.length > 0) {
          await tx.serviceProvider.deleteMany({
            where: {
              OR: [
                ...(serviceIdList.length > 0 ? [{ serviceId: { in: serviceIdList } }] : []),
                ...(providerIdList.length > 0 ? [{ providerId: { in: providerIdList } }] : []),
              ],
            },
          });
        }

        if (hasCustomerAssistantThreadsTable) {
          await tx.customerAssistantThread.deleteMany({
            where: { organizationId: { in: tenantOrgIds } },
          });
        }
        await tx.notificationTemplate.deleteMany({
          where: { organizationId: { in: tenantOrgIds } },
        });
        await tx.billingHistory.deleteMany({
          where: { organizationId: { in: tenantOrgIds } },
        });

        appointmentCount = (
          await tx.appointment.deleteMany({
            where: { organizationId: { in: tenantOrgIds } },
          })
        ).count;
        customerCount = (
          await tx.customer.deleteMany({
            where: { organizationId: { in: tenantOrgIds } },
          })
        ).count;
        await tx.teamInvite.deleteMany({
          where: { organizationId: { in: tenantOrgIds } },
        });
        userCount = (
          await tx.user.deleteMany({
            where: { organizationId: { in: tenantOrgIds } },
          })
        ).count;
        providerCount = (
          await tx.provider.deleteMany({
            where: { organizationId: { in: tenantOrgIds } },
          })
        ).count;
        serviceCount = (
          await tx.service.deleteMany({
            where: { organizationId: { in: tenantOrgIds } },
          })
        ).count;

        await tx.outboundWebhook.deleteMany({
          where: { organizationId: { in: tenantOrgIds } },
        });
        await tx.apiKey.deleteMany({
          where: { organizationId: { in: tenantOrgIds } },
        });
        await tx.partnerBookingSession.deleteMany({
          where: { organizationId: { in: tenantOrgIds } },
        });

        await tx.location.deleteMany({
          where: { organizationId: { in: tenantOrgIds } },
        });
        organizationCount = (
          await tx.organization.deleteMany({
            where: { id: { in: tenantOrgIds } },
          })
        ).count;
      }

      if (nonSuperAdminUserIds.length > 0) {
        await tx.appointmentNote.deleteMany({
          where: { authorId: { in: nonSuperAdminUserIds } },
        });
        if (hasCustomerAssistantThreadsTable) {
          await tx.customerAssistantThread.deleteMany({
            where: { userId: { in: nonSuperAdminUserIds } },
          });
        }
        await tx.teamInvite.deleteMany({
          where: { invitedById: { in: nonSuperAdminUserIds } },
        });
        await tx.customer.deleteMany({
          where: { userId: { in: nonSuperAdminUserIds } },
        });
      }

      const deletedNonSuperAdmins = (
        await tx.user.deleteMany({
          where: { role: { not: UserRole.SUPER_ADMIN } },
        })
      ).count;
      const deletedIdempotency = (await tx.idempotencyRecord.deleteMany({})).count;
      const remainingSuperAdmins = await tx.user.count({
        where: { role: UserRole.SUPER_ADMIN },
      });

      return {
        ok: true,
        removed: {
          organizations: organizationCount,
          users: userCount + deletedNonSuperAdmins,
          customers: customerCount,
          providers: providerCount,
          services: serviceCount,
          appointments: appointmentCount,
          idempotencyRecords: deletedIdempotency,
        },
        remainingSuperAdmins,
      };
      }, {
        maxWait: RESET_TRANSACTION_MAX_WAIT_MS,
        timeout: RESET_TRANSACTION_TIMEOUT_MS,
      });
    } catch (error) {
      const prismaError = error as { code?: string; meta?: Record<string, unknown> };
      if (prismaError.code === 'P2021' || prismaError.code === 'P2022') {
        throw new BadRequestException(
          'Database schema is not up to date. Run pnpm exec prisma migrate deploy on Render, then try reset again.',
        );
      }
      if (prismaError.code === 'P2003') {
        throw new BadRequestException(
          `Reset is blocked by dependent data${prismaError.meta?.field_name ? `: ${String(prismaError.meta.field_name)}` : ''}.`,
        );
      }
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Reset failed',
      );
    }
  }
}
