import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CalendarService, calendarSettingsRedirect } from './calendar.service';

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
}
