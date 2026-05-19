import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TeamService } from './team.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@ApiTags('team')
@Controller('team')
export class TeamController {
  constructor(private team: TeamService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Get('members')
  listMembers(@Req() req: { user: { orgId: string } }) {
    return this.team.listMembers(req.user.orgId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Get('invites')
  listInvites(@Req() req: { user: { orgId: string } }) {
    return this.team.listInvites(req.user.orgId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Post('invites')
  createInvite(
    @Req() req: { user: { orgId: string; id: string } },
    @Body() dto: CreateInviteDto,
  ) {
    return this.team.createInvite(req.user.orgId, req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN)
  @Delete('invites/:id')
  revokeInvite(@Req() req: { user: { orgId: string } }, @Param('id') id: string) {
    return this.team.revokeInvite(req.user.orgId, id);
  }

  @Public()
  @Get('invites/token/:token')
  previewInvite(@Param('token') token: string) {
    return this.team.getInviteByToken(token);
  }

  @Public()
  @Post('invites/token/:token/accept')
  acceptInvite(
    @Param('token') token: string,
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.team.acceptInvite(token, dto, res);
  }
}
