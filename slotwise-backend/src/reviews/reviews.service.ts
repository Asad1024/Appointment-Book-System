import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  private async findAppointmentByManageToken(manageToken: string) {
    const appt = await this.prisma.appointment.findUnique({
      where: { manageToken },
      include: {
        review: true,
        customer: true,
        location: {
          include: {
            organization: { select: { isActive: true } },
          },
        },
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (!appt.location.organization?.isActive) {
      throw new ForbiddenException('This business is no longer accepting bookings');
    }
    return appt;
  }

  async createByManageToken(manageToken: string, dto: CreateReviewDto) {
    const appt = await this.findAppointmentByManageToken(manageToken);
    if (appt.status !== AppointmentStatus.COMPLETED) {
      throw new BadRequestException('You can only review completed appointments');
    }
    if (appt.review) throw new ConflictException('You have already submitted a review');

    return this.prisma.review.create({
      data: {
        appointmentId: appt.id,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
        customerName: dto.customerName?.trim() || appt.customer.name,
      },
    });
  }

  async getByManageToken(manageToken: string) {
    const appt = await this.findAppointmentByManageToken(manageToken);
    return {
      canReview: appt.status === AppointmentStatus.COMPLETED && !appt.review,
      review: appt.review,
    };
  }

  async listForOrganization(organizationId: string, limit = 20) {
    return this.prisma.review.findMany({
      where: { appointment: { organizationId } },
      include: {
        appointment: {
          select: {
            id: true,
            startUtc: true,
            service: { select: { name: true } },
            provider: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
