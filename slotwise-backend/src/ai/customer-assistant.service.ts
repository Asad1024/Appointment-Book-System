import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DateTime } from 'luxon';
import { isPlatformOrgSlug } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import type { CustomerAssistantDto } from './dto/customer-assistant.dto';

type ServiceOption = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
  providerIds: string[];
  intakeFields: IntakeFieldOption[];
};

type IntakeFieldOption = {
  id: string;
  label: string;
  helpText: string | null;
  type: string;
  options: string[] | null;
  required: boolean;
  order: number;
};

type ProviderOption = {
  id: string;
  name: string;
  serviceIds: string[];
};

type AssistantAction =
  | {
      type: 'selectService';
      label: string;
      payload: { serviceId: string };
    }
  | {
      type: 'selectProvider';
      label: string;
      payload: { providerId: string };
    }
  | {
      type: 'selectDate';
      label: string;
      payload: { date: string };
    }
  | {
      type: 'selectSlot';
      label: string;
      payload: { serviceId: string; providerId: string; date: string; startUtc: string };
    }
  | {
      type: 'goToStep';
      label: string;
      payload: { step: string };
    }
  | {
      type: 'openUrl';
      label: string;
      payload: { href: string };
    }
  | {
      type: 'startChatBooking';
      label: string;
      payload: { locationId?: string; serviceId?: string };
    }
  | {
      type: 'collectCustomerDetails';
      label: string;
      payload: Record<string, never>;
    }
  | {
      type: 'collectIntake';
      label: string;
      payload: { serviceId: string };
    }
  | {
      type: 'confirmBooking';
      label: string;
      payload: Record<string, never>;
    };

type AssistantResponse = {
  message: string;
  actions: AssistantAction[];
  quickReplies: string[];
  warning?: 'service_not_found' | 'provider_not_found' | 'no_slots_available' | 'needs_more_info';
};

type CatalogContext = {
  organization: { id: string; name: string; slug: string };
  location: { id: string; name: string; timezone: string; bookingWindowDays: number };
  locations: { id: string; name: string; timezone: string; bookingWindowDays: number }[];
  services: ServiceOption[];
  providers: ProviderOption[];
};

function bookingPagePath(orgSlug: string): string {
  return `/${encodeURIComponent(orgSlug)}/book`;
}

type RawAssistantIntent = {
  reply?: unknown;
  serviceId?: unknown;
  providerId?: unknown;
  date?: unknown;
  timeOfDay?: unknown;
  wantsHelp?: unknown;
  quickReplies?: unknown;
};

const GENERIC_SERVICE_WORDS = new Set([
  'appointment',
  'appointments',
  'appintment',
  'appintments',
  'apointment',
  'apointments',
  'booking',
  'book',
  'slot',
  'slots',
  'time',
  'times',
  'today',
  'tomorrow',
  'morning',
  'afternoon',
  'evening',
  'after',
  'before',
  'between',
  'noon',
  'lunch',
  'any',
  'available',
  'availability',
  'free',
  'service',
  'services',
  'provider',
  'providers',
  'expert',
  'help',
  'need',
  'want',
  'an',
  'please',
  'can',
  'you',
  'show',
  'give',
  'suggest',
  'some',
  'me',
  'for',
  'with',
  'and',
  'that',
  'this',
  'user',
  'too',
  'early',
  'earlier',
  'late',
  'later',
  'matched',
  'matching',
  'now',
  'next',
  'what',
  'should',
  'click',
  'earliest',
  'first',
  'soon',
  'asap',
  'weekend',
  'weekday',
  'week',
  'month',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]);

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 7,
  sun: 7,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

@Injectable()
export class CustomerAssistantService {
  private readonly logger = new Logger(CustomerAssistantService.name);

  constructor(
    private prisma: PrismaService,
    private availability: AvailabilityService,
  ) {}

  async chat(dto: CustomerAssistantDto): Promise<AssistantResponse> {
    const catalog = await this.loadCatalog(dto);
    const message = dto.message.trim();
    if (!message) {
      return this.helpResponse(dto, catalog);
    }

    if (this.isBookingRequest(message)) {
      return this.chatBookingOffer(dto, catalog);
    }

    if (dto.page === 'account') {
      const account = this.accountResponse(dto, catalog);
      if (account) return account;
    }

    if (this.isHelpRequest(message)) {
      return this.helpResponse(dto, catalog);
    }

    const intent = await this.getIntent(dto, catalog);
    return this.buildResponse(dto, catalog, intent);
  }

  private async loadCatalog(dto: CustomerAssistantDto): Promise<CatalogContext> {
    const org = await this.prisma.organization.findUnique({
      where: { slug: dto.org.trim() },
      include: { locations: { orderBy: { name: 'asc' } } },
    });
    if (!org || isPlatformOrgSlug(org.slug)) {
      throw new BadRequestException('Organization not found');
    }
    if (!org.isActive) {
      throw new BadRequestException('This organization is not accepting bookings');
    }
    if (org.locations.length === 0) {
      throw new BadRequestException('No location configured');
    }

    const location =
      (dto.state?.locationId
        ? org.locations.find((item) => item.id === dto.state?.locationId)
        : undefined) ?? org.locations[0];

    const [services, providers] = await Promise.all([
      this.prisma.service.findMany({
        where: {
          organizationId: org.id,
          locationId: location.id,
          isActive: true,
          archivedAt: null,
        },
        include: {
          intakeFields: { orderBy: { order: 'asc' } },
          serviceProviders: {
            include: {
              provider: {
                select: { id: true, name: true, isActive: true, archivedAt: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.provider.findMany({
        where: {
          organizationId: org.id,
          locationId: location.id,
          isActive: true,
          archivedAt: null,
        },
        include: {
          serviceProviders: {
            include: {
              service: {
                select: { id: true, isActive: true, archivedAt: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      organization: { id: org.id, name: org.name, slug: org.slug },
      location,
      locations: org.locations.map((item) => ({
        id: item.id,
        name: item.name,
        timezone: item.timezone,
        bookingWindowDays: item.bookingWindowDays,
      })),
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        providerIds: service.serviceProviders
          .filter((link) => link.provider.isActive && !link.provider.archivedAt)
          .map((link) => link.provider.id),
        intakeFields: service.intakeFields.map((field) => ({
          id: field.id,
          label: field.label,
          helpText: field.helpText,
          type: field.type,
          options: Array.isArray(field.options) ? (field.options as string[]) : null,
          required: field.required,
          order: field.order,
        })),
      })),
      providers: providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        serviceIds: provider.serviceProviders
          .filter((link) => link.service.isActive && !link.service.archivedAt)
          .map((link) => link.service.id),
      })),
    };
  }

  private async getIntent(
    dto: CustomerAssistantDto,
    catalog: CatalogContext,
  ): Promise<RawAssistantIntent> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('AI assistant is not configured');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_BOOKING_HELPER_MODEL?.trim() || 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are Slotwise customer assistant. Return only JSON. Keys: reply, serviceId, providerId, date, timeOfDay, wantsHelp, quickReplies. Use only listed ids. If the requested service is not clearly in the list, return null serviceId and explain. Use the word "staff" for customer-facing replies, not "provider". Never invent slots or booking confirmations.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                customerMessage: dto.message,
                page: dto.page,
                step: dto.step,
                state: dto.state ?? {},
                recentMessages: (dto.messages ?? []).slice(-6),
                today: this.today(catalog.location.timezone),
                timezone: dto.state?.customerTimezone ?? catalog.location.timezone,
                organization: catalog.organization,
                location: catalog.location,
                services: catalog.services,
                providers: catalog.providers,
                accountContext: dto.accountContext ?? null,
              }),
            },
          ],
          max_tokens: 500,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
      const body = (await response.json()) as {
        choices?: { message?: { content?: string | null } }[];
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error('OpenAI returned an empty response');
      return JSON.parse(content) as RawAssistantIntent;
    } catch (error) {
      this.logger.warn(`Customer assistant AI failed: ${String(error)}`);
      return this.localIntent(dto, catalog);
    }
  }

  private async buildResponse(
    dto: CustomerAssistantDto,
    catalog: CatalogContext,
    raw: RawAssistantIntent,
  ): Promise<AssistantResponse> {
    const requestedWords = this.significantWords(dto.message);
    const service = this.resolveService(raw.serviceId, dto.state?.serviceId, requestedWords, catalog);
    const provider = this.resolveProvider(raw.providerId, dto.state?.providerId, service?.id, catalog);
    const date = this.resolveDate(raw.date, dto.message, catalog.location.timezone);
    const timeOfDay =
      typeof raw.timeOfDay === 'string' && raw.timeOfDay.trim()
        ? raw.timeOfDay.trim()
        : this.extractTimeOfDay(dto.message);
    const wantsEarliest = this.wantsEarliest(dto.message);

    if (!service && this.looksLikeServiceRequest(dto.message, catalog)) {
      return {
        message:
          `I do not see that service at ${catalog.organization.name}. Please choose one of the available services below.`,
        actions: this.sanitizeActions(dto, catalog.services.slice(0, 4).map((item) => ({
          type: 'selectService',
          label: item.name,
          payload: { serviceId: item.id },
        }))),
        quickReplies: ['What services are available?'],
        warning: 'service_not_found',
      };
    }

    if (!service) {
      return {
        message:
          typeof raw.reply === 'string' && raw.reply.trim()
            ? raw.reply.trim()
            : `I can help you book at ${catalog.organization.name}. Which service would you like?`,
        actions: this.sanitizeActions(dto, catalog.services.slice(0, 4).map((item) => ({
          type: 'selectService',
          label: item.name,
          payload: { serviceId: item.id },
        }))),
        quickReplies: ['Show available services', 'I need a slot today'],
        warning: 'needs_more_info',
      };
    }

    if (!provider && raw.providerId && raw.providerId !== 'any') {
      return {
        message: 'I could not find that staff member for this service. You can pick any available staff or choose from the list.',
        actions: this.sanitizeActions(dto, this.providerActions(service, catalog)),
        quickReplies: ['Any staff is fine'],
        warning: 'provider_not_found',
      };
    }

    const providerId = provider?.id ?? 'any';
    const actions: AssistantAction[] = [
      { type: 'selectService', label: `Use ${service.name}`, payload: { serviceId: service.id } },
    ];
    if (provider) {
      actions.push({
        type: 'selectProvider',
        label: `Use ${provider.name}`,
        payload: { providerId: provider.id },
      });
    } else {
      actions.push({
        type: 'selectProvider',
        label: 'Use any available staff',
        payload: { providerId: 'any' },
      });
    }

    if (date) {
      actions.push({ type: 'selectDate', label: `Use ${date}`, payload: { date } });
    }

    let slotActions = date
      ? await this.slotActions(
          catalog.location.id,
          service.id,
          providerId,
          date,
          catalog.location.timezone,
          timeOfDay,
        )
      : [];

    let earliestDate: string | null = null;
    if (!date && wantsEarliest) {
      const earliest = await this.findAvailableSlotsAcrossDays({
        locationId: catalog.location.id,
        serviceId: service.id,
        providerId,
        startDate: this.today(catalog.location.timezone),
        days: Math.min(catalog.location.bookingWindowDays, 14),
        timezone: catalog.location.timezone,
        timeOfDay,
      });
      earliestDate = earliest.date;
      slotActions = earliest.actions;
    }
    actions.push(...slotActions);

    if (!date && wantsEarliest && slotActions.length === 0) {
      return {
        message: `I checked the next ${Math.min(catalog.location.bookingWindowDays, 14)} days for ${service.name}, but I could not find a matching available slot. Try a different time preference, staff member, or date.`,
        actions: this.sanitizeActions(dto, [
          ...actions,
          { type: 'goToStep', label: 'Go to date and time', payload: { step: 'dateTime' } },
        ]),
        quickReplies: ['Try any time', 'Show staff'],
        warning: 'no_slots_available',
      };
    }

    if (date && slotActions.length === 0) {
      const nextDate = this.nextDay(date, catalog.location.timezone);
      const nextAvailable = await this.findAvailableSlotsAcrossDays({
        locationId: catalog.location.id,
        serviceId: service.id,
        providerId,
        startDate: nextDate,
        days: Math.min(catalog.location.bookingWindowDays, 14),
        timezone: catalog.location.timezone,
        timeOfDay,
      });
      return {
        message: nextAvailable.actions.length > 0
          ? `I found ${service.name}, but there are no matching slots on ${date}. The next available options I found are on ${nextAvailable.date}.`
          : `I found ${service.name}, but there are no matching slots on ${date}. Try another date or join the waitlist if the booking page offers it.`,
        actions: this.sanitizeActions(dto, [
          ...actions,
          ...(nextAvailable.actions.length > 0
            ? nextAvailable.actions
            : [{ type: 'selectDate' as const, label: `Try ${nextDate}`, payload: { date: nextDate } }]),
          { type: 'goToStep', label: 'Go to date and time', payload: { step: 'dateTime' } },
        ]),
        quickReplies: ['Try tomorrow', 'What should I do here?'],
        warning: 'no_slots_available',
      };
    }

    let reply: string;
    if (earliestDate) {
      reply = `The earliest matching slots I found for ${service.name} are on ${earliestDate}. Pick one below, then review before confirming.`;
    } else if (typeof raw.reply === 'string' && raw.reply.trim()) {
      reply = raw.reply.trim();
    } else if (date) {
      reply = `I found ${service.name}. Pick one of the available times below, then review your details before confirming.`;
    } else {
      reply = `I found ${service.name}. Choose a staff member and date, then I can suggest real available times.`;
    }

    return {
      message: reply,
      actions: this.sanitizeActions(dto, [
        ...actions,
        { type: 'goToStep', label: date ? 'Go to date and time' : 'Continue booking', payload: { step: date ? 'dateTime' : 'provider' } },
      ]),
      quickReplies: this.quickReplies(raw.quickReplies),
    };
  }

  private async slotActions(
    locationId: string,
    serviceId: string,
    providerId: string,
    date: string,
    timezone: string,
    timeOfDay: string | null,
  ): Promise<AssistantAction[]> {
    try {
      const result = await this.availability.getSlots({
        locationId,
        serviceId,
        providerId,
        fromDate: date,
        toDate: date,
      });
      return result.slots
        .filter((slot) => slot.status === 'available')
        .filter((slot) => this.matchesTimePreference(slot.startUtc, timezone, timeOfDay))
        .slice(0, 5)
        .map((slot) => ({
          type: 'selectSlot' as const,
          label: DateTime.fromISO(slot.startUtc, { zone: 'utc' })
            .setZone(timezone)
            .toFormat('h:mm a'),
          payload: {
            serviceId,
            providerId: slot.providerId ?? providerId,
            date,
            startUtc: slot.startUtc,
          },
        }));
    } catch (error) {
      this.logger.warn(`Could not load assistant slots: ${String(error)}`);
      return [];
    }
  }

  private async findAvailableSlotsAcrossDays(params: {
    locationId: string;
    serviceId: string;
    providerId: string;
    startDate: string;
    days: number;
    timezone: string;
    timeOfDay: string | null;
  }): Promise<{ date: string | null; actions: AssistantAction[] }> {
    const start = DateTime.fromISO(params.startDate, { zone: params.timezone });
    for (let offset = 0; offset < params.days; offset += 1) {
      const date = start.plus({ days: offset }).toISODate();
      if (!date) continue;
      const actions = await this.slotActions(
        params.locationId,
        params.serviceId,
        params.providerId,
        date,
        params.timezone,
        params.timeOfDay,
      );
      if (actions.length > 0) {
        return { date, actions: actions.slice(0, 4) };
      }
    }
    return { date: null, actions: [] };
  }

  private helpResponse(dto: CustomerAssistantDto, catalog: CatalogContext): AssistantResponse {
    if (dto.page === 'account') {
      return {
        message:
          'This is your customer portal. You can view upcoming appointments, manage or reschedule active bookings, leave waitlists, and book another appointment.',
        actions: [
          { type: 'openUrl', label: 'Book appointment', payload: { href: bookingPagePath(catalog.organization.slug) } },
        ],
        quickReplies: ['Where are my upcoming appointments?', 'How do I reschedule?'],
      };
    }

    const step = dto.step ?? 'service';
    const service = dto.state?.serviceId
      ? catalog.services.find((item) => item.id === dto.state?.serviceId)
      : null;
    const provider =
      dto.state?.providerId === 'any'
        ? null
        : dto.state?.providerId
          ? catalog.providers.find((item) => item.id === dto.state?.providerId)
          : null;
    const providerLabel =
      dto.state?.providerId === 'any' ? 'any available staff' : provider?.name;
    const serviceLine = service
      ? ` You already selected ${service.name}${providerLabel ? ` with ${providerLabel}` : ''}.`
      : '';
    const messages: Record<string, string> = {
      location: 'Choose the location where you want the appointment. After that, I can show services for that location.',
      service: 'Choose the service you need. If you are not sure, tell me what you want and I will compare it with the available services.',
      provider: 'Choose a specific staff member, or select any available staff for the most time options.',
      dateTime: `${serviceLine} You are on the date and time step. Pick a date on the calendar, then choose one of the available time buttons. If no times show, try another date.`,
      details: dto.state?.hasCustomerDetails
        ? 'Your contact details are filled. Review them, then continue to the booking review step.'
        : 'Enter your name, email, and phone so the business can send confirmations and reminders.',
      intake: 'Answer the extra questions for this service. Required questions must be completed before review.',
      confirm: dto.state?.hasCustomerDetails
        ? 'Review everything on this step. Nothing is booked until you click the final confirm button.'
        : 'Your time is selected, but your contact details are still missing. Go back to details, enter your name, email, and phone, then return to review.',
    };

    return {
      message: messages[step] ?? messages.service,
      actions: this.sanitizeActions(dto, this.contextActions(dto, catalog)),
      quickReplies:
        step === 'confirm' && !dto.state?.hasCustomerDetails
          ? []
          : step === 'details'
            ? []
            : ['Suggest a slot today', 'Show services'],
    };
  }

  private chatBookingOffer(dto: CustomerAssistantDto, catalog: CatalogContext): AssistantResponse {
    const service = this.bestLocalService(dto.message, catalog.services);
    const actions: AssistantAction[] = [
      {
        type: 'startChatBooking',
        label: service ? `Book ${service.name} with me` : 'Book with me',
        payload: { locationId: catalog.location.id, serviceId: service?.id },
      },
      {
        type: 'openUrl',
        label: 'Go to booking page',
        payload: { href: bookingPagePath(catalog.organization.slug) },
      },
    ];

    return {
      message: service
        ? `Yes. I can help you book ${service.name} here in chat, or you can open the full booking page.`
        : 'Yes. I can help you book here in chat, or you can open the full booking page.',
      actions: this.sanitizeActions(dto, actions),
      quickReplies: ['Show free slots', 'Show services'],
    };
  }

  private accountResponse(
    dto: CustomerAssistantDto,
    catalog: CatalogContext,
  ): AssistantResponse | null {
    const message = dto.message.toLowerCase();
    const context = dto.accountContext ?? {};
    const upcoming = Array.isArray(context.upcomingAppointments)
      ? (context.upcomingAppointments as Record<string, unknown>[])
      : [];
    const waitlist = Array.isArray(context.waitlist)
      ? (context.waitlist as Record<string, unknown>[])
      : [];
    const next = upcoming[0];

    if (message.includes('next appointment') || message.includes('upcoming')) {
      if (!next) {
        return {
          message: 'You do not have any upcoming appointments right now. You can book a new appointment when ready.',
          actions: [
            { type: 'openUrl', label: 'Book appointment', payload: { href: bookingPagePath(catalog.organization.slug) } },
          ],
          quickReplies: ['Show waitlist'],
        };
      }
      const startUtc = typeof next.startUtc === 'string' ? next.startUtc : '';
      const service = typeof next.service === 'string' ? next.service : 'your appointment';
      const provider = typeof next.provider === 'string' ? next.provider : 'your staff member';
      const when = startUtc
        ? DateTime.fromISO(startUtc, { zone: 'utc' })
            .setZone(catalog.location.timezone)
            .toFormat('EEE, MMM d, h:mm a')
        : 'soon';
      const manageToken = typeof next.manageToken === 'string' ? next.manageToken : '';
      return {
        message: `Your next appointment is ${service} with ${provider} on ${when}.`,
        actions: manageToken
          ? [{ type: 'openUrl', label: 'Manage appointment', payload: { href: `/manage/${manageToken}` } }]
          : [],
        quickReplies: ['How do I reschedule?'],
      };
    }

    if (message.includes('reschedule')) {
      if (!next || typeof next.manageToken !== 'string') {
        return {
          message: 'I do not see an upcoming appointment to reschedule. You can book a new appointment instead.',
          actions: [
            { type: 'openUrl', label: 'Book appointment', payload: { href: bookingPagePath(catalog.organization.slug) } },
          ],
          quickReplies: [],
        };
      }
      return {
        message: 'To reschedule, open the appointment details and choose a new available time. You will still confirm the change yourself.',
        actions: [
          {
            type: 'openUrl',
            label: 'Open reschedule',
            payload: { href: `/manage/${String(next.manageToken)}?reschedule=1` },
          },
        ],
        quickReplies: ['When is my next appointment?'],
      };
    }

    if (message.includes('waitlist')) {
      if (waitlist.length === 0) {
        return {
          message: 'You are not currently on any waitlists.',
          actions: [
            { type: 'openUrl', label: 'Book appointment', payload: { href: bookingPagePath(catalog.organization.slug) } },
          ],
          quickReplies: [],
        };
      }
      const first = waitlist[0];
      const service = typeof first.service === 'object' && first.service && 'name' in first.service
        ? String((first.service as { name?: unknown }).name ?? 'a service')
        : 'a service';
      return {
        message: `You are on ${waitlist.length} waitlist${waitlist.length === 1 ? '' : 's'}. The first one is for ${service}. We will notify you if a matching slot opens.`,
        actions: [],
        quickReplies: ['How do I reschedule?'],
      };
    }

    if (message.includes('book') || message.includes('new appointment')) {
      return {
        message: 'You can book another appointment from the public booking page, or I can guide the booking here in chat.',
        actions: [
          { type: 'startChatBooking', label: 'Book with me', payload: { locationId: catalog.location.id } },
          { type: 'openUrl', label: 'Book appointment', payload: { href: bookingPagePath(catalog.organization.slug) } },
        ],
        quickReplies: ['When is my next appointment?'],
      };
    }

    return null;
  }

  private contextActions(dto: CustomerAssistantDto, catalog: CatalogContext): AssistantAction[] {
    if (!dto.state?.serviceId) {
      return catalog.services.slice(0, 4).map((service) => ({
        type: 'selectService',
        label: service.name,
        payload: { serviceId: service.id },
      }));
    }
    if (!dto.state.providerId) {
      const service = catalog.services.find((item) => item.id === dto.state?.serviceId);
      return service ? this.providerActions(service, catalog) : [];
    }
    if (dto.step === 'dateTime') {
      if (!dto.state.selectedDate) {
        return [
          {
            type: 'selectDate',
            label: `Use today (${this.today(catalog.location.timezone)})`,
            payload: { date: this.today(catalog.location.timezone) },
          },
        ];
      }
      return [];
    }
    if (dto.step === 'details') {
      return dto.state?.hasCustomerDetails
        ? [{ type: 'goToStep', label: 'Review booking', payload: { step: 'confirm' } }]
        : [];
    }
    if (dto.step === 'confirm' && !dto.state?.hasCustomerDetails) {
      return [{ type: 'goToStep', label: 'Go to details', payload: { step: 'details' } }];
    }
    return [{ type: 'goToStep', label: 'Go to date and time', payload: { step: 'dateTime' } }];
  }

  private sanitizeActions(dto: CustomerAssistantDto, actions: AssistantAction[]): AssistantAction[] {
    const currentStep = dto.step;
    const current = dto.state ?? {};
    const seen = new Set<string>();
    const filtered = actions.filter((action) => {
      if (action.type === 'goToStep' && action.payload.step === currentStep) return false;
      if (action.type === 'selectService' && action.payload.serviceId === current.serviceId) return false;
      if (action.type === 'selectProvider' && action.payload.providerId === current.providerId) return false;
      if (action.type === 'selectDate' && action.payload.date === current.selectedDate) return false;
      if (action.type === 'selectSlot' && action.payload.startUtc === current.startUtc) return false;
      const key = `${action.type}:${JSON.stringify(action.payload)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const slotActions = filtered.filter((action) => action.type === 'selectSlot').slice(0, 4);
    const otherActions = filtered.filter((action) => action.type !== 'selectSlot').slice(0, 3);
    return [...slotActions, ...otherActions].slice(0, 5);
  }

  private providerActions(service: ServiceOption, catalog: CatalogContext): AssistantAction[] {
    const providers = catalog.providers.filter((provider) => service.providerIds.includes(provider.id));
    return [
      ...providers.slice(0, 5).map((provider) => ({
        type: 'selectProvider' as const,
        label: provider.name,
        payload: { providerId: provider.id },
      })),
      { type: 'selectProvider', label: 'Any available staff', payload: { providerId: 'any' } },
    ];
  }

  private localIntent(dto: CustomerAssistantDto, catalog: CatalogContext): RawAssistantIntent {
    const message = dto.message.toLowerCase();
    return {
      serviceId: this.bestLocalService(message, catalog.services)?.id ?? null,
      providerId: this.bestLocalProvider(message, catalog.providers)?.id ?? null,
      date: this.resolveDate(null, message, catalog.location.timezone),
      timeOfDay: this.extractTimeOfDay(message),
      reply: 'I checked the live booking options and prepared safe suggestions below.',
    };
  }

  private resolveService(
    rawServiceId: unknown,
    currentServiceId: string | undefined,
    requestedWords: string[],
    catalog: CatalogContext,
  ): ServiceOption | null {
    const fromRaw =
      typeof rawServiceId === 'string'
        ? catalog.services.find((service) => service.id === rawServiceId)
        : null;
    const fromCurrent = currentServiceId
      ? catalog.services.find((service) => service.id === currentServiceId)
      : null;
    const candidate = fromRaw ?? fromCurrent ?? null;
    if (!candidate) return null;
    if (requestedWords.length === 0) return candidate;
    const score = this.serviceScore(requestedWords, candidate);
    const best = this.bestLocalService(requestedWords.join(' '), catalog.services);
    if (best && best.id === candidate.id && score > 0) return candidate;
    return score >= Math.min(2, requestedWords.length) ? candidate : null;
  }

  private resolveProvider(
    rawProviderId: unknown,
    currentProviderId: string | undefined,
    serviceId: string | undefined,
    catalog: CatalogContext,
  ): ProviderOption | null {
    const id =
      rawProviderId === 'any'
        ? null
        : typeof rawProviderId === 'string'
          ? rawProviderId
          : currentProviderId && currentProviderId !== 'any'
            ? currentProviderId
            : null;
    if (!id) return null;
    const provider = catalog.providers.find((item) => item.id === id);
    if (!provider) return null;
    if (serviceId && !provider.serviceIds.includes(serviceId)) return null;
    return provider;
  }

  private bestLocalService(query: string, services: ServiceOption[]): ServiceOption | null {
    const words = this.significantWords(query);
    if (words.length === 0) return null;
    const scored = services
      .map((service) => ({ service, score: this.serviceScore(words, service) }))
      .sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].service : null;
  }

  private bestLocalProvider(query: string, providers: ProviderOption[]): ProviderOption | null {
    const normalized = query.toLowerCase();
    return providers.find((provider) => normalized.includes(provider.name.toLowerCase())) ?? null;
  }

  private serviceScore(words: string[], service: ServiceOption): number {
    const haystack = `${service.name} ${service.description ?? ''}`.toLowerCase();
    return words.filter((word) => haystack.includes(word)).length;
  }

  private looksLikeServiceRequest(query: string, catalog: CatalogContext): boolean {
    const words = this.significantWords(query);
    if (words.length === 0) return false;
    if (this.bestLocalService(query, catalog.services)) return false;
    return words.some((word) => !GENERIC_SERVICE_WORDS.has(word));
  }

  private significantWords(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !GENERIC_SERVICE_WORDS.has(word));
  }

  private resolveDate(rawDate: unknown, query: string, timezone: string): string | null {
    if (typeof rawDate === 'string') {
      const normalized = this.normalizeDate(rawDate, timezone);
      if (normalized) return normalized;
    }
    return this.normalizeDate(query, timezone);
  }

  private normalizeDate(value: string, timezone: string): string | null {
    const lower = value.toLowerCase();
    const today = DateTime.now().setZone(timezone).startOf('day');
    if (lower.includes('today')) return today.toISODate() ?? null;
    if (lower.includes('tomorrow')) return today.plus({ days: 1 }).toISODate() ?? null;
    if (lower.includes('weekend')) {
      const daysUntilSaturday = (6 - today.weekday + 7) % 7 || 7;
      return today.plus({ days: daysUntilSaturday }).toISODate() ?? null;
    }
    const weekday = Object.entries(WEEKDAY_INDEX).find(([label]) =>
      new RegExp(`\\b${label}\\b`).test(lower),
    );
    if (weekday) {
      const [, targetWeekday] = weekday;
      const forceNext = lower.includes('next ');
      let days = (targetWeekday - today.weekday + 7) % 7;
      if (days === 0 || forceNext) days += 7;
      return today.plus({ days }).toISODate() ?? null;
    }
    const iso = lower.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (iso) return iso[0];
    return null;
  }

  private nextDay(date: string, timezone: string): string {
    return DateTime.fromISO(date, { zone: timezone }).plus({ days: 1 }).toISODate() ?? date;
  }

  private today(timezone: string): string {
    return DateTime.now().setZone(timezone).toISODate() ?? new Date().toISOString().slice(0, 10);
  }

  private extractTimeOfDay(query: string): string | null {
    const lower = query.toLowerCase();
    if (lower.includes('morning')) return 'morning';
    if (lower.includes('afternoon')) return 'afternoon';
    if (lower.includes('evening')) return 'evening';
    if (lower.includes('before noon')) return 'morning';
    if (lower.includes('lunch')) return 'afternoon';
    if (lower.includes('after 5')) return 'after 5 pm';
    if (lower.includes('after five')) return 'after 5 pm';
    const after = lower.match(/\bafter\s+(\d{1,2})(?::\d{2})?\s*(am|pm)?\b/);
    const before = lower.match(/\bbefore\s+(\d{1,2})(?::\d{2})?\s*(am|pm)?\b/);
    if (after && before) return `${after[0]} ${before[0]}`;
    if (after) return after[0];
    if (before) return before[0];
    const time = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    return time?.[0] ?? null;
  }

  private matchesTimePreference(startUtc: string, timezone: string, timeOfDay: string | null): boolean {
    if (!timeOfDay) return true;
    const hour = DateTime.fromISO(startUtc, { zone: 'utc' }).setZone(timezone).hour;
    const normalized = timeOfDay.toLowerCase();
    if (normalized.includes('morning')) return hour >= 6 && hour < 12;
    if (normalized.includes('afternoon')) return hour >= 12 && hour < 17;
    if (normalized.includes('evening')) return hour >= 17 && hour < 21;
    const after = normalized.match(/after\s+(\d{1,2})/);
    const before = normalized.match(/before\s+(\d{1,2})/);
    if (after && before) {
      const afterThreshold = this.timeThreshold(Number(after[1]), normalized);
      const beforeThreshold = this.timeThreshold(Number(before[1]), normalized);
      return hour >= afterThreshold && hour < beforeThreshold;
    }
    if (after) {
      const threshold = this.timeThreshold(Number(after[1]), normalized);
      return hour >= threshold;
    }
    if (before) {
      const threshold = this.timeThreshold(Number(before[1]), normalized);
      return hour < threshold;
    }
    const exact = normalized.match(/\b(\d{1,2})(?::\d{2})?\s*(am|pm)\b/);
    if (exact) {
      const raw = Number(exact[1]);
      const threshold = exact[2] === 'pm' && raw < 12 ? raw + 12 : raw;
      return hour >= threshold;
    }
    return true;
  }

  private timeThreshold(raw: number, text: string): number {
    if (text.includes('pm') && raw < 12) return raw + 12;
    if (!text.includes('am') && !text.includes('pm') && raw >= 1 && raw <= 7) return raw + 12;
    return raw;
  }

  private wantsEarliest(query: string): boolean {
    const lower = query.toLowerCase();
    return (
      lower.includes('earliest') ||
      lower.includes('first available') ||
      lower.includes('soonest') ||
      lower.includes('as soon as possible') ||
      lower.includes('asap') ||
      lower.includes('any slot') ||
      lower.includes('next available')
    );
  }

  private isBookingRequest(message: string): boolean {
    const lower = message.toLowerCase();
    const hasBook = /\bbook\b/.test(lower);
    const hasAppointmentWord = /\b(appointments?|appintments?|apointments?)\b/.test(lower);
    return (
      (hasBook && hasAppointmentWord) ||
      lower.includes('book with me') ||
      lower.includes('book it') ||
      lower.includes('book this') ||
      lower.includes('can i book') ||
      lower.includes('can you book') ||
      lower.includes('i want to book') ||
      lower.includes('want a booking') ||
      lower.includes('make a booking') ||
      lower.includes('new appointment')
    );
  }

  private quickReplies(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return ['What should I click next?', 'Suggest a slot today'];
    }
    return value.filter((item): item is string => typeof item === 'string').slice(0, 2);
  }

  private isHelpRequest(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('stuck') ||
      lower.includes('what do i do') ||
      lower.includes('what to do') ||
      lower.includes('what should i') ||
      lower.includes('now what') ||
      lower.includes('what now') ||
      lower.includes('what next') ||
      lower.includes("what's next") ||
      lower.includes('what is next') ||
      lower.includes('next step') ||
      lower.includes('where am i') ||
      lower.includes('help') ||
      lower.includes('guide')
    );
  }
}
