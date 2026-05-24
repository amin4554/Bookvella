import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('customers.csv')
  async customersCsv(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="bookvella-customers.csv"',
    );
    return this.bookingsService.exportCustomersCsv(request.user!.sub);
  }

  @Get('feed')
  feed(@Req() request: AuthenticatedRequest) {
    return this.bookingsService.getBookingFeed(request.user!.sub);
  }

  @Patch('feed/rotate')
  rotateFeed(@Req() request: AuthenticatedRequest) {
    return this.bookingsService.rotateBookingFeed(request.user!.sub);
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
