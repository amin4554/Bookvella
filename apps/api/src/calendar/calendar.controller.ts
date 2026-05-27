import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CalendarService, calendarSettingsRedirect } from './calendar.service';
import type {
  UpdateConnectedCalendarDto,
  UpdateConflictCalendarDto,
  UpdateEventBufferDto,
  UpdateEventIgnoredDto,
} from './dto';

@Controller('auth')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('google/calendar')
  @UseGuards(AuthGuard)
  startGoogleCalendar(@Req() request: AuthenticatedRequest) {
    return this.calendarService.startGoogleOAuth(request.user!.sub);
  }

  @Get('outlook/calendar')
  @UseGuards(AuthGuard)
  startOutlookCalendar(@Req() request: AuthenticatedRequest) {
    return this.calendarService.startOutlookOAuth(request.user!.sub);
  }

  @Get('google/calendar/callback')
  async googleCalendarCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ) {
    try {
      await this.calendarService.handleGoogleCallback(code, state);
      response.redirect(calendarSettingsRedirect('connected'));
    } catch {
      response.redirect(calendarSettingsRedirect('error'));
    }
  }

  @Get('outlook/calendar/callback')
  async outlookCalendarCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() response: Response,
  ) {
    try {
      await this.calendarService.handleOutlookCallback(code, state);
      response.redirect(calendarSettingsRedirect('connected'));
    } catch {
      response.redirect(calendarSettingsRedirect('error'));
    }
  }

  @Get('calendars')
  @UseGuards(AuthGuard)
  calendars(@Req() request: AuthenticatedRequest) {
    return this.calendarService.listConnectedCalendars(request.user!.sub);
  }

  @Patch('calendars/:id')
  @UseGuards(AuthGuard)
  updateCalendar(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateConnectedCalendarDto,
  ) {
    return this.calendarService.updateConnectedCalendar(
      request.user!.sub,
      id,
      dto,
    );
  }

  @Patch('calendars/:id/conflicts/:conflictId')
  @UseGuards(AuthGuard)
  updateConflictCalendar(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('conflictId') conflictId: string,
    @Body() dto: UpdateConflictCalendarDto,
  ) {
    return this.calendarService.updateConflictCalendar(
      request.user!.sub,
      id,
      conflictId,
      dto,
    );
  }

  @Delete('calendars/:id')
  @UseGuards(AuthGuard)
  disconnectCalendar(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.calendarService.disconnectCalendar(request.user!.sub, id);
  }

  @Patch('calendars/:id/refresh')
  @UseGuards(AuthGuard)
  refreshCalendarList(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.calendarService.refreshCalendarList(request.user!.sub, id);
  }

  @Get('calendars/busy')
  @UseGuards(AuthGuard)
  busyEvents(
    @Req() request: AuthenticatedRequest,
    @Query('start') start: string | undefined,
    @Query('end') end: string | undefined,
  ) {
    const startDate = parseRangeBoundary(start, 'start');
    const endDate = parseRangeBoundary(end, 'end');
    return this.calendarService.listBusyEventsForRange(
      request.user!.sub,
      startDate,
      endDate,
    );
  }

  @Patch('calendars/:id/events/:eventId/buffer')
  @UseGuards(AuthGuard)
  updateEventBuffer(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventBufferDto,
  ) {
    const before =
      typeof dto.bufferBeforeMinutes === 'number'
        ? dto.bufferBeforeMinutes
        : 0;
    const after =
      typeof dto.bufferAfterMinutes === 'number' ? dto.bufferAfterMinutes : 0;
    return this.calendarService.updateEventBuffer(
      request.user!.sub,
      id,
      eventId,
      before,
      after,
      dto.providerCalendarId,
    );
  }

  @Patch('calendars/:id/events/:eventId/ignored')
  @UseGuards(AuthGuard)
  updateEventIgnored(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventIgnoredDto,
  ) {
    if (typeof dto.ignored !== 'boolean') {
      throw new BadRequestException('ignored must be a boolean');
    }
    return this.calendarService.setEventIgnored(
      request.user!.sub,
      id,
      eventId,
      dto.ignored,
      dto.providerCalendarId,
    );
  }
}

function parseRangeBoundary(value: string | undefined, field: string): Date {
  if (!value) {
    throw new BadRequestException(`${field} is required`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date`);
  }
  return parsed;
}
