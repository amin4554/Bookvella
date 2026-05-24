import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  NotificationChannel,
  NotificationType,
  Prisma,
  User,
} from '@prisma/client';
import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  randomInt,
  sign,
  timingSafeEqual,
  verify,
} from 'crypto';
import { slugify } from '../common/slug';
import { optionalText, requireText } from '../common/validation';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload, PublicUser } from './auth.types';
import type {
  ChangePasswordDto,
  ConfirmAccountDeletionDto,
  ConfirmEmailChangeDto,
  GoogleAuthDto,
  LoginDto,
  LogoutDto,
  RequestEmailChangeDto,
  RefreshTokenDto,
  RegisterDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  TotpDisableDto,
  TotpVerifyDto,
  UpdateNotificationPreferencesDto,
  UpdateMeDto,
} from './dto';
import { hashPassword, verifyPassword } from './password';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 90;
const MAX_ACTIVE_SESSIONS = 2;
const PASSWORD_RESET_TTL_MINUTES = 30;
const EMAIL_CHANGE_TTL_MINUTES = 30;
const ACCOUNT_DELETION_TTL_DAYS = 30;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const BACKUP_CODE_COUNT = 10;
const DEFAULT_NOTIFICATION_PREFERENCES = [
  {
    channel: NotificationChannel.EMAIL,
    type: NotificationType.NEW_BOOKING,
    enabled: true,
    timingMinutes: null,
  },
  {
    channel: NotificationChannel.EMAIL,
    type: NotificationType.CANCELLATION,
    enabled: true,
    timingMinutes: null,
  },
  {
    channel: NotificationChannel.EMAIL,
    type: NotificationType.DAILY_AGENDA,
    enabled: true,
    timingMinutes: null,
  },
  {
    channel: NotificationChannel.EMAIL,
    type: NotificationType.REMINDER_BEFORE,
    enabled: true,
    timingMinutes: 120,
  },
  {
    channel: NotificationChannel.EMAIL,
    type: NotificationType.PRODUCT_UPDATES,
    enabled: false,
    timingMinutes: null,
  },
] as const;

type GoogleTokenInfo = {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
};

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuthService {
  private readonly keyId = process.env.JWT_KEY_ID ?? 'bookvella-dev-key';
  private readonly privateKeyPem: string;
  private readonly publicKeyPem: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService = new EmailService(),
  ) {
    const privateKey = normalizePem(process.env.JWT_PRIVATE_KEY);
    const publicKey = normalizePem(process.env.JWT_PUBLIC_KEY);

    if (privateKey && publicKey) {
      this.privateKeyPem = privateKey;
      this.publicKeyPem = publicKey;
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production',
      );
    }

    const pair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    this.privateKeyPem = pair.privateKey;
    this.publicKeyPem = pair.publicKey;
  }

  async register(dto: RegisterDto, sessionContext?: SessionContext) {
    const email = normalizeEmail(dto.email);
    const password = requirePassword(dto.password);
    const name = requireText(dto.name, 'name');
    const timezone = normalizeTimezone(dto.timezone);
    const slug = await this.createUniqueSlug(dto.slug ?? name);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: hashPassword(password),
          passwordSetAt: new Date(),
          name,
          slug,
          timezone,
        },
      });

      return this.issueTokenPair(user, sessionContext);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A user with that email or slug already exists',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto, sessionContext?: SessionContext) {
    const email = normalizeEmail(dto.email);
    const password = requirePassword(dto.password);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.passwordSetAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordCheck = verifyPassword(password, user.passwordHash);

    if (!passwordCheck.valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.totpEnabledAt && user.totpSecret) {
      await this.assertTwoFactorCode(user, dto.totpCode);
    }

    if (passwordCheck.needsRehash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      });
    }

    return this.issueTokenPair(user, sessionContext);
  }

  async google(dto: GoogleAuthDto, sessionContext?: SessionContext) {
    const profile = await this.verifyGoogleCredential(dto.credential);
    const email = normalizeEmail(profile.email);
    const timezone = normalizeTimezone(dto.timezone);
    const name = requireText(profile.name ?? email.split('@')[0], 'name');
    const existingByGoogleSub = await this.prisma.user.findUnique({
      where: { googleSub: profile.sub },
    });

    if (existingByGoogleSub) {
      return this.issueTokenPair(existingByGoogleSub, sessionContext);
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      const linked = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleSub: profile.sub,
          profileImageUrl:
            existingByEmail.profileImageUrl ?? optionalText(profile.picture),
        },
      });

      return this.issueTokenPair(linked, sessionContext);
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(createRefreshToken()),
        passwordSetAt: null,
        googleSub: profile.sub,
        name,
        slug: await this.createUniqueSlug(name),
        timezone,
        profileImageUrl: optionalText(profile.picture),
      },
    });

    return this.issueTokenPair(user, sessionContext);
  }

  async refresh(dto: RefreshTokenDto) {
    const refreshToken = requireText(dto.refreshToken, 'refreshToken');
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshTokenHash,
        isActive: true,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!session) {
      throw new UnauthorizedException({
        message: 'Session not found or inactive',
        errorCode: 498,
        expired: false,
      });
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false, lastUsedAt: new Date() },
      });

      throw new UnauthorizedException({
        message: 'Refresh token has expired',
        errorCode: 419,
        expired: true,
      });
    }

    const newRefreshToken = createRefreshToken();
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: hashRefreshToken(newRefreshToken),
        expiresAt: refreshExpiryDate(),
        lastUsedAt: new Date(),
      },
    });

    return {
      user: toPublicUser(session.user),
      accessToken: this.signAccessToken(session.user),
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async logout(dto: LogoutDto) {
    const refreshToken = requireText(dto.refreshToken, 'refreshToken');
    const result = await this.prisma.userSession.updateMany({
      where: {
        refreshTokenHash: hashRefreshToken(refreshToken),
        isActive: true,
      },
      data: {
        isActive: false,
        lastUsedAt: new Date(),
      },
    });

    return {
      success: result.count > 0,
    };
  }

  async listSessions(
    payload: AccessTokenPayload,
    currentRefreshToken?: string,
  ) {
    const currentRefreshTokenHash = currentRefreshToken
      ? hashRefreshToken(currentRefreshToken)
      : null;
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId: payload.sub,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    });

    return sessions.map((session) => {
      const client = parseUserAgent(session.userAgent);

      return {
        id: session.id,
        isCurrent: currentRefreshTokenHash
          ? timingSafeEqualText(
              session.refreshTokenHash,
              currentRefreshTokenHash,
            )
          : false,
        userAgent: session.userAgent,
        browser: client.browser,
        os: client.os,
        deviceLabel: client.deviceLabel,
        ipAddress: session.ipAddress,
        ipRegion: session.ipRegion,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      };
    });
  }

  async revokeSession(
    payload: AccessTokenPayload,
    sessionId: string,
    currentRefreshToken?: string,
  ) {
    const id = requireText(sessionId, 'sessionId');
    const session = await this.prisma.userSession.findFirst({
      where: {
        id,
        userId: payload.sub,
        isActive: true,
      },
    });

    if (!session) {
      return {
        success: false,
        revokedCurrent: false,
      };
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        isActive: false,
        lastUsedAt: new Date(),
      },
    });

    return {
      success: true,
      revokedCurrent: currentRefreshToken
        ? timingSafeEqualText(
            session.refreshTokenHash,
            hashRefreshToken(currentRefreshToken),
          )
        : false,
    };
  }

  async revokeOtherSessions(
    payload: AccessTokenPayload,
    currentRefreshToken?: string,
  ) {
    const refreshToken = requireText(currentRefreshToken, 'refreshToken');
    const currentSession = await this.prisma.userSession.findFirst({
      where: {
        userId: payload.sub,
        refreshTokenHash: hashRefreshToken(refreshToken),
        isActive: true,
      },
    });

    if (!currentSession) {
      throw new BadRequestException('Current session was not found');
    }

    const result = await this.prisma.userSession.updateMany({
      where: {
        userId: payload.sub,
        isActive: true,
        id: {
          not: currentSession.id,
        },
      },
      data: {
        isActive: false,
        lastUsedAt: new Date(),
      },
    });

    return {
      success: true,
      revokedCount: result.count,
    };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = createResetToken();
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
      );

      await this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt,
        },
      });

      await this.sendPasswordResetEmail(user, token, expiresAt);
    }

    return {
      success: true,
      message:
        'If that email belongs to a Bookvella account, a reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = requireText(dto.token, 'token');
    const newPassword = requirePassword(dto.newPassword);
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new BadRequestException(
        'Password reset link is invalid or expired',
      );
    }

    const now = new Date();
    await this.prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: now },
    });
    await this.prisma.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash: hashPassword(newPassword),
        passwordSetAt: now,
      },
    });
    await this.prisma.userSession.updateMany({
      where: {
        userId: reset.userId,
        isActive: true,
      },
      data: {
        isActive: false,
        lastUsedAt: now,
      },
    });

    return { success: true };
  }

  async me(payload: AccessTokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return toPublicUser(user);
  }

  async updateMe(payload: AccessTokenPayload, dto: UpdateMeDto) {
    const data: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = requireText(dto.name, 'name');
    }

    if (dto.businessDisplayName !== undefined) {
      data.businessDisplayName = optionalText(dto.businessDisplayName);
    }

    if (dto.slug !== undefined) {
      data.slug = slugify(dto.slug);
    }

    if (dto.timezone !== undefined) {
      data.timezone = normalizeTimezone(dto.timezone);
    }

    if (dto.profileImageUrl !== undefined) {
      data.profileImageUrl = optionalUrl(
        dto.profileImageUrl,
        'profileImageUrl',
      );
    }

    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = optionalUrl(dto.coverImageUrl, 'coverImageUrl');
    }

    if (dto.headline !== undefined) {
      data.headline = optionalText(dto.headline);
    }

    if (dto.businessCategory !== undefined) {
      data.businessCategory = optionalText(dto.businessCategory);
    }

    if (dto.location !== undefined) {
      data.location = optionalText(dto.location);
    }

    if (dto.about !== undefined) {
      data.about = optionalText(dto.about);
    }

    if (dto.whatToExpect !== undefined) {
      data.whatToExpect = optionalText(dto.whatToExpect);
    }

    if (dto.websiteUrl !== undefined) {
      data.websiteUrl = optionalUrl(dto.websiteUrl, 'websiteUrl');
    }

    if (dto.instagramUrl !== undefined) {
      data.instagramUrl = optionalUrl(dto.instagramUrl, 'instagramUrl');
    }

    if (dto.isActive !== undefined) {
      data.isActive = Boolean(dto.isActive);
      data.deactivatedAt = dto.isActive ? null : new Date();
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: payload.sub },
        data,
      });

      return toPublicUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('That public link is already taken');
      }

      throw error;
    }
  }

  async getNotificationPreferences(payload: AccessTokenPayload) {
    const saved = await this.prisma.notificationPreference.findMany({
      where: { userId: payload.sub },
      orderBy: [{ channel: 'asc' }, { type: 'asc' }],
    });

    return {
      preferences: mergeNotificationPreferences(saved).map(
        toNotificationPreferenceResponse,
      ),
    };
  }

  async updateNotificationPreferences(
    payload: AccessTokenPayload,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const preferences = Array.isArray(dto.preferences) ? dto.preferences : [];

    if (preferences.length === 0) {
      throw new BadRequestException('At least one preference is required');
    }

    await this.prisma.$transaction(
      preferences.map((preference) => {
        const data = normalizeNotificationPreference(preference);

        return this.prisma.notificationPreference.upsert({
          where: {
            userId_channel_type: {
              userId: payload.sub,
              channel: data.channel,
              type: data.type,
            },
          },
          create: {
            userId: payload.sub,
            ...data,
          },
          update: {
            enabled: data.enabled,
            timingMinutes: data.timingMinutes,
          },
        });
      }),
    );

    return this.getNotificationPreferences(payload);
  }

  async requestAccountDeletion(payload: AccessTokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const token = createResetToken();
    const expiresAt = new Date(
      Date.now() + ACCOUNT_DELETION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.accountDeletionRequest.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt,
      },
      update: {
        tokenHash: hashResetToken(token),
        expiresAt,
        confirmedAt: null,
      },
    });
    await this.sendAccountDeletionEmail(user, token, expiresAt);

    return { success: true, expiresAt: expiresAt.toISOString() };
  }

  async confirmAccountDeletion(dto: ConfirmAccountDeletionDto) {
    const token = requireText(dto.token, 'token');
    const request = await this.prisma.accountDeletionRequest.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true },
    });

    if (!request || request.confirmedAt || request.expiresAt <= new Date()) {
      throw new BadRequestException(
        'Account deletion link is invalid or expired',
      );
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.accountDeletionRequest.update({
        where: { userId: request.userId },
        data: { confirmedAt: now },
      });
      await tx.user.update({
        where: { id: request.userId },
        data: anonymizedUserData(request.userId, now),
      });
      await tx.userSession.updateMany({
        where: { userId: request.userId, isActive: true },
        data: { isActive: false, lastUsedAt: now },
      });
    });

    return { success: true };
  }

  async changePassword(payload: AccessTokenPayload, dto: ChangePasswordDto) {
    const newPassword = requirePassword(dto.newPassword);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.passwordSetAt) {
      const currentPassword = requirePassword(dto.currentPassword);
      const passwordCheck = verifyPassword(currentPassword, user.passwordHash);

      if (!passwordCheck.valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    } else if (!user.googleSub) {
      throw new BadRequestException('This account cannot set a password here');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(newPassword),
        passwordSetAt: new Date(),
      },
    });

    return toPublicUser(updated);
  }

  async disconnectGoogle(payload: AccessTokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.googleSub) {
      throw new BadRequestException('Google sign-in is not connected');
    }

    if (!user.passwordSetAt) {
      throw new BadRequestException(
        'Add a password before disconnecting Google sign-in',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        googleSub: null,
      },
    });

    return toPublicUser(updated);
  }

  async enrollTotp(payload: AccessTokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.totpEnabledAt) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }

    const secret = createTotpSecret();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecret: secret,
        totpEnabledAt: null,
      },
    });
    await this.prisma.userBackupCode.deleteMany({
      where: { userId: user.id },
    });

    return {
      secret,
      otpauthUrl: buildTotpUri(secret, user.email),
    };
  }

  async verifyTotpEnrollment(payload: AccessTokenPayload, dto: TotpVerifyDto) {
    const code = requireText(dto.code, 'code');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.totpSecret) {
      throw new BadRequestException('Start two-factor enrollment first');
    }

    if (user.totpEnabledAt) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }

    if (!verifyTotpCode(user.totpSecret, code)) {
      throw new BadRequestException('Invalid two-factor authentication code');
    }

    const backupCodes = createBackupCodes();
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const changedUser = await tx.user.update({
        where: { id: user.id },
        data: { totpEnabledAt: now },
      });
      await tx.userBackupCode.deleteMany({
        where: { userId: user.id },
      });
      await tx.userBackupCode.createMany({
        data: backupCodes.map((backupCode) => ({
          userId: user.id,
          codeHash: hashBackupCode(user.id, backupCode),
        })),
      });
      return changedUser;
    });

    return {
      success: true,
      backupCodes,
      user: toPublicUser(updated),
    };
  }

  async disableTotp(payload: AccessTokenPayload, dto: TotpDisableDto) {
    const code = requireText(dto.code, 'code');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.totpEnabledAt || !user.totpSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    await this.assertTwoFactorCode(user, code);

    const updated = await this.prisma.$transaction(async (tx) => {
      const changedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          totpSecret: null,
          totpEnabledAt: null,
        },
      });
      await tx.userBackupCode.deleteMany({
        where: { userId: user.id },
      });
      return changedUser;
    });

    return {
      success: true,
      user: toPublicUser(updated),
    };
  }

  async requestEmailChange(
    payload: AccessTokenPayload,
    dto: RequestEmailChangeDto,
  ) {
    const newEmail = normalizeEmail(dto.newEmail);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (newEmail === user.email) {
      throw new BadRequestException('Choose a different email address');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (existing && existing.id !== user.id) {
      throw new ConflictException('That email is already in use');
    }

    const token = createEmailChangeToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + EMAIL_CHANGE_TTL_MINUTES * 60 * 1000,
    );

    await this.prisma.accountEmailChange.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    await this.prisma.accountEmailChange.create({
      data: {
        userId: user.id,
        newEmail,
        tokenHash: hashEmailChangeToken(user.id, newEmail, token),
        expiresAt,
      },
    });

    await this.sendEmailChangeConfirmation(user, newEmail, token, expiresAt);

    return {
      success: true,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmEmailChange(
    payload: AccessTokenPayload,
    dto: ConfirmEmailChangeDto,
  ) {
    const token = requireText(dto.token, 'token');
    const pending = await this.prisma.accountEmailChange.findFirst({
      where: {
        userId: payload.sub,
        usedAt: null,
      },
      include: { user: true },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (
      !pending ||
      pending.expiresAt <= new Date() ||
      pending.tokenHash !==
        hashEmailChangeToken(pending.userId, pending.newEmail, token)
    ) {
      throw new BadRequestException(
        'Email confirmation code is invalid or expired',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: pending.newEmail },
    });

    if (existing && existing.id !== pending.userId) {
      throw new ConflictException('That email is already in use');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.accountEmailChange.update({
        where: { id: pending.id },
        data: { usedAt: now },
      });
      const changedUser = await tx.user.update({
        where: { id: pending.userId },
        data: {
          email: pending.newEmail,
        },
      });
      await tx.userSession.updateMany({
        where: {
          userId: pending.userId,
          isActive: true,
        },
        data: {
          isActive: false,
          lastUsedAt: now,
        },
      });
      return changedUser;
    });

    await this.sendEmailChangeNotice(pending.user, updated.email);

    return {
      success: true,
      user: toPublicUser(updated),
    };
  }

  getJwks() {
    const publicKey = createPublicKey(this.publicKeyPem);
    const jwk = publicKey.export({ format: 'jwk' });

    return {
      keys: [
        {
          kty: jwk.kty,
          kid: this.keyId,
          use: 'sig',
          alg: 'RS256',
          n: jwk.n,
          e: jwk.e,
        },
      ],
    };
  }

  private async assertTwoFactorCode(
    user: Pick<User, 'id' | 'totpSecret'>,
    code: string | undefined,
  ) {
    if (!code) {
      throw new UnauthorizedException({
        message: 'Two-factor authentication code required',
        errorCode: 'TOTP_REQUIRED',
        requiresTwoFactor: true,
      });
    }

    if (user.totpSecret && verifyTotpCode(user.totpSecret, code)) {
      return;
    }

    const backupCodeHash = hashBackupCode(user.id, code);
    const backupCode = await this.prisma.userBackupCode.findFirst({
      where: {
        userId: user.id,
        codeHash: backupCodeHash,
        usedAt: null,
      },
    });

    if (backupCode) {
      await this.prisma.userBackupCode.update({
        where: { id: backupCode.id },
        data: { usedAt: new Date() },
      });
      return;
    }

    throw new UnauthorizedException('Invalid two-factor authentication code');
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new UnauthorizedException('Malformed token');
    }

    const signedData = `${encodedHeader}.${encodedPayload}`;
    const signature = Buffer.from(encodedSignature, 'base64url');
    const isValid = verify(
      'RSA-SHA256',
      Buffer.from(signedData),
      createPublicKey(this.publicKeyPem),
      signature,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid token signature');
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as AccessTokenPayload;

    if (!payload.sub || !payload.exp) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token has expired');
    }

    return payload;
  }

  private async verifyGoogleCredential(credential: string | undefined) {
    const idToken = requireText(credential, 'credential');
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

    if (!clientId) {
      throw new BadRequestException('GOOGLE_CLIENT_ID is not configured');
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );

    if (!response.ok) {
      throw new UnauthorizedException('Google sign-in could not be verified');
    }

    const profile = (await response.json()) as GoogleTokenInfo;

    if (profile.aud !== clientId) {
      throw new UnauthorizedException('Google credential audience mismatch');
    }

    if (
      profile.iss !== 'accounts.google.com' &&
      profile.iss !== 'https://accounts.google.com'
    ) {
      throw new UnauthorizedException('Google credential issuer mismatch');
    }

    if (profile.email_verified !== 'true' && profile.email_verified !== true) {
      throw new UnauthorizedException('Google email is not verified');
    }

    if (!profile.sub || !profile.email) {
      throw new UnauthorizedException('Google profile is incomplete');
    }

    return profile;
  }

  private async issueTokenPair(user: User, sessionContext?: SessionContext) {
    const refreshToken = createRefreshToken();
    const ipAddress = optionalText(sessionContext?.ipAddress);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        userAgent: optionalText(sessionContext?.userAgent),
        ipAddress,
        ipRegion: describeIpRegion(ipAddress),
        expiresAt: refreshExpiryDate(),
        lastUsedAt: new Date(),
      },
    });
    await this.enforceSessionLimit(user.id);

    return {
      user: toPublicUser(user),
      accessToken: this.signAccessToken(user),
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private signAccessToken(user: User) {
    const now = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      slug: user.slug,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    };
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: this.keyId,
    };
    const encodedHeader = encodeJson(header);
    const encodedPayload = encodeJson(payload);
    const signature = sign(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      createPrivateKey(this.privateKeyPem),
    ).toString('base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private async enforceSessionLimit(userId: string) {
    const activeSessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
      },
    });

    const overflow = activeSessions.length - MAX_ACTIVE_SESSIONS;

    if (overflow <= 0) {
      return;
    }

    await this.prisma.userSession.updateMany({
      where: {
        id: {
          in: activeSessions.slice(0, overflow).map((session) => session.id),
        },
      },
      data: {
        isActive: false,
      },
    });
  }

  private async createUniqueSlug(input: string) {
    const baseSlug = slugify(input);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const existing = await this.prisma.user.findUnique({ where: { slug } });

      if (!existing) {
        return slug;
      }
    }

    return `${baseSlug}-${randomBytes(3).toString('hex')}`;
  }

  private async sendPasswordResetEmail(
    user: User,
    token: string,
    expiresAt: Date,
  ) {
    const resetUrl = buildPasswordResetUrl(token);
    const text = [
      `Hi ${user.name},`,
      '',
      'We received a request to reset your Bookvella password.',
      `Use this link within ${PASSWORD_RESET_TTL_MINUTES} minutes:`,
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
      '',
      'Bookvella',
    ].join('\n');

    await this.emailService.sendMail({
      to: user.email,
      subject: 'Reset your Bookvella password',
      text,
      html: [
        `<p>Hi ${escapeHtml(user.name)},</p>`,
        '<p>We received a request to reset your Bookvella password.</p>',
        `<p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>`,
        `<p>This link expires at ${escapeHtml(expiresAt.toISOString())}.</p>`,
        '<p>If you did not request this, you can ignore this email.</p>',
      ].join(''),
    });
  }

  private async sendEmailChangeConfirmation(
    user: User,
    newEmail: string,
    token: string,
    expiresAt: Date,
  ) {
    const text = [
      `Hi ${user.name},`,
      '',
      'Use this Bookvella code to confirm your new account email:',
      token,
      '',
      `This code expires in ${EMAIL_CHANGE_TTL_MINUTES} minutes.`,
      'If you did not request this change, you can ignore this email.',
      '',
      'Bookvella',
    ].join('\n');

    await this.emailService.sendMail({
      to: newEmail,
      subject: 'Confirm your new Bookvella email',
      text,
      html: [
        `<p>Hi ${escapeHtml(user.name)},</p>`,
        '<p>Use this Bookvella code to confirm your new account email:</p>',
        `<p><strong>${escapeHtml(token)}</strong></p>`,
        `<p>This code expires at ${escapeHtml(expiresAt.toISOString())}.</p>`,
        '<p>If you did not request this change, you can ignore this email.</p>',
      ].join(''),
    });
  }

  private async sendEmailChangeNotice(user: User, newEmail: string) {
    const text = [
      `Hi ${user.name},`,
      '',
      `Your Bookvella account email was changed to ${newEmail}.`,
      'All active sessions were signed out. Sign in again with the new email to continue.',
      '',
      'If you did not make this change, reset your password immediately and contact Bookvella support.',
      '',
      'Bookvella',
    ].join('\n');

    await this.emailService.sendMail({
      to: user.email,
      subject: 'Your Bookvella email was changed',
      text,
      html: [
        `<p>Hi ${escapeHtml(user.name)},</p>`,
        `<p>Your Bookvella account email was changed to ${escapeHtml(newEmail)}.</p>`,
        '<p>All active sessions were signed out. Sign in again with the new email to continue.</p>',
        '<p>If you did not make this change, reset your password immediately and contact Bookvella support.</p>',
      ].join(''),
    });
  }

  private async sendAccountDeletionEmail(
    user: User,
    token: string,
    expiresAt: Date,
  ) {
    const deleteUrl = buildAccountDeletionUrl(token);
    const text = [
      `Hi ${user.name},`,
      '',
      'We received a request to delete your Bookvella account.',
      `Confirm deletion within ${ACCOUNT_DELETION_TTL_DAYS} days:`,
      deleteUrl,
      '',
      'If you did not request this, ignore this email and keep your account active.',
      '',
      'Bookvella',
    ].join('\n');

    await this.emailService.sendMail({
      to: user.email,
      subject: 'Confirm Bookvella account deletion',
      text,
      html: [
        `<p>Hi ${escapeHtml(user.name)},</p>`,
        '<p>We received a request to delete your Bookvella account.</p>',
        `<p><a href="${escapeHtml(deleteUrl)}">Confirm account deletion</a></p>`,
        `<p>This link expires at ${escapeHtml(expiresAt.toISOString())}.</p>`,
        '<p>If you did not request this, ignore this email and keep your account active.</p>',
      ].join(''),
    });
  }
}

function normalizePem(value?: string) {
  return value?.replace(/\\n/g, '\n').trim();
}

function mergeNotificationPreferences(
  saved: {
    channel: NotificationChannel;
    type: NotificationType;
    enabled: boolean;
    timingMinutes: number | null;
  }[],
) {
  const byKey = new Map(
    saved.map((preference) => [
      notificationPreferenceKey(preference.channel, preference.type),
      preference,
    ]),
  );

  return DEFAULT_NOTIFICATION_PREFERENCES.map((preference) => ({
    ...preference,
    ...byKey.get(
      notificationPreferenceKey(preference.channel, preference.type),
    ),
  }));
}

function normalizeNotificationPreference(preference: {
  channel?: string;
  type?: string;
  enabled?: boolean;
  timingMinutes?: number | null;
}) {
  const channel = parseNotificationChannel(preference.channel);
  const type = parseNotificationType(preference.type);

  if (typeof preference.enabled !== 'boolean') {
    throw new BadRequestException('Notification enabled must be a boolean');
  }

  const timingMinutes =
    preference.timingMinutes === null || preference.timingMinutes === undefined
      ? null
      : Number(preference.timingMinutes);

  if (
    timingMinutes !== null &&
    (!Number.isInteger(timingMinutes) ||
      timingMinutes < 5 ||
      timingMinutes > 24 * 60)
  ) {
    throw new BadRequestException(
      'Notification timingMinutes must be between 5 and 1440',
    );
  }

  return {
    channel,
    type,
    enabled: preference.enabled,
    timingMinutes:
      type === NotificationType.REMINDER_BEFORE ? timingMinutes : null,
  };
}

function parseNotificationChannel(value?: string) {
  switch (value?.trim().toLowerCase()) {
    case 'email':
      return NotificationChannel.EMAIL;
    case 'sms':
      return NotificationChannel.SMS;
    default:
      throw new BadRequestException('Unsupported notification channel');
  }
}

function parseNotificationType(value?: string) {
  switch (value?.trim().toLowerCase()) {
    case 'new_booking':
      return NotificationType.NEW_BOOKING;
    case 'cancellation':
      return NotificationType.CANCELLATION;
    case 'daily_agenda':
      return NotificationType.DAILY_AGENDA;
    case 'reminder_before':
      return NotificationType.REMINDER_BEFORE;
    case 'product_updates':
      return NotificationType.PRODUCT_UPDATES;
    default:
      throw new BadRequestException('Unsupported notification type');
  }
}

function toNotificationPreferenceResponse(preference: {
  channel: NotificationChannel;
  type: NotificationType;
  enabled: boolean;
  timingMinutes: number | null;
}) {
  return {
    channel: preference.channel.toLowerCase(),
    type: preference.type.toLowerCase(),
    enabled: preference.enabled,
    timingMinutes: preference.timingMinutes,
  };
}

function notificationPreferenceKey(
  channel: NotificationChannel,
  type: NotificationType,
) {
  return `${channel}:${type}`;
}

function optionalUrl(value: string | null | undefined, field: string) {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Invalid protocol');
    }

    return url.toString();
  } catch {
    throw new BadRequestException(`${field} must be a valid URL`);
  }
}

function normalizeEmail(value?: string) {
  const email = value?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('A valid email is required');
  }

  return email;
}

function requirePassword(value?: string) {
  if (!value || value.length < 8) {
    throw new BadRequestException('Password must be at least 8 characters');
  }

  return value;
}

function normalizeTimezone(value?: string) {
  const timezone = value?.trim() || 'UTC';

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    throw new BadRequestException('Invalid timezone');
  }
}

function createRefreshToken() {
  return randomBytes(48).toString('base64url');
}

function createResetToken() {
  return randomBytes(48).toString('base64url');
}

function createEmailChangeToken() {
  return randomInt(100000, 1000000).toString();
}

function createTotpSecret() {
  return base32Encode(randomBytes(20));
}

function createBackupCodes() {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const value = base32Encode(randomBytes(6)).slice(0, 10);
    return `${value.slice(0, 5)}-${value.slice(5)}`;
  });
}

function hashRefreshToken(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('base64url');
}

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

function hashEmailChangeToken(userId: string, newEmail: string, token: string) {
  return createHash('sha256')
    .update(`${userId}\0${newEmail}\0${token}`)
    .digest('base64url');
}

function hashBackupCode(userId: string, code: string) {
  return createHash('sha256')
    .update(`${userId}\0${normalizeBackupCode(code)}`)
    .digest('base64url');
}

function verifyTotpCode(secret: string, code: string) {
  const normalized = normalizeTotpCode(code);

  if (!normalized) {
    return false;
  }

  try {
    const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);

    for (let drift = -1; drift <= 1; drift += 1) {
      if (
        timingSafeEqualText(
          generateTotpCode(secret, counter + drift),
          normalized,
        )
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function generateTotpCode(secret: string, counter: number) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;

  counterBuffer.writeUInt32BE(high, 0);
  counterBuffer.writeUInt32BE(low, 4);

  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

function normalizeTotpCode(code: string) {
  const normalized = code.trim().replace(/\s/g, '');
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

function normalizeBackupCode(code: string) {
  return code.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function parseUserAgent(userAgent: string | null) {
  const value = userAgent ?? '';
  const browser = /\bEdg\//.test(value)
    ? 'Edge'
    : /\bChrome\//.test(value)
      ? 'Chrome'
      : /\bFirefox\//.test(value)
        ? 'Firefox'
        : /\bSafari\//.test(value)
          ? 'Safari'
          : 'Unknown browser';
  const os = /\bWindows NT\b/.test(value)
    ? 'Windows'
    : /\bMac OS X\b/.test(value)
      ? 'macOS'
      : /\b(iPhone|iPad|iPod)\b/.test(value)
        ? 'iOS'
        : /\bAndroid\b/.test(value)
          ? 'Android'
          : /\bLinux\b/.test(value)
            ? 'Linux'
            : 'Unknown OS';

  return {
    browser,
    os,
    deviceLabel: `${browser} on ${os}`,
  };
}

function describeIpRegion(ipAddress: string | null) {
  if (!ipAddress) {
    return null;
  }

  const value = ipAddress.replace(/^::ffff:/, '');

  if (
    value === '::1' ||
    value === '127.0.0.1' ||
    value.startsWith('10.') ||
    value.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value)
  ) {
    return 'Local network';
  }

  return null;
}

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function base32Encode(buffer: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let output = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = value.toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let buffer = 0;

  for (const character of clean) {
    const index = alphabet.indexOf(character);

    if (index === -1) {
      throw new Error('Invalid base32 secret');
    }

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function buildPasswordResetUrl(token: string) {
  const baseUrl =
    process.env.PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3001';
  const url = new URL('/reset-password', baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

function buildAccountDeletionUrl(token: string) {
  const baseUrl =
    process.env.PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3001';
  const url = new URL('/dashboard/settings', baseUrl);
  url.searchParams.set('deleteToken', token);
  return url.toString();
}

function buildTotpUri(secret: string, email: string) {
  const issuer = 'Bookvella';
  const label = `${issuer}:${email}`;
  const url = new URL(`otpauth://totp/${encodeURIComponent(label)}`);
  url.searchParams.set('secret', secret);
  url.searchParams.set('issuer', issuer);
  url.searchParams.set('algorithm', 'SHA1');
  url.searchParams.set('digits', String(TOTP_DIGITS));
  url.searchParams.set('period', String(TOTP_PERIOD_SECONDS));
  return url.toString();
}

function refreshExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    hasPassword: Boolean(user.passwordSetAt),
    passwordSetAt: user.passwordSetAt?.toISOString() ?? null,
    hasGoogleSignIn: Boolean(user.googleSub),
    hasTwoFactor: Boolean(user.totpEnabledAt),
    isActive: user.isActive,
    name: user.name,
    businessDisplayName: user.businessDisplayName,
    slug: user.slug,
    timezone: user.timezone,
    profileImageUrl: user.profileImageUrl,
    coverImageUrl: user.coverImageUrl,
    headline: user.headline,
    businessCategory: user.businessCategory,
    location: user.location,
    about: user.about,
    whatToExpect: user.whatToExpect,
    websiteUrl: user.websiteUrl,
    instagramUrl: user.instagramUrl,
  };
}

function anonymizedUserData(userId: string, now: Date): Prisma.UserUpdateInput {
  const suffix = userId.slice(0, 8).toLowerCase();

  return {
    email: `deleted-${suffix}@deleted.bookvella.local`,
    passwordHash: hashPassword(createRefreshToken()),
    passwordSetAt: null,
    googleSub: null,
    name: 'Deleted account',
    businessDisplayName: null,
    slug: `deleted-${suffix}`,
    timezone: 'UTC',
    profileImageUrl: null,
    coverImageUrl: null,
    headline: null,
    businessCategory: null,
    location: null,
    about: null,
    whatToExpect: null,
    websiteUrl: null,
    instagramUrl: null,
    isActive: false,
    deactivatedAt: now,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
