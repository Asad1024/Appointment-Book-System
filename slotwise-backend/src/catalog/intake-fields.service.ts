import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IntakeFieldType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type IntakeFieldPayload = {
  label: string;
  helpText?: string;
  type: IntakeFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
};

@Injectable()
export class IntakeFieldsService {
  private readonly logger = new Logger(IntakeFieldsService.name);

  constructor(private prisma: PrismaService) {}

  serializeField(field: {
    id: string;
    label: string;
    helpText: string | null;
    type: IntakeFieldType;
    options: Prisma.JsonValue;
    required: boolean;
    order: number;
  }) {
    const options = Array.isArray(field.options)
      ? (field.options as string[])
      : field.options
        ? (JSON.parse(JSON.stringify(field.options)) as string[])
        : null;
    return {
      id: field.id,
      label: field.label,
      helpText: field.helpText,
      type: field.type,
      options,
      required: field.required,
      order: field.order,
    };
  }

  async listForService(serviceId: string) {
    const fields = await this.prisma.intakeField.findMany({
      where: { serviceId },
      orderBy: { order: 'asc' },
    });
    return fields.map((f) => this.serializeField(f));
  }

  private validateOptions(type: IntakeFieldType, options?: string[]) {
    if (type === IntakeFieldType.select || type === IntakeFieldType.checkbox) {
      if (!options || options.length < 2) {
        throw new BadRequestException('At least 2 options are required for select and checkbox fields');
      }
    }
  }

  async assertServiceInOrg(serviceId: string, orgId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, location: { organizationId: orgId } },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(serviceId: string, orgId: string, body: IntakeFieldPayload) {
    await this.assertServiceInOrg(serviceId, orgId);
    this.validateOptions(body.type, body.options);
    const maxOrder = await this.prisma.intakeField.aggregate({
      where: { serviceId },
      _max: { order: true },
    });
    const field = await this.prisma.intakeField.create({
      data: {
        serviceId,
        label: body.label.trim(),
        helpText: body.helpText?.trim() || null,
        type: body.type,
        options: body.options ?? Prisma.JsonNull,
        required: body.required ?? false,
        order: body.order ?? (maxOrder._max.order ?? -1) + 1,
      },
    });
    return this.serializeField(field);
  }

  async update(fieldId: string, orgId: string, body: Partial<IntakeFieldPayload>) {
    const field = await this.prisma.intakeField.findFirst({
      where: { id: fieldId, service: { location: { organizationId: orgId } } },
    });
    if (!field) throw new NotFoundException('Intake field not found');

    const type = body.type ?? field.type;
    const options =
      body.options !== undefined
        ? body.options
        : Array.isArray(field.options)
          ? (field.options as string[])
          : undefined;
    if (body.type !== undefined || body.options !== undefined) {
      this.validateOptions(type, options);
    }

    const updated = await this.prisma.intakeField.update({
      where: { id: fieldId },
      data: {
        ...(body.label !== undefined ? { label: body.label.trim() } : {}),
        ...(body.helpText !== undefined ? { helpText: body.helpText?.trim() || null } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.options !== undefined ? { options: body.options ?? Prisma.JsonNull } : {}),
        ...(body.required !== undefined ? { required: body.required } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
    });
    return this.serializeField(updated);
  }

  async delete(fieldId: string, orgId: string) {
    const field = await this.prisma.intakeField.findFirst({
      where: { id: fieldId, service: { location: { organizationId: orgId } } },
      include: { _count: { select: { responses: true } } },
    });
    if (!field) throw new NotFoundException('Intake field not found');
    if (field._count.responses > 0) {
      this.logger.warn(
        `Deleting intake field ${fieldId} with ${field._count.responses} existing response(s)`,
      );
    }
    await this.prisma.intakeField.delete({ where: { id: fieldId } });
    return { ok: true };
  }

  async reorder(serviceId: string, orgId: string, orderedIds: string[]) {
    await this.assertServiceInOrg(serviceId, orgId);
    const fields = await this.prisma.intakeField.findMany({ where: { serviceId } });
    const idSet = new Set(fields.map((f) => f.id));
    if (orderedIds.length !== fields.length || !orderedIds.every((id) => idSet.has(id))) {
      throw new BadRequestException('orderedIds must include every field for this service exactly once');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.intakeField.update({ where: { id }, data: { order: index } }),
      ),
    );
    return this.listForService(serviceId);
  }
}
