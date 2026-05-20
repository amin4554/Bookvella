import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { BookingsService } from './bookings.service';
import type { CancelBookingDto } from './dto';

@Controller('bookings')
@UseGuards(AuthGuard)
export class HostBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.bookingsService.listHostBookings(request.user!.sub);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelHostBooking(request.user!.sub, id, dto);
  }
}
