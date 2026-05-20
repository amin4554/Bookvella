import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventTypesController } from './event-types.controller';
import { EventTypesService } from './event-types.service';

@Module({
  imports: [AuthModule],
  controllers: [EventTypesController],
  providers: [EventTypesService],
})
export class EventTypesModule {}
