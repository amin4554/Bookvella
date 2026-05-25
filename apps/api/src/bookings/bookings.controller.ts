import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BookingsService } from './bookings.service';
import type {
  CreatePublicBookingDto,
  RequestBookingCodeDto,
  RescheduleBookingDto,
} from './dto';

@Controller('public')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post(':hostSlug/:eventSlug/booking-codes')
  requestBookingCode(
    @Param('hostSlug') hostSlug: string,
    @Param('eventSlug') eventSlug: string,
    @Body() dto: RequestBookingCodeDto,
  ) {
    return this.bookingsService.requestBookingCode(hostSlug, eventSlug, dto);
  }

  @Post(':hostSlug/:eventSlug/bookings')
  createPublicBooking(
    @Param('hostSlug') hostSlug: string,
    @Param('eventSlug') eventSlug: string,
    @Body() dto: CreatePublicBookingDto,
  ) {
    return this.bookingsService.createPublicBooking(hostSlug, eventSlug, dto);
  }

  @Get('feeds/:token')
  async feed(
    @Param('token') token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'inline; filename="bookvella.ics"',
    );
    return this.bookingsService.renderIcsFeed(token);
  }

  @Get('bookings/guest-cancel/:token')
  getGuestCancelBooking(@Param('token') token: string) {
    return this.bookingsService.getByGuestToken(token);
  }

  @Post('bookings/guest-cancel/:token')
  cancelByGuestToken(@Param('token') token: string) {
    return this.bookingsService.cancelByGuestToken(token);
  }

  @Post('bookings/guest-reschedule/:token')
  rescheduleByGuestToken(
    @Param('token') token: string,
    @Body() dto: RescheduleBookingDto,
  ) {
    return this.bookingsService.rescheduleByGuestToken(token, dto);
  }
}
