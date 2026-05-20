import { Controller, Get, Param, Query } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';

@Controller('public')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get(':hostSlug/:eventSlug')
  getPublicEvent(
    @Param('hostSlug') hostSlug: string,
    @Param('eventSlug') eventSlug: string,
  ) {
    return this.schedulingService.getPublicEvent(hostSlug, eventSlug);
  }

  @Get(':hostSlug/:eventSlug/slots')
  getAvailableSlots(
    @Param('hostSlug') hostSlug: string,
    @Param('eventSlug') eventSlug: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('timezone') guestTimezone?: string,
  ) {
    return this.schedulingService.getAvailableSlots({
      hostSlug,
      eventSlug,
      start,
      end,
      guestTimezone,
    });
  }
}
