import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IntakeFieldType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type IntakeResponseInput = { fieldId: string; value: string };

@Injectable()
export class IntakeValidationService {
  constructor(private prisma: PrismaService) {}

  async validateAndPrepare(
    serviceId: string,
    intakeResponses?: IntakeResponseInput[],
  ): Promise<{ fieldId: string; value: string }[]> {
    const fields = await this.prisma.intakeField.findMany({
      where: { serviceId },
      orderBy: { order: 'asc' },
    });
    if (fields.length === 0) return [];

    const responseMap = new Map(
      (intakeResponses ?? []).map((r) => [r.fieldId, r.value]),
    );
    const errors: Record<string, string> = {};

    for (const field of fields) {
      const raw = responseMap.get(field.id);
      const value = raw?.trim() ?? '';
      if (field.required && this.isEmptyValue(field.type, value)) {
        errors[field.id] = `${field.label} is required`;
        continue;
      }
      if (!value) continue;

      if (field.type === IntakeFieldType.number && Number.isNaN(Number(value))) {
        errors[field.id] = `${field.label} must be a number`;
      }
      if (field.type === IntakeFieldType.select) {
        const opts = this.parseOptions(field.options);
        if (!opts.includes(value)) {
          errors[field.id] = `Invalid option for ${field.label}`;
        }
      }
      if (field.type === IntakeFieldType.checkbox) {
        const parsed = this.parseCheckboxValue(value);
        if (!parsed.ok) {
          errors[field.id] = `${field.label} must be a valid selection`;
          continue;
        }
        const opts = this.parseOptions(field.options);
        if (parsed.values.some((v) => !opts.includes(v))) {
          errors[field.id] = `Invalid option for ${field.label}`;
        }
      }
    }

    const unknownIds = (intakeResponses ?? [])
      .map((r) => r.fieldId)
      .filter((id) => !fields.some((f) => f.id === id));
    if (unknownIds.length > 0) {
      throw new BadRequestException({ message: 'Unknown intake field(s)', fieldErrors: errors });
    }

    if (Object.keys(errors).length > 0) {
      throw new BadRequestException({ message: 'Intake validation failed', fieldErrors: errors });
    }

    return fields
      .map((f) => {
        const value = responseMap.get(f.id)?.trim() ?? '';
        return value ? { fieldId: f.id, value } : null;
      })
      .filter((r): r is { fieldId: string; value: string } => r !== null);
  }

  private parseOptions(options: Prisma.JsonValue): string[] {
    if (Array.isArray(options)) return options as string[];
    return [];
  }

  private isEmptyValue(type: IntakeFieldType, value: string): boolean {
    if (!value) return true;
    if (type === IntakeFieldType.checkbox) {
      const parsed = this.parseCheckboxValue(value);
      return !parsed.ok || parsed.values.length === 0;
    }
    return false;
  }

  private parseCheckboxValue(value: string): { ok: true; values: string[] } | { ok: false } {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === 'string')) {
        return { ok: false };
      }
      return { ok: true, values: parsed };
    } catch {
      return { ok: false };
    }
  }

  /** Parse intake JSON stored on Stripe checkout metadata. */
  parseFromMetadata(raw?: string): IntakeResponseInput[] | undefined {
    if (!raw?.trim()) return undefined;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return undefined;
      return parsed as IntakeResponseInput[];
    } catch {
      return undefined;
    }
  }

  async createResponses(
    tx: Prisma.TransactionClient,
    appointmentId: string,
    responses: { fieldId: string; value: string }[],
  ) {
    if (responses.length === 0) return;
    await tx.intakeResponse.createMany({
      data: responses.map((r) => ({
        appointmentId,
        fieldId: r.fieldId,
        value: r.value,
      })),
    });
  }

  async formatResponsesForDetail(appointmentId: string) {
    const rows = await this.prisma.intakeResponse.findMany({
      where: { appointmentId },
      include: { field: { select: { label: true, type: true, order: true } } },
    });
    rows.sort((a, b) => a.field.order - b.field.order);
    return rows.map((r) => ({
      fieldLabel: r.field.label,
      fieldType: r.field.type,
      value: r.value,
    }));
  }
}
