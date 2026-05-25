import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { CreateEventTypeDto, UpdateEventTypeDto } from './dto';
import { EventTypesService } from './event-types.service';

@Controller('event-types')
@UseGuards(AuthGuard)
export class EventTypesController {
  constructor(private readonly eventTypesService: EventTypesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.eventTypesService.list(request.user!.sub);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEventTypeDto,
  ) {
    return this.eventTypesService.create(request.user!.sub, dto);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEventTypeDto,
  ) {
    return this.eventTypesService.update(request.user!.sub, id, dto);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.eventTypesService.remove(request.user!.sub, id);
  }
}
