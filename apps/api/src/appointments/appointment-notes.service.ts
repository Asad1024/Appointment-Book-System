import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@pkg/shared-types';
import { PrismaService } from '../prisma/prisma.service';

const NOTE_MAX = 2000;

@Injectable()
export class AppointmentNotesService {
  constructor(private prisma: PrismaService) {}

  private async getAppointmentForStaff(
    appointmentId: string,
    orgId: string,
    scopedProviderId?: string,
  ) {
    const appt = await this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        organizationId: orgId,
        ...(scopedProviderId ? { providerId: scopedProviderId } : {}),
      },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  private isManagerRole(role: string) {
    return (
      role === UserRole.ORG_ADMIN ||
      role === UserRole.SUPER_ADMIN ||
      role === UserRole.LOCATION_MANAGER
    );
  }

  private canModerateNote(user: { id: string; role: string }, note: { authorId: string }) {
    if (note.authorId === user.id) return true;
    return this.isManagerRole(user.role);
  }

  private canViewNote(
    viewerRole: string,
    viewerId: string,
    note: { authorId: string; author: { role: string } },
  ) {
    if (this.isManagerRole(viewerRole)) return true;
    if (viewerRole === UserRole.PROVIDER) {
      if (note.authorId === viewerId) return true;
      return this.isManagerRole(note.author.role);
    }
    return false;
  }

  async list(
    appointmentId: string,
    orgId: string,
    user: { id: string; role: string },
    scopedProviderId?: string,
  ) {
    await this.getAppointmentForStaff(appointmentId, orgId, scopedProviderId);
    const notes = await this.prisma.appointmentNote.findMany({
      where: { appointmentId },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return notes
      .filter((n) => this.canViewNote(user.role, user.id, n))
      .map((n) => ({
        id: n.id,
        content: n.content,
        editedAt: n.editedAt,
        createdAt: n.createdAt,
        author: n.author,
      }));
  }

  async create(
    appointmentId: string,
    orgId: string,
    authorId: string,
    content: string,
    scopedProviderId?: string,
  ) {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > NOTE_MAX) {
      throw new BadRequestException(`Note must be 1–${NOTE_MAX} characters`);
    }
    await this.getAppointmentForStaff(appointmentId, orgId, scopedProviderId);
    const note = await this.prisma.appointmentNote.create({
      data: { appointmentId, authorId, content: trimmed },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    return {
      id: note.id,
      content: note.content,
      editedAt: note.editedAt,
      createdAt: note.createdAt,
      author: note.author,
    };
  }

  async update(
    appointmentId: string,
    noteId: string,
    orgId: string,
    user: { id: string; role: string },
    content: string,
    scopedProviderId?: string,
  ) {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > NOTE_MAX) {
      throw new BadRequestException(`Note must be 1–${NOTE_MAX} characters`);
    }
    await this.getAppointmentForStaff(appointmentId, orgId, scopedProviderId);
    const note = await this.prisma.appointmentNote.findFirst({
      where: { id: noteId, appointmentId },
    });
    if (!note) throw new NotFoundException('Note not found');
    if (!this.canModerateNote(user, note)) {
      throw new ForbiddenException('Only the author or a manager can edit this note');
    }
    const updated = await this.prisma.appointmentNote.update({
      where: { id: noteId },
      data: { content: trimmed, editedAt: new Date() },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    return {
      id: updated.id,
      content: updated.content,
      editedAt: updated.editedAt,
      createdAt: updated.createdAt,
      author: updated.author,
    };
  }

  async delete(
    appointmentId: string,
    noteId: string,
    orgId: string,
    user: { id: string; role: string },
    scopedProviderId?: string,
  ) {
    await this.getAppointmentForStaff(appointmentId, orgId, scopedProviderId);
    const note = await this.prisma.appointmentNote.findFirst({
      where: { id: noteId, appointmentId },
    });
    if (!note) throw new NotFoundException('Note not found');
    if (!this.canModerateNote(user, note)) {
      throw new ForbiddenException('Only the author or a manager can delete this note');
    }
    await this.prisma.appointmentNote.delete({ where: { id: noteId } });
    return { ok: true };
  }

  filterNotesForViewer(
    notes: Array<{
      id: string;
      content: string;
      editedAt: Date | null;
      createdAt: Date;
      authorId: string;
      author: { id: string; name: string; role: string };
    }>,
    viewer: { id: string; role: string },
  ) {
    return notes
      .filter((n) => this.canViewNote(viewer.role, viewer.id, n))
      .map(({ authorId: _authorId, ...n }) => ({
        id: n.id,
        content: n.content,
        editedAt: n.editedAt,
        createdAt: n.createdAt,
        author: n.author,
      }));
  }
}
