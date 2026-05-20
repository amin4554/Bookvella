import { Body, Controller, Param, Post } from '@nestjs/common';
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
}
