import { Controller, Get, Param, Query } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';

@Controller('public')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('slug-availability')
  checkSlugAvailability(@Query('slug') slug?: string) {
    return this.schedulingService.checkSlugAvailability(slug);
  }

  // The public host profile (`/public/host/:hostSlug`) backs the
  // `bookvella.com/{slug}` bridge page that lists every active, non
  // direct-link-only service plus reviews and trust signals.
  @Get('host/:hostSlug')
  getPublicHost(@Param('hostSlug') hostSlug: string) {
    return this.schedulingService.getPublicHostProfile(hostSlug);
  }

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
