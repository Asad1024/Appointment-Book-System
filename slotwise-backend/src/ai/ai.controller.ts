import { Body, Controller, Delete, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@pkg/shared-types';
import { Public } from '../auth/public.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiBookingHelperService } from './ai-booking-helper.service';
import { BookingHelperDto } from './dto/booking-helper.dto';
import { CustomerAssistantService } from './customer-assistant.service';
import {
  CustomerAssistantDto,
  CustomerAssistantHistoryQueryDto,
  SaveCustomerAssistantHistoryDto,
} from './dto/customer-assistant.dto';
import { CustomerAssistantHistoryService } from './customer-assistant-history.service';
import { ServiceDescriptionDto } from './dto/service-description.dto';
import { ServiceDescriptionService } from './service-description.service';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    private bookingHelper: AiBookingHelperService,
    private customerAssistant: CustomerAssistantService,
    private customerAssistantHistory: CustomerAssistantHistoryService,
    private serviceDescription: ServiceDescriptionService,
  ) {}

  @Public()
  @Post('booking-helper')
  suggestBooking(@Body() dto: BookingHelperDto) {
    return this.bookingHelper.suggest(dto);
  }

  @Public()
  @Post('customer-assistant')
  customerChat(@Body() dto: CustomerAssistantDto) {
    return this.customerAssistant.chat(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER, UserRole.PROVIDER)
  @Get('customer-assistant/history')
  getCustomerAssistantHistory(
    @Req() req: { user: { id: string; orgId: string } },
    @Query() query: CustomerAssistantHistoryQueryDto,
  ) {
    return this.customerAssistantHistory.getHistory(query, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER, UserRole.PROVIDER)
  @Put('customer-assistant/history')
  saveCustomerAssistantHistory(
    @Req() req: { user: { id: string; orgId: string } },
    @Body() dto: SaveCustomerAssistantHistoryDto,
  ) {
    return this.customerAssistantHistory.saveHistory(dto, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER, UserRole.PROVIDER)
  @Delete('customer-assistant/history')
  clearCustomerAssistantHistory(
    @Req() req: { user: { id: string; orgId: string } },
    @Query() query: CustomerAssistantHistoryQueryDto,
  ) {
    return this.customerAssistantHistory.clearHistory(query, req.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORG_ADMIN, UserRole.LOCATION_MANAGER)
  @Post('service-description')
  generateServiceDescription(@Body() dto: ServiceDescriptionDto) {
    return this.serviceDescription.generate(dto);
  }
}
