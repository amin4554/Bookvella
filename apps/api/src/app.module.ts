import './config/load-env';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { CalendarModule } from './calendar/calendar.module';
import { EventTypesModule } from './event-types/event-types.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { MediaModule } from './media/media.module';
import { ContactModule } from './contact/contact.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    EventTypesModule,
    AvailabilityModule,
    CalendarModule,
    SchedulingModule,
    BookingsModule,
    ReviewsModule,
    MediaModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
