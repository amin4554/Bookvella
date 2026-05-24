import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'crypto';
import { slugify } from '../common/slug';
import { optionalText, requireText } from '../common/validation';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload, PublicUser } from './auth.types';
import type {
  ChangePasswordDto,
  GoogleAuthDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  UpdateMeDto,
} from './dto';
import { hashPassword, verifyPassword } from './password';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 90;
const MAX_ACTIVE_SESSIONS = 2;
const PASSWORD_RESET_TTL_MINUTES = 30;

type GoogleTokenInfo = {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
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

  async register(dto: RegisterDto) {
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

      return this.issueTokenPair(user);
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

  async login(dto: LoginDto) {
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

    if (passwordCheck.needsRehash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(password) },
      });
    }

    return this.issueTokenPair(user);
  }

  async google(dto: GoogleAuthDto) {
    const profile = await this.verifyGoogleCredential(dto.credential);
    const email = normalizeEmail(profile.email);
    const timezone = normalizeTimezone(dto.timezone);
    const name = requireText(profile.name ?? email.split('@')[0], 'name');
    const existingByGoogleSub = await this.prisma.user.findUnique({
      where: { googleSub: profile.sub },
    });

    if (existingByGoogleSub) {
      return this.issueTokenPair(existingByGoogleSub);
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

      return this.issueTokenPair(linked);
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

    return this.issueTokenPair(user);
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

  private async issueTokenPair(user: User) {
    const refreshToken = createRefreshToken();

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
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
}

function normalizePem(value?: string) {
  return value?.replace(/\\n/g, '\n').trim();
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

function hashRefreshToken(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('base64url');
}

function hashResetToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
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
    hasGoogleSignIn: Boolean(user.googleSub),
    name: user.name,
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
