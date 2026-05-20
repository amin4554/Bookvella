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
  pbkdf2Sync,
  randomBytes,
  sign,
  timingSafeEqual,
  verify,
} from 'crypto';
import { slugify } from '../common/slug';
import { requireText } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AccessTokenPayload,
  PublicUser,
} from './auth.types';
import type {
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 90;
const MAX_ACTIVE_SESSIONS = 2;

@Injectable()
export class AuthService {
  private readonly keyId = process.env.JWT_KEY_ID ?? 'bookvella-dev-key';
  private readonly privateKeyPem: string;
  private readonly publicKeyPem: string;

  constructor(private readonly prisma: PrismaService) {
    const privateKey = normalizePem(process.env.JWT_PRIVATE_KEY);
    const publicKey = normalizePem(process.env.JWT_PUBLIC_KEY);

    if (privateKey && publicKey) {
      this.privateKeyPem = privateKey;
      this.publicKeyPem = publicKey;
      return;
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
        throw new ConflictException('A user with that email or slug already exists');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const password = requirePassword(dto.password);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

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

  async me(payload: AccessTokenPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return toPublicUser(user);
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
}

function normalizePem(value?: string) {
  return value?.replace(/\\n/g, '\n').trim();
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

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const hash = pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString(
    'base64url',
  );

  return `pbkdf2_sha256$310000$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterations, salt, hash] = storedHash.split('$');

  if (algorithm !== 'pbkdf2_sha256' || !iterations || !salt || !hash) {
    return false;
  }

  const candidate = pbkdf2Sync(
    password,
    salt,
    Number(iterations),
    32,
    'sha256',
  );
  const stored = Buffer.from(hash, 'base64url');

  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}

function createRefreshToken() {
  return randomBytes(48).toString('base64url');
}

function hashRefreshToken(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('base64url');
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
    name: user.name,
    slug: user.slug,
    timezone: user.timezone,
  };
}
