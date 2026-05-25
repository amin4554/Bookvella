import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AvailabilityService } from './availability.service';
import type {
  AvailabilitySettingsDto,
  CreateAvailabilityOverrideDto,
  CreateAvailabilityRuleDto,
  ReplaceEventTypeAvailabilityDto,
  ReplaceAvailabilityRulesDto,
  UpdateAvailabilityOverrideDto,
  UpdateAvailabilityRuleDto,
} from './dto';

@Controller('availability')
@UseGuards(AuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('rules')
  list(@Req() request: AuthenticatedRequest) {
    return this.availabilityService.list(request.user!.sub);
  }

  @Post('rules')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAvailabilityRuleDto,
  ) {
    return this.availabilityService.create(request.user!.sub, dto);
  }

  @Put('rules')
  replace(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReplaceAvailabilityRulesDto,
  ) {
    return this.availabilityService.replaceRules(request.user!.sub, dto);
  }

  @Patch('rules/:id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityRuleDto,
  ) {
    return this.availabilityService.update(request.user!.sub, id, dto);
  }

  @Delete('rules/:id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.availabilityService.remove(request.user!.sub, id);
  }

  // ── Date overrides ────────────────────────────────────────────────────────

  @Get('event-types/:eventTypeId')
  getEventTypeAvailability(
    @Req() request: AuthenticatedRequest,
    @Param('eventTypeId') eventTypeId: string,
  ) {
    return this.availabilityService.getEventTypeAvailability(
      request.user!.sub,
      eventTypeId,
    );
  }

  @Put('event-types/:eventTypeId')
  replaceEventTypeAvailability(
    @Req() request: AuthenticatedRequest,
    @Param('eventTypeId') eventTypeId: string,
    @Body() dto: ReplaceEventTypeAvailabilityDto,
  ) {
    return this.availabilityService.replaceEventTypeAvailability(
      request.user!.sub,
      eventTypeId,
      dto,
    );
  }

  @Get('overrides')
  listOverrides(@Req() request: AuthenticatedRequest) {
    return this.availabilityService.listOverrides(request.user!.sub);
  }

  @Post('overrides')
  addOverride(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateAvailabilityOverrideDto,
  ) {
    return this.availabilityService.addOverride(request.user!.sub, body);
  }

  @Patch('overrides/:id')
  updateOverride(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateAvailabilityOverrideDto,
  ) {
    return this.availabilityService.updateOverride(request.user!.sub, id, body);
  }

  @Delete('overrides/:id')
  removeOverride(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.availabilityService.removeOverride(request.user!.sub, id);
  }

  // ── Booking-rules settings ────────────────────────────────────────────────

  @Get('settings')
  getSettings(@Req() request: AuthenticatedRequest) {
    return this.availabilityService.getSettings(request.user!.sub);
  }

  @Patch('settings')
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() body: AvailabilitySettingsDto,
  ) {
    return this.availabilityService.updateSettings(request.user!.sub, body);
  }
}
