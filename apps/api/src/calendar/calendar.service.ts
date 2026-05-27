import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CalendarEventSyncStatus,
  CalendarProvider,
  ConnectedCalendarState,
  Prisma,
} from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type {
  UpdateConnectedCalendarDto,
  UpdateConflictCalendarDto,
} from './dto';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];
const OUTLOOK_SCOPES = [
  'offline_access',
  'User.Read',
  'Calendars.Read',
  'Calendars.ReadWrite',
];

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type GoogleUserInfo = {
  email?: string;
};

type GoogleCalendarList = {
  items?: {
    id: string;
    summary?: string;
    backgroundColor?: string;
    primary?: boolean;
    selected?: boolean;
  }[];
};

type GoogleEventListResponse = {
  items?: {
    id?: string;
    status?: string;
    transparency?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }[];
};

type ProviderEvent = {
  providerCalendarId: string;
  providerEventId: string;
  startMs: number;
  endMs: number;
};

export type HostBusyEvent = {
  id: string;
  connectedCalendarId: string;
  provider: CalendarProvider;
  accountEmail: string;
  providerCalendarId: string;
  providerEventId: string;
  calendarName: string | null;
  calendarColor: string | null;
  startTimeUtc: string;
  endTimeUtc: string;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

type OutlookUserInfo = {
  mail?: string;
  userPrincipalName?: string;
};

type OutlookCalendarList = {
  value?: {
    id: string;
    name?: string;
    color?: string;
    isDefaultCalendar?: boolean;
  }[];
};

type OutlookCalendarView = {
  value?: {
    id?: string;
    showAs?: string;
    start?: { dateTime?: string; timeZone?: string };
    end?: { dateTime?: string; timeZone?: string };
  }[];
};

type CalendarEventInput = {
  title: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  guestNote: string | null;
  startTimeUtc: Date;
  endTimeUtc: Date;
  includeGuestDetails: boolean;
};

const connectedCalendarSelect = {
  id: true,
  provider: true,
  accountEmail: true,
  scopes: true,
  conflictsOn: true,
  writeBackCalendarId: true,
  markBufferBusy: true,
  includeGuestDetails: true,
  state: true,
  lastSyncedAt: true,
  lastSyncError: true,
  createdAt: true,
  updatedAt: true,
  conflictCalendars: {
    select: {
      id: true,
      providerCalendarId: true,
      name: true,
      color: true,
      enabled: true,
    },
    orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
  },
} satisfies Prisma.ConnectedCalendarSelect;

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  startGoogleOAuth(userId: string) {
    assertGoogleConfig();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!.trim());
    url.searchParams.set('redirect_uri', googleRedirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    url.searchParams.set('state', createCalendarState(userId));
    return { authorizationUrl: url.toString() };
  }

  startOutlookOAuth(userId: string) {
    assertMicrosoftConfig();
    const url = new URL(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    );
    url.searchParams.set('client_id', process.env.MICROSOFT_CLIENT_ID!.trim());
    url.searchParams.set('redirect_uri', outlookRedirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', OUTLOOK_SCOPES.join(' '));
    url.searchParams.set('state', createCalendarState(userId));
    return { authorizationUrl: url.toString() };
  }

  async handleGoogleCallback(
    code: string | undefined,
    state: string | undefined,
  ) {
    assertGoogleConfig();
    const userId = verifyCalendarState(state);
    const authCode = requireText(code, 'code');
    const tokenResponse = await googleTokenRequest({
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: googleRedirectUri(),
    });

    if (!tokenResponse.access_token) {
      throw new UnauthorizedException({
        message: 'Google did not return an access token',
        code: 'CALENDAR_PROVIDER_AUTH_FAILED',
        provider: 'GOOGLE',
      });
    }

    const userInfo = await googleJson<GoogleUserInfo>(
      'https://openidconnect.googleapis.com/v1/userinfo',
      tokenResponse.access_token,
    );
    const accountEmail = normalizeEmail(userInfo.email);
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;
    const connected = await this.prisma.connectedCalendar.upsert({
      where: {
        userId_provider_accountEmail: {
          userId,
          provider: CalendarProvider.GOOGLE,
          accountEmail,
        },
      },
      create: {
        userId,
        provider: CalendarProvider.GOOGLE,
        accountEmail,
        accessTokenEncrypted: encryptSecret(tokenResponse.access_token),
        refreshTokenEncrypted: tokenResponse.refresh_token
          ? encryptSecret(tokenResponse.refresh_token)
          : null,
        accessTokenExpiresAt: expiresAt,
        scopes:
          tokenResponse.scope?.split(/\s+/).filter(Boolean) ?? GOOGLE_SCOPES,
        writeBackCalendarId: 'primary',
      },
      update: {
        accessTokenEncrypted: encryptSecret(tokenResponse.access_token),
        ...(tokenResponse.refresh_token
          ? {
              refreshTokenEncrypted: encryptSecret(tokenResponse.refresh_token),
            }
          : {}),
        accessTokenExpiresAt: expiresAt,
        scopes:
          tokenResponse.scope?.split(/\s+/).filter(Boolean) ?? GOOGLE_SCOPES,
        state: ConnectedCalendarState.ACTIVE,
        lastSyncError: null,
      },
    });

    await this.syncGoogleCalendarList(connected.id);
    return { connectedCalendarId: connected.id };
  }

  async handleOutlookCallback(
    code: string | undefined,
    state: string | undefined,
  ) {
    assertMicrosoftConfig();
    const userId = verifyCalendarState(state);
    const authCode = requireText(code, 'code');
    const tokenResponse = await microsoftTokenRequest({
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: outlookRedirectUri(),
    });

    if (!tokenResponse.access_token) {
      throw new UnauthorizedException({
        message: 'Microsoft did not return an access token',
        code: 'CALENDAR_PROVIDER_AUTH_FAILED',
        provider: 'OUTLOOK',
      });
    }

    const userInfo = await graphJson<OutlookUserInfo>(
      'https://graph.microsoft.com/v1.0/me',
      tokenResponse.access_token,
    );
    const accountEmail = normalizeEmail(
      userInfo.mail ?? userInfo.userPrincipalName,
    );
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;
    const connected = await this.prisma.connectedCalendar.upsert({
      where: {
        userId_provider_accountEmail: {
          userId,
          provider: CalendarProvider.OUTLOOK,
          accountEmail,
        },
      },
      create: {
        userId,
        provider: CalendarProvider.OUTLOOK,
        accountEmail,
        accessTokenEncrypted: encryptSecret(tokenResponse.access_token),
        refreshTokenEncrypted: tokenResponse.refresh_token
          ? encryptSecret(tokenResponse.refresh_token)
          : null,
        accessTokenExpiresAt: expiresAt,
        scopes:
          tokenResponse.scope?.split(/\s+/).filter(Boolean) ?? OUTLOOK_SCOPES,
        writeBackCalendarId: null,
      },
      update: {
        accessTokenEncrypted: encryptSecret(tokenResponse.access_token),
        ...(tokenResponse.refresh_token
          ? {
              refreshTokenEncrypted: encryptSecret(tokenResponse.refresh_token),
            }
          : {}),
        accessTokenExpiresAt: expiresAt,
        scopes:
          tokenResponse.scope?.split(/\s+/).filter(Boolean) ?? OUTLOOK_SCOPES,
        state: ConnectedCalendarState.ACTIVE,
        lastSyncError: null,
      },
    });

    await this.syncOutlookCalendarList(connected.id);
    return { connectedCalendarId: connected.id };
  }

  listConnectedCalendars(userId: string) {
    return this.prisma.connectedCalendar.findMany({
      where: { userId },
      select: connectedCalendarSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateConnectedCalendar(
    userId: string,
    id: string,
    dto: UpdateConnectedCalendarDto,
  ) {
    const existing = await this.prisma.connectedCalendar.findFirst({
      where: { id, userId },
      include: { conflictCalendars: true },
    });

    if (!existing) {
      throw new NotFoundException('Connected calendar not found');
    }

    const data: Prisma.ConnectedCalendarUpdateInput = {};

    if (dto.enabled !== undefined) {
      data.state = requireBoolean(dto.enabled, 'enabled')
        ? ConnectedCalendarState.ACTIVE
        : ConnectedCalendarState.PAUSED;
    }

    if (dto.conflictsOn !== undefined) {
      data.conflictsOn = requireBoolean(dto.conflictsOn, 'conflictsOn');
    }

    if (dto.markBufferBusy !== undefined) {
      data.markBufferBusy = requireBoolean(
        dto.markBufferBusy,
        'markBufferBusy',
      );
    }

    if (dto.includeGuestDetails !== undefined) {
      data.includeGuestDetails = requireBoolean(
        dto.includeGuestDetails,
        'includeGuestDetails',
      );
    }

    if (dto.writeBackCalendarId !== undefined) {
      data.writeBackCalendarId = normalizeWriteBackCalendarId(
        dto.writeBackCalendarId,
        [
          ...existing.conflictCalendars.map(
            (calendar) => calendar.providerCalendarId,
          ),
          ...(existing.writeBackCalendarId ? [existing.writeBackCalendarId] : []),
        ],
      );
    }

    return this.prisma.connectedCalendar.update({
      where: { id },
      data,
      select: connectedCalendarSelect,
    });
  }

  async updateConflictCalendar(
    userId: string,
    connectedCalendarId: string,
    conflictCalendarId: string,
    dto: UpdateConflictCalendarDto,
  ) {
    const conflict = await this.prisma.conflictCalendar.findFirst({
      where: {
        id: conflictCalendarId,
        connectedCalendar: { id: connectedCalendarId, userId },
      },
      select: { id: true },
    });

    if (!conflict) {
      throw new NotFoundException('Conflict calendar not found');
    }

    await this.prisma.conflictCalendar.update({
      where: { id: conflict.id },
      data: { enabled: requireBoolean(dto.enabled, 'enabled') },
    });

    return this.getConnectedCalendar(userId, connectedCalendarId);
  }

  async disconnectCalendar(userId: string, id: string) {
    const result = await this.prisma.connectedCalendar.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Connected calendar not found');
    }

    return { success: true };
  }

  async refreshCalendarList(userId: string, id: string) {
    const calendar = await this.prisma.connectedCalendar.findFirst({
      where: { id, userId },
    });

    if (!calendar) {
      throw new NotFoundException('Connected calendar not found');
    }

    if (calendar.provider === CalendarProvider.GOOGLE) {
      await this.syncGoogleCalendarList(calendar.id);
    } else if (calendar.provider === CalendarProvider.OUTLOOK) {
      await this.syncOutlookCalendarList(calendar.id);
    }

    await this.prisma.connectedCalendar.update({
      where: { id: calendar.id },
      data: {
        state: ConnectedCalendarState.ACTIVE,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });

    return this.getConnectedCalendar(userId, id);
  }

  private async getConnectedCalendar(userId: string, id: string) {
    const calendar = await this.prisma.connectedCalendar.findFirst({
      where: { id, userId },
      select: connectedCalendarSelect,
    });

    if (!calendar) {
      throw new NotFoundException('Connected calendar not found');
    }

    return calendar;
  }

  // Used by the public booking scheduler. Returns busy windows already widened
  // by any per-event buffer the host configured in /dashboard/availability so
  // the slot generator can stay buffer-agnostic.
  async getBusyIntervals(userId: string, start: Date, end: Date) {
    const events = await this.collectProviderEvents(userId, start, end);
    if (events.length === 0) {
      return [];
    }

    const buffers = await this.loadEventBuffers(
      userId,
      events.map((event) => ({
        connectedCalendarId: event.connectedCalendarId,
        providerEventId: event.providerEventId,
      })),
    );

    return events.map((event) => {
      const buffer = buffers.get(
        bufferKey(event.connectedCalendarId, event.providerEventId),
      );
      const before = (buffer?.bufferBeforeMinutes ?? 0) * 60_000;
      const after = (buffer?.bufferAfterMinutes ?? 0) * 60_000;
      return {
        startMs: event.startMs - before,
        endMs: event.endMs + after,
      };
    });
  }

  // Used by the host UI. Returns each upcoming external event in the window
  // with the saved buffer (or zero) so the host can edit the buffer per event.
  async listBusyEventsForRange(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<HostBusyEvent[]> {
    const events = await this.collectProviderEvents(userId, start, end);
    if (events.length === 0) {
      return [];
    }

    const buffers = await this.loadEventBuffers(
      userId,
      events.map((event) => ({
        connectedCalendarId: event.connectedCalendarId,
        providerEventId: event.providerEventId,
      })),
    );

    return events
      .map((event): HostBusyEvent => {
        const buffer = buffers.get(
          bufferKey(event.connectedCalendarId, event.providerEventId),
        );
        return {
          id: `${event.connectedCalendarId}:${event.providerEventId}`,
          connectedCalendarId: event.connectedCalendarId,
          provider: event.provider,
          accountEmail: event.accountEmail,
          providerCalendarId: event.providerCalendarId,
          providerEventId: event.providerEventId,
          calendarName: event.calendarName,
          calendarColor: event.calendarColor,
          startTimeUtc: new Date(event.startMs).toISOString(),
          endTimeUtc: new Date(event.endMs).toISOString(),
          bufferBeforeMinutes: buffer?.bufferBeforeMinutes ?? 0,
          bufferAfterMinutes: buffer?.bufferAfterMinutes ?? 0,
        };
      })
      .sort((a, b) => a.startTimeUtc.localeCompare(b.startTimeUtc));
  }

  async updateEventBuffer(
    userId: string,
    connectedCalendarId: string,
    providerEventId: string,
    bufferBeforeMinutes: number,
    bufferAfterMinutes: number,
    providerCalendarId?: string,
  ) {
    const calendar = await this.prisma.connectedCalendar.findFirst({
      where: { id: connectedCalendarId, userId },
      select: { id: true },
    });

    if (!calendar) {
      throw new NotFoundException('Connected calendar not found');
    }

    const safeBefore = clampBufferMinutes(bufferBeforeMinutes);
    const safeAfter = clampBufferMinutes(bufferAfterMinutes);

    // No row needed when both buffers are zero — drop any existing row so we
    // don't keep noise around.
    if (safeBefore === 0 && safeAfter === 0) {
      await this.prisma.externalEventBuffer.deleteMany({
        where: {
          connectedCalendarId,
          providerEventId,
        },
      });
      return { bufferBeforeMinutes: 0, bufferAfterMinutes: 0 };
    }

    const resolvedProviderCalendarId =
      providerCalendarId?.trim() ||
      (await this.prisma.externalEventBuffer.findUnique({
        where: {
          connectedCalendarId_providerEventId: {
            connectedCalendarId,
            providerEventId,
          },
        },
        select: { providerCalendarId: true },
      }))?.providerCalendarId ||
      '';

    if (!resolvedProviderCalendarId) {
      throw new BadRequestException('providerCalendarId is required');
    }

    const row = await this.prisma.externalEventBuffer.upsert({
      where: {
        connectedCalendarId_providerEventId: {
          connectedCalendarId,
          providerEventId,
        },
      },
      create: {
        userId,
        connectedCalendarId,
        providerCalendarId: resolvedProviderCalendarId,
        providerEventId,
        bufferBeforeMinutes: safeBefore,
        bufferAfterMinutes: safeAfter,
      },
      update: {
        bufferBeforeMinutes: safeBefore,
        bufferAfterMinutes: safeAfter,
      },
      select: { bufferBeforeMinutes: true, bufferAfterMinutes: true },
    });

    return row;
  }

  private async collectProviderEvents(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<
    (ProviderEvent & {
      connectedCalendarId: string;
      provider: CalendarProvider;
      accountEmail: string;
      calendarName: string | null;
      calendarColor: string | null;
    })[]
  > {
    const calendars = await this.prisma.connectedCalendar.findMany({
      where: {
        userId,
        state: ConnectedCalendarState.ACTIVE,
        conflictsOn: true,
      },
      include: {
        conflictCalendars: {
          where: { enabled: true },
        },
      },
    });

    const collected: (ProviderEvent & {
      connectedCalendarId: string;
      provider: CalendarProvider;
      accountEmail: string;
      calendarName: string | null;
      calendarColor: string | null;
    })[] = [];

    for (const calendar of calendars) {
      const enabledConflicts = calendar.conflictCalendars;

      if (enabledConflicts.length === 0) {
        continue;
      }

      try {
        const events =
          calendar.provider === CalendarProvider.GOOGLE
            ? await this.googleBusyEvents(
                calendar.id,
                enabledConflicts.map((c) => c.providerCalendarId),
                start,
                end,
              )
            : await this.outlookBusyEvents(
                calendar.id,
                enabledConflicts.map((c) => c.providerCalendarId),
                start,
                end,
              );

        const nameByCalendarId = new Map(
          enabledConflicts.map((c) => [c.providerCalendarId, c]),
        );

        for (const event of events) {
          const conflict = nameByCalendarId.get(event.providerCalendarId);
          collected.push({
            ...event,
            connectedCalendarId: calendar.id,
            provider: calendar.provider,
            accountEmail: calendar.accountEmail,
            calendarName: conflict?.name ?? null,
            calendarColor: conflict?.color ?? null,
          });
        }

        await this.prisma.connectedCalendar.update({
          where: { id: calendar.id },
          data: { lastSyncedAt: new Date(), lastSyncError: null },
        });
      } catch (error) {
        await this.markCalendarSyncError(calendar.id, error);
      }
    }

    return collected;
  }

  private async loadEventBuffers(
    userId: string,
    keys: { connectedCalendarId: string; providerEventId: string }[],
  ) {
    if (keys.length === 0) {
      return new Map<
        string,
        { bufferBeforeMinutes: number; bufferAfterMinutes: number }
      >();
    }

    const rows = await this.prisma.externalEventBuffer.findMany({
      where: {
        userId,
        OR: keys.map((key) => ({
          connectedCalendarId: key.connectedCalendarId,
          providerEventId: key.providerEventId,
        })),
      },
      select: {
        connectedCalendarId: true,
        providerEventId: true,
        bufferBeforeMinutes: true,
        bufferAfterMinutes: true,
      },
    });

    const map = new Map<
      string,
      { bufferBeforeMinutes: number; bufferAfterMinutes: number }
    >();
    for (const row of rows) {
      map.set(bufferKey(row.connectedCalendarId, row.providerEventId), {
        bufferBeforeMinutes: row.bufferBeforeMinutes,
        bufferAfterMinutes: row.bufferAfterMinutes,
      });
    }
    return map;
  }

  async writeBookingCreated(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { eventType: true, host: true },
    });

    if (!booking) return;

    const calendars = await this.prisma.connectedCalendar.findMany({
      where: {
        userId: booking.hostUserId,
        state: ConnectedCalendarState.ACTIVE,
      },
    });

    for (const calendar of calendars) {
      const calendarId =
        calendar.writeBackCalendarId ??
        (calendar.provider === CalendarProvider.OUTLOOK
          ? 'calendar'
          : 'primary');
      const writeStartTimeUtc = calendar.markBufferBusy
        ? new Date(
            booking.startTimeUtc.getTime() -
              booking.eventType.bufferBeforeMinutes * 60_000,
          )
        : booking.startTimeUtc;
      const writeEndTimeUtc = calendar.markBufferBusy
        ? new Date(
            booking.endTimeUtc.getTime() +
              booking.eventType.bufferAfterMinutes * 60_000,
          )
        : booking.endTimeUtc;

      try {
        const event =
          calendar.provider === CalendarProvider.OUTLOOK
            ? await this.createOutlookEvent(calendar.id, calendarId, {
                title: booking.eventType.title,
                guestName: booking.guestName,
                guestEmail: booking.guestEmail,
                guestPhone: booking.guestPhone,
                guestNote: booking.guestNote,
                startTimeUtc: writeStartTimeUtc,
                endTimeUtc: writeEndTimeUtc,
                includeGuestDetails: calendar.includeGuestDetails,
              })
            : await this.createGoogleEvent(calendar.id, calendarId, {
                title: booking.eventType.title,
                guestName: booking.guestName,
                guestEmail: booking.guestEmail,
                guestPhone: booking.guestPhone,
                guestNote: booking.guestNote,
                startTimeUtc: writeStartTimeUtc,
                endTimeUtc: writeEndTimeUtc,
                includeGuestDetails: calendar.includeGuestDetails,
              });

        await this.prisma.calendarEventSync.upsert({
          where: {
            bookingId_connectedCalendarId: {
              bookingId,
              connectedCalendarId: calendar.id,
            },
          },
          create: {
            bookingId,
            connectedCalendarId: calendar.id,
            providerEventId: event.id,
            providerCalendarId: calendarId,
            syncStatus: CalendarEventSyncStatus.SYNCED,
          },
          update: {
            providerEventId: event.id,
            providerCalendarId: calendarId,
            syncStatus: CalendarEventSyncStatus.SYNCED,
            lastError: null,
          },
        });
      } catch (error) {
        await this.recordCalendarEventFailure(bookingId, calendar.id, error);
      }
    }
  }

  async writeBookingCancelled(bookingId: string) {
    const syncs = await this.prisma.calendarEventSync.findMany({
      where: { bookingId, syncStatus: CalendarEventSyncStatus.SYNCED },
      include: { connectedCalendar: true },
    });

    for (const sync of syncs) {
      if (!sync.providerEventId || !sync.providerCalendarId) continue;

      try {
        if (sync.connectedCalendar.provider === CalendarProvider.OUTLOOK) {
          const accessToken = await this.outlookAccessToken(
            sync.connectedCalendarId,
          );
          await graphRequest(
            `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(sync.providerCalendarId)}/events/${encodeURIComponent(sync.providerEventId)}`,
            accessToken,
            { method: 'DELETE' },
          );
        } else {
          const accessToken = await this.googleAccessToken(
            sync.connectedCalendarId,
          );
          await googleRequest(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(sync.providerCalendarId)}/events/${encodeURIComponent(sync.providerEventId)}`,
            accessToken,
            { method: 'DELETE' },
          );
        }
        await this.prisma.calendarEventSync.update({
          where: { id: sync.id },
          data: {
            syncStatus: CalendarEventSyncStatus.DELETED,
            lastError: null,
          },
        });
      } catch (error) {
        await this.recordCalendarEventFailure(
          bookingId,
          sync.connectedCalendarId,
          error,
        );
      }
    }
  }

  private async googleBusyEvents(
    connectedCalendarId: string,
    calendarIds: string[],
    start: Date,
    end: Date,
  ): Promise<ProviderEvent[]> {
    const accessToken = await this.googleAccessToken(connectedCalendarId);
    const events: ProviderEvent[] = [];

    for (const calendarId of calendarIds) {
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      );
      url.searchParams.set('timeMin', start.toISOString());
      url.searchParams.set('timeMax', end.toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '250');
      url.searchParams.set(
        'fields',
        'items(id,status,transparency,start(dateTime,date),end(dateTime,date))',
      );

      const response = await googleJson<GoogleEventListResponse>(
        url.toString(),
        accessToken,
      );

      for (const item of response.items ?? []) {
        if (!item.id) continue;
        if (item.status === 'cancelled') continue;
        // Transparent events (visible "available" in Google) shouldn't block.
        if (item.transparency === 'transparent') continue;

        const startMs = parseGoogleEventDate(item.start);
        const endMs = parseGoogleEventDate(item.end);
        if (startMs === null || endMs === null) continue;
        if (endMs <= startMs) continue;

        events.push({
          providerCalendarId: calendarId,
          providerEventId: item.id,
          startMs,
          endMs,
        });
      }
    }

    return events;
  }

  private async outlookBusyEvents(
    connectedCalendarId: string,
    calendarIds: string[],
    start: Date,
    end: Date,
  ): Promise<ProviderEvent[]> {
    const accessToken = await this.outlookAccessToken(connectedCalendarId);
    const events: ProviderEvent[] = [];

    for (const calendarId of calendarIds) {
      const url = new URL(
        `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView`,
      );
      url.searchParams.set('startDateTime', start.toISOString());
      url.searchParams.set('endDateTime', end.toISOString());
      url.searchParams.set('$select', 'id,start,end,showAs');
      url.searchParams.set('$top', '250');
      const response = await graphJson<OutlookCalendarView>(
        url.toString(),
        accessToken,
        { headers: { Prefer: 'outlook.timezone="UTC"' } },
      );

      for (const event of response.value ?? []) {
        if (event.showAs === 'free') continue;
        if (!event.id) continue;
        if (!event.start?.dateTime || !event.end?.dateTime) continue;

        const startMs = parseProviderDateTime(event.start.dateTime).getTime();
        const endMs = parseProviderDateTime(event.end.dateTime).getTime();
        if (endMs <= startMs) continue;

        events.push({
          providerCalendarId: calendarId,
          providerEventId: event.id,
          startMs,
          endMs,
        });
      }
    }

    return events;
  }

  private async createGoogleEvent(
    connectedCalendarId: string,
    calendarId: string,
    input: CalendarEventInput,
  ) {
    const accessToken = await this.googleAccessToken(connectedCalendarId);
    return googleJson<{ id?: string }>(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          summary: `${input.title} with ${input.guestName}`,
          description: calendarEventDescription(input),
          start: { dateTime: input.startTimeUtc.toISOString() },
          end: { dateTime: input.endTimeUtc.toISOString() },
        }),
      },
    );
  }

  private async createOutlookEvent(
    connectedCalendarId: string,
    calendarId: string,
    input: CalendarEventInput,
  ) {
    const accessToken = await this.outlookAccessToken(connectedCalendarId);
    const path =
      calendarId === 'calendar'
        ? 'https://graph.microsoft.com/v1.0/me/calendar/events'
        : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`;

    return graphJson<{ id?: string }>(path, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        subject: `${input.title} with ${input.guestName}`,
        body: {
          contentType: 'text',
          content: calendarEventDescription(input),
        },
        start: { dateTime: input.startTimeUtc.toISOString(), timeZone: 'UTC' },
        end: { dateTime: input.endTimeUtc.toISOString(), timeZone: 'UTC' },
      }),
    });
  }

  private async syncGoogleCalendarList(connectedCalendarId: string) {
    const accessToken = await this.googleAccessToken(connectedCalendarId);
    const calendarList = await googleJson<GoogleCalendarList>(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      accessToken,
    );

    for (const item of calendarList.items ?? []) {
      await this.prisma.conflictCalendar.upsert({
        where: {
          connectedCalendarId_providerCalendarId: {
            connectedCalendarId,
            providerCalendarId: item.id,
          },
        },
        create: {
          connectedCalendarId,
          providerCalendarId: item.id,
          name: item.summary ?? item.id,
          color: item.backgroundColor,
          enabled: Boolean(item.primary || item.selected),
        },
        update: {
          name: item.summary ?? item.id,
          color: item.backgroundColor,
        },
      });
    }
  }

  private async syncOutlookCalendarList(connectedCalendarId: string) {
    const accessToken = await this.outlookAccessToken(connectedCalendarId);
    const calendarList = await graphJson<OutlookCalendarList>(
      'https://graph.microsoft.com/v1.0/me/calendars',
      accessToken,
    );

    for (const item of calendarList.value ?? []) {
      await this.prisma.conflictCalendar.upsert({
        where: {
          connectedCalendarId_providerCalendarId: {
            connectedCalendarId,
            providerCalendarId: item.id,
          },
        },
        create: {
          connectedCalendarId,
          providerCalendarId: item.id,
          name: item.name ?? item.id,
          color: item.color,
          enabled: Boolean(item.isDefaultCalendar),
        },
        update: {
          name: item.name ?? item.id,
          color: item.color,
        },
      });
    }
  }

  private async googleAccessToken(connectedCalendarId: string) {
    const calendar = await this.prisma.connectedCalendar.findUnique({
      where: { id: connectedCalendarId },
    });

    if (!calendar) {
      throw new BadRequestException('Connected calendar not found');
    }

    if (
      !calendar.accessTokenExpiresAt ||
      calendar.accessTokenExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return decryptSecret(calendar.accessTokenEncrypted);
    }

    if (!calendar.refreshTokenEncrypted) {
      await this.prisma.connectedCalendar.update({
        where: { id: calendar.id },
        data: { state: ConnectedCalendarState.TOKEN_EXPIRED },
      });
      throw new UnauthorizedException({
        message: 'Google calendar token expired',
        code: 'CALENDAR_TOKEN_EXPIRED',
        provider: 'GOOGLE',
      });
    }

    const tokenResponse = await googleTokenRequest({
      refresh_token: decryptSecret(calendar.refreshTokenEncrypted),
      grant_type: 'refresh_token',
    });

    if (!tokenResponse.access_token) {
      throw new UnauthorizedException({
        message: 'Google calendar refresh failed',
        code: 'CALENDAR_PROVIDER_AUTH_FAILED',
        provider: 'GOOGLE',
      });
    }

    await this.prisma.connectedCalendar.update({
      where: { id: calendar.id },
      data: {
        accessTokenEncrypted: encryptSecret(tokenResponse.access_token),
        accessTokenExpiresAt: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null,
        state: ConnectedCalendarState.ACTIVE,
        lastSyncError: null,
      },
    });

    return tokenResponse.access_token;
  }

  private async outlookAccessToken(connectedCalendarId: string) {
    const calendar = await this.prisma.connectedCalendar.findUnique({
      where: { id: connectedCalendarId },
    });

    if (!calendar) {
      throw new BadRequestException('Connected calendar not found');
    }

    if (
      !calendar.accessTokenExpiresAt ||
      calendar.accessTokenExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return decryptSecret(calendar.accessTokenEncrypted);
    }

    if (!calendar.refreshTokenEncrypted) {
      await this.prisma.connectedCalendar.update({
        where: { id: calendar.id },
        data: { state: ConnectedCalendarState.TOKEN_EXPIRED },
      });
      throw new UnauthorizedException({
        message: 'Microsoft calendar token expired',
        code: 'CALENDAR_TOKEN_EXPIRED',
        provider: 'OUTLOOK',
      });
    }

    const tokenResponse = await microsoftTokenRequest({
      refresh_token: decryptSecret(calendar.refreshTokenEncrypted),
      grant_type: 'refresh_token',
      redirect_uri: outlookRedirectUri(),
    });

    if (!tokenResponse.access_token) {
      throw new UnauthorizedException({
        message: 'Microsoft calendar refresh failed',
        code: 'CALENDAR_PROVIDER_AUTH_FAILED',
        provider: 'OUTLOOK',
      });
    }

    await this.prisma.connectedCalendar.update({
      where: { id: calendar.id },
      data: {
        accessTokenEncrypted: encryptSecret(tokenResponse.access_token),
        accessTokenExpiresAt: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : null,
        state: ConnectedCalendarState.ACTIVE,
        lastSyncError: null,
      },
    });

    return tokenResponse.access_token;
  }

  private async markCalendarSyncError(calendarId: string, error: unknown) {
    await this.prisma.connectedCalendar.update({
      where: { id: calendarId },
      data: {
        state: ConnectedCalendarState.SYNC_ERROR,
        lastSyncError: errorMessage(error),
      },
    });
  }

  private async recordCalendarEventFailure(
    bookingId: string,
    connectedCalendarId: string,
    error: unknown,
  ) {
    await this.prisma.calendarEventSync.upsert({
      where: {
        bookingId_connectedCalendarId: {
          bookingId,
          connectedCalendarId,
        },
      },
      create: {
        bookingId,
        connectedCalendarId,
        syncStatus: CalendarEventSyncStatus.FAILED,
        lastError: errorMessage(error),
      },
      update: {
        syncStatus: CalendarEventSyncStatus.FAILED,
        lastError: errorMessage(error),
      },
    });
  }
}

async function googleTokenRequest(input: Record<string, string>) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    ...input,
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new UnauthorizedException({
      message: 'Google token exchange failed',
      code: 'CALENDAR_PROVIDER_AUTH_FAILED',
      provider: 'GOOGLE',
    });
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function microsoftTokenRequest(input: Record<string, string>) {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!.trim(),
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!.trim(),
    scope: OUTLOOK_SCOPES.join(' '),
    ...input,
  });
  const response = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );

  if (!response.ok) {
    throw new UnauthorizedException({
      message: 'Microsoft token exchange failed',
      code: 'CALENDAR_PROVIDER_AUTH_FAILED',
      provider: 'OUTLOOK',
    });
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function googleJson<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
) {
  const response = await googleRequest(url, accessToken, init);
  return (await response.json()) as T;
}

async function googleRequest(
  url: string,
  accessToken: string,
  init: RequestInit = {},
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new InternalServerErrorException({
      message: `Google Calendar request failed: ${response.status}`,
      code: 'CALENDAR_PROVIDER_REQUEST_FAILED',
      provider: 'GOOGLE',
      status: response.status,
    });
  }

  return response;
}

async function graphJson<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {},
) {
  const response = await graphRequest(url, accessToken, init);
  return (await response.json()) as T;
}

async function graphRequest(
  url: string,
  accessToken: string,
  init: RequestInit = {},
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new InternalServerErrorException({
      message: `Microsoft Graph request failed: ${response.status}`,
      code: 'CALENDAR_PROVIDER_REQUEST_FAILED',
      provider: 'OUTLOOK',
      status: response.status,
    });
  }

  return response;
}

function assertGoogleConfig() {
  if (!process.env.GOOGLE_CLIENT_ID?.trim()) {
    throw new InternalServerErrorException(
      'GOOGLE_CLIENT_ID is not configured',
    );
  }

  if (!process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    throw new InternalServerErrorException(
      'GOOGLE_CLIENT_SECRET is not configured',
    );
  }
}

function assertMicrosoftConfig() {
  if (!process.env.MICROSOFT_CLIENT_ID?.trim()) {
    throw new InternalServerErrorException(
      'MICROSOFT_CLIENT_ID is not configured',
    );
  }

  if (!process.env.MICROSOFT_CLIENT_SECRET?.trim()) {
    throw new InternalServerErrorException(
      'MICROSOFT_CLIENT_SECRET is not configured',
    );
  }
}

function googleRedirectUri() {
  return (
    process.env.GOOGLE_CALENDAR_REDIRECT_URL ??
    `${apiBaseUrl().replace(/\/$/, '')}/auth/google/calendar/callback`
  );
}

function outlookRedirectUri() {
  return (
    process.env.MICROSOFT_CALENDAR_REDIRECT_URL ??
    `${apiBaseUrl().replace(/\/$/, '')}/auth/outlook/calendar/callback`
  );
}

function apiBaseUrl() {
  return (
    process.env.PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3000'
  );
}

function appBaseUrl() {
  return (
    process.env.PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3001'
  );
}

export function calendarSettingsRedirect(status: 'connected' | 'error') {
  const url = new URL('/dashboard/settings', appBaseUrl());
  url.hash = `calendar-${status}`;
  return url.toString();
}

function createCalendarState(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      exp: Date.now() + 10 * 60 * 1000,
      nonce: randomBytes(12).toString('base64url'),
    }),
  ).toString('base64url');
  const signature = signState(payload);
  return `${payload}.${signature}`;
}

function verifyCalendarState(value: string | undefined) {
  const state = requireText(value, 'state');
  const [payload, signature] = state.split('.');

  if (
    !payload ||
    !signature ||
    !timingSafeEqualText(signature, signState(payload))
  ) {
    throw new UnauthorizedException('Invalid calendar OAuth state');
  }

  const parsed = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as {
    userId?: string;
    exp?: number;
  };

  if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) {
    throw new UnauthorizedException('Calendar OAuth state expired');
  }

  return parsed.userId;
}

function signState(payload: string) {
  return createHmac('sha256', tokenSecret())
    .update(payload)
    .digest('base64url');
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

function decryptSecret(value: string) {
  const [version, iv, tag, ciphertext] = value.split(':');

  if (version !== 'v1' || !iv || !tag || !ciphertext) {
    throw new Error('Invalid encrypted token');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function calendarEventDescription(input: CalendarEventInput) {
  if (!input.includeGuestDetails) {
    return 'Bookvella booking';
  }

  return [
    `Guest: ${input.guestName} <${input.guestEmail}>`,
    input.guestPhone ? `Phone: ${input.guestPhone}` : null,
    input.guestNote ? `Note: ${input.guestNote}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function encryptionKey() {
  return createHash('sha256').update(tokenSecret()).digest();
}

function tokenSecret() {
  return (
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY ??
    process.env.JWT_PRIVATE_KEY ??
    'bookvella-calendar-dev'
  );
}

function normalizeEmail(value?: string) {
  const email = value?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Google account email is missing');
  }

  return email;
}

function requireText(value: string | undefined, field: string) {
  const text = value?.trim();

  if (!text) {
    throw new BadRequestException(`${field} is required`);
  }

  return text;
}

function requireBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new BadRequestException(`${field} must be a boolean`);
  }

  return value;
}

function normalizeWriteBackCalendarId(
  value: unknown,
  allowedProviderCalendarIds: string[],
) {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('writeBackCalendarId must be a string');
  }

  const text = value.trim();
  if (!text) {
    return null;
  }

  if (!allowedProviderCalendarIds.includes(text)) {
    throw new BadRequestException(
      'writeBackCalendarId must match a connected calendar',
    );
  }

  return text;
}

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseProviderDateTime(value: string) {
  return new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
}

function parseGoogleEventDate(
  value: { dateTime?: string; date?: string } | undefined,
): number | null {
  if (!value) return null;
  if (value.dateTime) {
    const ms = new Date(value.dateTime).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (value.date) {
    // All-day event — Google sends YYYY-MM-DD which is midnight in the calendar
    // timezone. We treat it as UTC midnight for blocking purposes; this is
    // good enough since the slot generator also operates in UTC and the host
    // timezone is applied per-day. Worst case the all-day event blocks an
    // adjacent hour or two — acceptable for now and configurable via per-event
    // buffer.
    const ms = Date.parse(`${value.date}T00:00:00.000Z`);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function bufferKey(connectedCalendarId: string, providerEventId: string) {
  return `${connectedCalendarId} ${providerEventId}`;
}

function clampBufferMinutes(value: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 240) return 240;
  return rounded;
}
