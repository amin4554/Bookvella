import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import type { CreatePublicBookingDto, RequestBookingCodeDto } from './dto';

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

  @Get('bookings/guest-cancel/:token')
  getGuestCancelBooking(@Param('token') token: string) {
    return this.bookingsService.getByGuestToken(token);
  }

  @Post('bookings/guest-cancel/:token')
  cancelByGuestToken(@Param('token') token: string) {
    return this.bookingsService.cancelByGuestToken(token);
  }
}
