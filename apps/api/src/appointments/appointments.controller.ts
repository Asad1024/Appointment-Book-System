import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentSource, AppointmentStatus, UserRole } from '@pkg/shared-types';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotesService } from './appointment-notes.service';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { RescheduleDto } from './dto/reschedule.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { WaitlistDto } from './dto/waitlist.dto';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const STAFF = [
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.LOCATION_MANAGER,
  UserRole.PROVIDER,
];

const MANAGERS = [
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.LOCATION_MANAGER,
];

function providerScope(req: {
  user: { role: string; providerId?: string | null };
}): string | undefined {
  if (req.user.role === UserRole.PROVIDER) {
    if (!req.user.providerId) {
      throw new ForbiddenException('No provider profile linked to this account');
    }
    return req.user.providerId;
  }
  return undefined;
}

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private appointments: AppointmentsService,
    private notes: AppointmentNotesService,
  ) {}

  @Public()
  @Post('book')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  book(@Body() dto: BookAppointmentDto) {
    return this.appointments.book(dto);
  }

  @Public()
  @Post('book/checkout-complete')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  bookCheckoutComplete(@Body() body: { sessionId: string }) {
    return this.appointments.bookFromCheckout(body.sessionId);
  }

  @Public()
  @Post('waitlist')
  joinWaitlist(@Body() dto: WaitlistDto) {
    return this.appointments.joinWaitlist(dto);
  }

  @Public()
  @Get('manage/:token')
  getByToken(@Param('token') token: string) {
    return this.appointments.getByManageToken(token);
  }

  @Public()
  @Get('manage/:token/calendar.ics')
  async getCalendarIcs(@Param('token') token: string, @Res() res: Response) {
    const { filename, content } = await this.appointments.getIcsByManageToken(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Public()
  @Post('manage/:token/cancel')
  cancel(@Param('token') token: string) {
    return this.appointments.cancel(token);
  }

  @Public()
  @Post('manage/:token/reschedule')
  reschedule(@Param('token') token: string, @Body() dto: RescheduleDto) {
    return this.appointments.reschedule(token, dto.startUtc);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Post('admin/book')
  adminBook(
    @Body() dto: BookAppointmentDto,
    @Req() req: { user: { id: string; email: string } },
  ) {
    return this.appointments.book(dto, AppointmentSource.ADMIN, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGERS)
  @Get('waitlist')
  listWaitlist(
    @Req() req: { user: { orgId: string } },
    @Query('locationId') locationId?: string,
  ) {
    return this.appointments.listWaitlist(req.user.orgId, locationId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('admin')
  listAdmin(
    @Req() req: { user: { orgId: string; providerId?: string | null; role: string } },
    @Query('locationId') locationId?: string,
    @Query('providerId') providerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scopedProviderId =
      req.user.providerId && req.user.role === UserRole.PROVIDER
        ? req.user.providerId
        : providerId;
    return this.appointments.listForAdmin(req.user.orgId, {
      locationId,
      providerId: scopedProviderId,
      from: startDate ?? dateFrom ?? from,
      to: endDate ?? dateTo ?? to,
      status,
      page: Math.max(1, parseInt(page ?? '1', 10) || 1),
      limit: Math.min(500, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.LOCATION_MANAGER)
  @Get('admin/export')
  async export(
    @Req() req: { user: { orgId: string } },
    @Query('format') format?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.appointments.exportData(req.user.orgId, {
      format,
      from: dateFrom,
      to: dateTo,
    });
    if (format === 'csv' && result && 'csv' in result) {
      res?.setHeader('Content-Type', 'text/csv');
      res?.setHeader(
        'Content-Disposition',
        `attachment; filename="${(result as { filename: string }).filename}"`,
      );
      return (result as { csv: string }).csv;
    }
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get('admin/:id')
  getAdmin(
    @Req() req: { user: { orgId: string; role: string; id: string; providerId?: string | null } },
    @Param('id') id: string,
  ) {
    return this.appointments.getAdminDetail(
      id,
      req.user.orgId,
      providerScope(req),
      { id: req.user.id, role: req.user.role },
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Get(':id/notes')
  listNotes(
    @Req() req: { user: { orgId: string; role: string; id: string; providerId?: string | null } },
    @Param('id') id: string,
  ) {
    return this.notes.list(id, req.user.orgId, { id: req.user.id, role: req.user.role }, providerScope(req));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Post(':id/notes')
  createNote(
    @Req() req: {
      user: { orgId: string; role: string; id: string; providerId?: string | null };
    },
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.notes.create(id, req.user.orgId, req.user.id, body.content ?? '', providerScope(req));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch(':id/notes/:noteId')
  updateNote(
    @Req() req: {
      user: { orgId: string; role: string; id: string; providerId?: string | null };
    },
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() body: { content: string },
  ) {
    return this.notes.update(
      id,
      noteId,
      req.user.orgId,
      { id: req.user.id, role: req.user.role },
      body.content ?? '',
      providerScope(req),
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Delete(':id/notes/:noteId')
  deleteNote(
    @Req() req: {
      user: { orgId: string; role: string; id: string; providerId?: string | null };
    },
    @Param('id') id: string,
    @Param('noteId') noteId: string,
  ) {
    return this.notes.delete(
      id,
      noteId,
      req.user.orgId,
      { id: req.user.id, role: req.user.role },
      providerScope(req),
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch('admin/:id/status')
  updateStatus(
    @Req() req: {
      user: { orgId: string; id: string; email: string; role: string; providerId?: string | null };
    },
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.appointments.updateStatus(
      id,
      req.user.orgId,
      dto.status as AppointmentStatus,
      { id: req.user.id, email: req.user.email },
      providerScope(req),
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF)
  @Patch('admin/:id/reschedule')
  adminReschedule(
    @Req() req: {
      user: { orgId: string; id: string; email: string; role: string; providerId?: string | null };
    },
    @Param('id') id: string,
    @Body() dto: RescheduleDto,
  ) {
    return this.appointments.adminReschedule(
      id,
      req.user.orgId,
      dto.startUtc,
      { id: req.user.id, email: req.user.email },
      providerScope(req),
    );
  }
}
