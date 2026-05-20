import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { HostBookingsController } from './host-bookings.controller';

@Module({
  imports: [AuthModule, SchedulingModule, EmailModule],
  controllers: [BookingsController, HostBookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
