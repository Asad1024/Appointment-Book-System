import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isPlatformOrgSlug } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import type { BookingHelperDto } from './dto/booking-helper.dto';

type ServiceOption = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  providerIds: string[];
};

type ProviderOption = {
  id: string;
  name: string;
  serviceIds: string[];
};

type RawAiSuggestion = {
  serviceId?: unknown;
  providerId?: unknown;
  date?: unknown;
  timeOfDay?: unknown;
  explanation?: unknown;
};

type BookingHelperSuggestion = {
  serviceId: string | null;
  providerId: string | null;
  date: string | null;
  timeOfDay: string | null;
  explanation: string;
};

@Injectable()
export class AiBookingHelperService {
  private readonly logger = new Logger(AiBookingHelperService.name);

  constructor(private prisma: PrismaService) {}

  async suggest(dto: BookingHelperDto): Promise<BookingHelperSuggestion> {
    const catalog = await this.loadCatalog(dto);
    if (catalog.services.length === 0) {
      throw new BadRequestException('No active services are available for this location');
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('AI booking helper is not configured');
    }

    const fallback = this.fallbackSuggestion(dto.query, catalog.services, catalog.providers);
    try {
      const raw = await this.askOpenAi({
        apiKey,
        query: dto.query,
        today: dto.today,
        timezone: dto.customerTimezone ?? catalog.timezone,
        services: catalog.services,
        providers: catalog.providers,
      });
      return this.normalizeSuggestion(raw, catalog.services, catalog.providers, fallback);
    } catch (error) {
      this.logger.warn(`OpenAI booking helper failed: ${String(error)}`);
      return fallback;
    }
  }

  private async loadCatalog(dto: BookingHelperDto): Promise<{
    timezone: string;
    services: ServiceOption[];
    providers: ProviderOption[];
  }> {
    const org = await this.prisma.organization.findUnique({
      where: { slug: dto.org.trim() },
      include: {
        locations: { orderBy: { name: 'asc' } },
      },
    });

    if (!org || isPlatformOrgSlug(org.slug)) {
      throw new BadRequestException('Organization not found');
    }
    if (!org.isActive) {
      throw new BadRequestException('This organization is not accepting bookings');
    }
    const location =
      (dto.locationId ? org.locations.find((loc) => loc.id === dto.locationId) : undefined) ??
      org.locations[0];
    if (!location) {
      throw new BadRequestException('No location configured');
    }

    const [services, providers] = await Promise.all([
      this.prisma.service.findMany({
        where: {
          organizationId: org.id,
          locationId: location.id,
          isActive: true,
          archivedAt: null,
        },
        include: {
          serviceProviders: {
            include: {
              provider: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                  archivedAt: true,
                },
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
                select: {
                  id: true,
                  isActive: true,
                  archivedAt: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      timezone: location.timezone,
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        providerIds: service.serviceProviders
          .filter((link) => link.provider.isActive && !link.provider.archivedAt)
          .map((link) => link.provider.id),
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

  private async askOpenAi(params: {
    apiKey: string;
    query: string;
    today?: string;
    timezone: string;
    services: ServiceOption[];
    providers: ProviderOption[];
  }): Promise<RawAiSuggestion> {
    const model = process.env.OPENAI_BOOKING_HELPER_MODEL?.trim() || 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You help customers choose an appointment service, provider, and rough date/time. Return only JSON with keys serviceId, providerId, date, timeOfDay, explanation. Use only the provided ids. Use providerId "any" if the customer does not need a specific provider. Use YYYY-MM-DD for date or null. Do not invent availability.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              customerRequest: params.query,
              today: params.today ?? null,
              timezone: params.timezone,
              services: params.services.map((service) => ({
                id: service.id,
                name: service.name,
                description: service.description,
                durationMinutes: service.durationMinutes,
                providerIds: service.providerIds,
              })),
              providers: params.providers.map((provider) => ({
                id: provider.id,
                name: provider.name,
                serviceIds: provider.serviceIds,
              })),
            }),
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI returned ${response.status}`);
    }
    const body = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned an empty response');
    return JSON.parse(content) as RawAiSuggestion;
  }

  private normalizeSuggestion(
    raw: RawAiSuggestion,
    services: ServiceOption[],
    providers: ProviderOption[],
    fallback: BookingHelperSuggestion,
  ): BookingHelperSuggestion {
    const serviceIds = new Set(services.map((service) => service.id));
    const providerIds = new Set(providers.map((provider) => provider.id));

    const serviceId = typeof raw.serviceId === 'string' && serviceIds.has(raw.serviceId)
      ? raw.serviceId
      : fallback.serviceId;

    const selectedService = services.find((service) => service.id === serviceId);
    const providerId =
      raw.providerId === 'any'
        ? 'any'
        : typeof raw.providerId === 'string' &&
            providerIds.has(raw.providerId) &&
            (!selectedService || selectedService.providerIds.includes(raw.providerId))
          ? raw.providerId
          : fallback.providerId;

    return {
      serviceId,
      providerId,
      date: this.normalizeIsoDate(raw.date) ?? fallback.date,
      timeOfDay: typeof raw.timeOfDay === 'string' ? raw.timeOfDay.slice(0, 80) : fallback.timeOfDay,
      explanation:
        typeof raw.explanation === 'string' && raw.explanation.trim()
          ? raw.explanation.trim().slice(0, 240)
          : fallback.explanation,
    };
  }

  private fallbackSuggestion(
    query: string,
    services: ServiceOption[],
    providers: ProviderOption[],
  ): BookingHelperSuggestion {
    const normalized = query.toLowerCase();
    const scored = services
      .map((service) => {
        const haystack = `${service.name} ${service.description ?? ''}`.toLowerCase();
        const score = haystack
          .split(/\W+/)
          .filter((word) => word.length > 2 && normalized.includes(word)).length;
        return { service, score };
      })
      .sort((a, b) => b.score - a.score);
    const service = scored[0]?.score > 0 ? scored[0].service : services[0];
    const provider =
      providers.find((item) => service.providerIds.includes(item.id)) ?? providers[0];

    return {
      serviceId: service?.id ?? null,
      providerId: provider ? 'any' : null,
      date: this.normalizeIsoDate(query),
      timeOfDay: this.extractTimeOfDay(query),
      explanation: service
        ? `I matched your request to ${service.name}. Pick a time that works for you.`
        : 'I could not confidently match a service, but you can continue manually.',
    };
  }

  private normalizeIsoDate(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const match = value.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (!match) return null;
    const date = new Date(`${match[0]}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    return match[0];
  }

  private extractTimeOfDay(query: string): string | null {
    const lower = query.toLowerCase();
    if (lower.includes('morning')) return 'morning';
    if (lower.includes('afternoon')) return 'afternoon';
    if (lower.includes('evening')) return 'evening';
    if (lower.includes('night')) return 'night';
    const time = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
    return time?.[0] ?? null;
  }
}
