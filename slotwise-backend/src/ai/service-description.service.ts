import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ServiceDescriptionDto } from './dto/service-description.dto';

const SERVICE_DESCRIPTION_MAX_LENGTH = 180;
const SERVICE_DESCRIPTION_TARGET_LENGTH = 160;

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

@Injectable()
export class ServiceDescriptionService {
  async generate(dto: ServiceDescriptionDto) {
    const serviceName = dto.name.trim();
    if (!serviceName) {
      throw new BadRequestException('Service name is required');
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('OpenAI API key is not configured');
    }

    const description = await this.requestDescription(apiKey, [
      {
        role: 'system',
        content:
          'Write concise, polished booking service descriptions for a business website. Return only the description, no labels or quotes.',
      },
      {
        role: 'user',
        content: `Service name: ${serviceName}
Current description: ${dto.currentDescription?.trim() || 'None'}

Write exactly one complete customer-facing sentence under ${SERVICE_DESCRIPTION_TARGET_LENGTH} characters. Do not exceed the limit. Focus on the value, not internal operations.`,
      },
    ]);

    const cleanDescription = this.cleanDescription(description);
    if (cleanDescription.length <= SERVICE_DESCRIPTION_MAX_LENGTH) {
      return { description: cleanDescription };
    }

    const shortened = await this.requestDescription(apiKey, [
      {
        role: 'system',
        content:
          'Shorten booking service descriptions. Return one complete sentence only, no labels or quotes.',
      },
      {
        role: 'user',
        content: `Rewrite this as one complete customer-facing sentence under ${SERVICE_DESCRIPTION_TARGET_LENGTH} characters:
${cleanDescription}`,
      },
    ]);

    return { description: this.ensureCompleteWithinLimit(shortened, serviceName) };
  }

  private async requestDescription(
    apiKey: string,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.45,
        max_tokens: 60,
        messages,
      }),
    });

    const payload = (await response.json().catch(() => null)) as OpenAiChatResponse | null;
    if (!response.ok) {
      throw new ServiceUnavailableException(
        payload?.error?.message ?? 'Failed to generate service description',
      );
    }

    const description = payload?.choices?.[0]?.message?.content?.trim();
    if (!description) {
      throw new ServiceUnavailableException('OpenAI returned an empty description');
    }

    return description;
  }

  private cleanDescription(description: string) {
    return description
      .replace(/^["']|["']$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private ensureCompleteWithinLimit(description: string, serviceName: string) {
    const cleaned = this.cleanDescription(description);
    if (cleaned.length <= SERVICE_DESCRIPTION_MAX_LENGTH) {
      return this.ensureTerminalPunctuation(cleaned);
    }

    const completeSentence = cleaned
      .match(/[^.!?]+[.!?]/g)
      ?.map((sentence) => sentence.trim())
      .find((sentence) => sentence.length <= SERVICE_DESCRIPTION_MAX_LENGTH);
    if (completeSentence) {
      return completeSentence;
    }

    const fallback = `Book ${serviceName} for expert support tailored to your needs.`;
    if (fallback.length <= SERVICE_DESCRIPTION_MAX_LENGTH) {
      return fallback;
    }

    const shortenedName = serviceName.slice(0, 80).trim();
    return `Book ${shortenedName} for expert support.`;
  }

  private ensureTerminalPunctuation(description: string) {
    return /[.!?]$/.test(description) ? description : `${description}.`;
  }
}
