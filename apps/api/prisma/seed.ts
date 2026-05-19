import { PrismaClient } from '@prisma/client';
import { UserRole } from '@pkg/shared-types';
import * as bcrypt from 'bcrypt';

/** Stable UUIDs for demo data (valid for @IsUUID() on booking API). */
export const SEED_IDS = {
  locationId: '11111111-1111-4111-8111-111111111101',
  locationWestId: '11111111-1111-4111-8111-111111111111',
  orgSlug: 'demo-company',
  /** First service — used by /book?product=demo */
  serviceId: '11111111-1111-4111-8111-111111111102',
  /** First provider — used by concurrency tests */
  providerId: '11111111-1111-4111-8111-111111111201',
} as const;

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'asadshah1024+admin@gmail.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Asad@0451';
const PROVIDER_EMAIL_BASE = process.env.SEED_PROVIDER_EMAIL_BASE ?? 'asadshah1024';
const PROVIDER_EMAIL_DOMAIN = process.env.SEED_PROVIDER_EMAIL_DOMAIN ?? 'gmail.com';

function providerEmail(tag: string): string {
  return `${PROVIDER_EMAIL_BASE}+${tag}@${PROVIDER_EMAIL_DOMAIN}`;
}

const SERVICE_DEFS = [
  {
    id: '11111111-1111-4111-8111-111111111102',
    name: 'Product Demo',
    productKey: 'demo',
    durationMinutes: 30,
    description: '30-minute product walkthrough',
    priceCents: 4900,
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    name: 'Discovery Call',
    productKey: 'discovery',
    durationMinutes: 45,
    description: 'Initial needs assessment',
  },
  {
    id: '11111111-1111-4111-8111-111111111104',
    name: 'Technical Consultation',
    productKey: 'consulting',
    durationMinutes: 60,
    description: 'Deep-dive with a specialist',
  },
  {
    id: '11111111-1111-4111-8111-111111111105',
    name: 'Support Check-in',
    productKey: 'support',
    durationMinutes: 20,
    description: 'Quick support follow-up',
  },
  {
    id: '11111111-1111-4111-8111-111111111106',
    name: 'Onboarding Session',
    productKey: 'onboarding',
    durationMinutes: 45,
    description: 'Get started with the platform',
  },
] as const;

const PROVIDER_DEFS = [
  { id: '11111111-1111-4111-8111-111111111201', name: 'John Smith', emailTag: 'john' },
  { id: '11111111-1111-4111-8111-111111111202', name: 'Sara Johnson', emailTag: 'sara' },
  { id: '11111111-1111-4111-8111-111111111203', name: 'Mike Garcia', emailTag: 'mike' },
  { id: '11111111-1111-4111-8111-111111111204', name: 'Emma Wilson', emailTag: 'emma' },
  { id: '11111111-1111-4111-8111-111111111205', name: 'Ali Chen', emailTag: 'ali' },
] as const;

const prisma = new PrismaClient();

async function seedAvailability(providerId: string) {
  await prisma.availabilityRule.deleteMany({ where: { providerId } });
  for (let dow = 1; dow <= 5; dow++) {
    await prisma.availabilityRule.create({
      data: {
        providerId,
        dayOfWeek: dow,
        startTime: '09:00',
        endTime: '17:00',
      },
    });
  }
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: SEED_IDS.orgSlug },
    update: {
      primaryColor: '#2563eb',
      bookingCurrency: 'aed',
      allowedEmbedOrigins: JSON.stringify([
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:5500',
      ]),
    },
    create: {
      name: 'Demo Company',
      slug: SEED_IDS.orgSlug,
      primaryColor: '#2563eb',
      bookingCurrency: 'aed',
      allowedEmbedOrigins: JSON.stringify([
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:5500',
      ]),
    },
  });

  const location = await prisma.location.upsert({
    where: { id: SEED_IDS.locationId },
    update: {},
    create: {
      id: SEED_IDS.locationId,
      organizationId: org.id,
      name: 'Main Office',
      timezone: 'America/New_York',
      address: '123 Business Ave, New York, NY',
      phone: '+1-555-0100',
    },
  });

  const locationWest = await prisma.location.upsert({
    where: { id: SEED_IDS.locationWestId },
    update: {},
    create: {
      id: SEED_IDS.locationWestId,
      organizationId: org.id,
      name: 'West Coast Office',
      timezone: 'America/Los_Angeles',
      address: '500 Market St, San Francisco, CA',
      phone: '+1-555-0200',
    },
  });

  const seedProviderIds = PROVIDER_DEFS.map((p) => p.id);
  const seedServiceIds = SERVICE_DEFS.map((s) => s.id);

  await prisma.provider.updateMany({
    where: {
      organizationId: org.id,
      locationId: location.id,
      id: { notIn: [...seedProviderIds] },
    },
    data: { isActive: false },
  });

  await prisma.service.updateMany({
    where: {
      organizationId: org.id,
      locationId: location.id,
      id: { notIn: [...seedServiceIds] },
    },
    data: { isActive: false },
  });

  const providers = [];
  for (const def of PROVIDER_DEFS) {
    const email = providerEmail(def.emailTag);
    const provider = await prisma.provider.upsert({
      where: { id: def.id },
      update: { name: def.name, email, isActive: true },
      create: {
        id: def.id,
        organizationId: org.id,
        locationId: location.id,
        name: def.name,
        email,
      },
    });
    await seedAvailability(provider.id);
    providers.push(provider);
  }

  const services = [];
  for (const def of SERVICE_DEFS) {
    const service = await prisma.service.upsert({
      where: { id: def.id },
      update: {
        name: def.name,
        description: def.description,
        productKey: def.productKey,
        durationMinutes: def.durationMinutes,
        isActive: true,
        ...('priceCents' in def ? { priceCents: def.priceCents } : {}),
      },
      create: {
        id: def.id,
        organizationId: org.id,
        locationId: location.id,
        name: def.name,
        description: def.description,
        productKey: def.productKey,
        durationMinutes: def.durationMinutes,
        bufferAfterMinutes: 10,
        ...('priceCents' in def ? { priceCents: def.priceCents } : {}),
      },
    });
    services.push(service);
  }

  await prisma.serviceProvider.deleteMany({
    where: {
      serviceId: { in: seedServiceIds },
      providerId: { in: seedProviderIds },
    },
  });

  for (const service of services) {
    for (const provider of providers) {
      await prisma.serviceProvider.create({
        data: { serviceId: service.id, providerId: provider.id },
      });
    }
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      name: 'Asad Shah',
      role: UserRole.ORG_ADMIN,
      emailVerified: true,
      organizationId: org.id,
    },
    create: {
      organizationId: org.id,
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Asad Shah',
      role: UserRole.ORG_ADMIN,
      emailVerified: true,
    },
  });

  const providerEmails = PROVIDER_DEFS.map((d) => providerEmail(d.emailTag));

  await prisma.user.deleteMany({
    where: {
      organizationId: org.id,
      role: UserRole.PROVIDER,
      email: { notIn: providerEmails },
    },
  });

  for (const def of PROVIDER_DEFS) {
    const email = providerEmail(def.emailTag);
    const staleByProvider = await prisma.user.findFirst({
      where: { providerId: def.id, email: { not: email } },
    });
    if (staleByProvider) {
      await prisma.user.delete({ where: { id: staleByProvider.id } });
    }

    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        name: def.name,
        role: UserRole.PROVIDER,
        providerId: def.id,
        emailVerified: true,
        organizationId: org.id,
      },
      create: {
        organizationId: org.id,
        email,
        passwordHash,
        name: def.name,
        role: UserRole.PROVIDER,
        providerId: def.id,
        emailVerified: true,
      },
    });
  }

  const WEST_SERVICES = [
    { id: '22222222-2222-4222-8222-222222222201', sourceId: SERVICE_DEFS[0].id },
    { id: '22222222-2222-4222-8222-222222222202', sourceId: SERVICE_DEFS[2].id },
    { id: '22222222-2222-4222-8222-222222222203', sourceId: SERVICE_DEFS[3].id },
  ] as const;
  const WEST_PROVIDERS = [
    { id: '22222222-2222-4222-8222-222222222301', sourceId: PROVIDER_DEFS[1].id },
    { id: '22222222-2222-4222-8222-222222222302', sourceId: PROVIDER_DEFS[3].id },
  ] as const;

  for (const def of WEST_SERVICES) {
    const src = services.find((s) => s.id === def.sourceId);
    if (!src) continue;
    await prisma.service.upsert({
      where: { id: def.id },
      update: { isActive: true },
      create: {
        id: def.id,
        organizationId: org.id,
        locationId: locationWest.id,
        name: src.name,
        description: src.description,
        productKey: src.productKey,
        durationMinutes: src.durationMinutes,
        bufferAfterMinutes: 10,
        ...('priceCents' in src && src.priceCents != null ? { priceCents: src.priceCents } : {}),
      },
    });
  }

  for (const def of WEST_PROVIDERS) {
    const src = providers.find((p) => p.id === def.sourceId);
    if (!src) continue;
    const westProvider = await prisma.provider.upsert({
      where: { id: def.id },
      update: { name: src.name, email: src.email, isActive: true },
      create: {
        id: def.id,
        organizationId: org.id,
        locationId: locationWest.id,
        name: src.name,
        email: src.email,
      },
    });
    await seedAvailability(westProvider.id);
  }

  const westServices = await prisma.service.findMany({ where: { locationId: locationWest.id } });
  const westProviders = await prisma.provider.findMany({ where: { locationId: locationWest.id } });
  for (const ws of westServices) {
    for (const wp of westProviders) {
      await prisma.serviceProvider.upsert({
        where: { serviceId_providerId: { serviceId: ws.id, providerId: wp.id } },
        update: {},
        create: { serviceId: ws.id, providerId: wp.id },
      });
    }
  }

  console.log('Seed complete.\n');
  console.log(`Admin:    ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}\n`);
  console.log('Providers (same password as admin):');
  for (const def of PROVIDER_DEFS) {
    console.log(`  ${def.name.padEnd(16)} ${providerEmail(def.emailTag)}`);
  }
  console.log('\nServices:');
  for (const def of SERVICE_DEFS) {
    console.log(`  ${def.name.padEnd(24)} product=${def.productKey}`);
  }
  console.log('\nBooking URLs:');
  const keys = [...new Set(SERVICE_DEFS.map((s) => s.productKey))];
  for (const key of keys) {
    console.log(`  http://localhost:3000/book?org=${SEED_IDS.orgSlug}&product=${key}`);
  }
  console.log(`\nAdmin portal:    http://localhost:3000/admin/dashboard`);
  console.log(`Provider portal: http://localhost:3000/provider/dashboard`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
