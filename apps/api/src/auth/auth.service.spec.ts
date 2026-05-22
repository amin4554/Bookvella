import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createPrivateKey, sign } from 'crypto';
import { AuthService } from './auth.service';

// Minimal User shape matching what Prisma returns
function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    slug: 'alice',
    timezone: 'UTC',
    passwordHash: '',
    googleSub: null,
    profileImageUrl: null,
    coverImageUrl: null,
    headline: null,
    businessCategory: null,
    location: null,
    about: null,
    whatToExpect: null,
    websiteUrl: null,
    instagramUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePrisma() {
  return {
    user: {
      create: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

// ─── verifyAccessToken ────────────────────────────────────────────────────────

describe('AuthService – verifyAccessToken', () => {
  let service: AuthService;

  // Creating an AuthService generates a 2048-bit RSA key pair; do it once.
  beforeAll(() => {
    service = new AuthService(makePrisma() as any);
  });

  it('verifies a freshly signed token', () => {
    const token = (service as any).signAccessToken(makeUser());
    const payload = service.verifyAccessToken(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('alice@example.com');
  });

  it('throws on a token with too few segments', () => {
    expect(() => service.verifyAccessToken('only.two')).toThrow(
      UnauthorizedException,
    );
  });

  it('throws on a tampered signature', () => {
    const token = (service as any).signAccessToken(makeUser());
    const [h, p] = token.split('.');
    expect(() =>
      service.verifyAccessToken(`${h}.${p}.invalidsignature`),
    ).toThrow(UnauthorizedException);
  });

  it('throws on an expired token', () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredPayload = {
      sub: 'user-1',
      email: 'alice@example.com',
      slug: 'alice',
      iat: now - 100,
      exp: now - 1,           // already expired
    };
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test' }),
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const privateKey = createPrivateKey((service as any).privateKeyPem);
    const sig = sign(
      'RSA-SHA256',
      Buffer.from(`${header}.${body}`),
      privateKey,
    ).toString('base64url');

    expect(() =>
      service.verifyAccessToken(`${header}.${body}.${sig}`),
    ).toThrow(UnauthorizedException);
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('AuthService – login', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeAll(() => {
    prisma = makePrisma();
    service = new AuthService(prisma as any);
  });

  beforeEach(() => jest.clearAllMocks());

  it('throws UnauthorizedException for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@example.com', password: 'password123' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a wrong password', async () => {
    // Build a real PBKDF2 hash for "correct-password"
    const { pbkdf2Sync, randomBytes } = require('crypto');
    const salt = randomBytes(16).toString('base64url');
    const hash = pbkdf2Sync('correct-password', salt, 310000, 32, 'sha256').toString(
      'base64url',
    );
    const passwordHash = `pbkdf2_sha256$310000$${salt}$${hash}`;

    prisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash }));

    await expect(
      service.login({ email: 'alice@example.com', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws BadRequestException for a malformed email', async () => {
    await expect(
      service.login({ email: 'not-an-email', password: 'password123' }),
    ).rejects.toThrow();
  });
});

// ─── register ─────────────────────────────────────────────────────────────────

describe('AuthService – register', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeAll(() => {
    prisma = makePrisma();
    service = new AuthService(prisma as any);
  });

  beforeEach(() => jest.clearAllMocks());

  it('throws ConflictException on a duplicate email / slug (P2002)', async () => {
    prisma.user.findUnique.mockResolvedValue(null); // slug not taken
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '6.0.0' },
      ),
    );

    await expect(
      service.register({
        email: 'alice@example.com',
        password: 'password123',
        name: 'Alice',
        timezone: 'UTC',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when password is shorter than 8 characters', async () => {
    await expect(
      service.register({
        email: 'a@example.com',
        password: 'short',
        name: 'Alice',
        timezone: 'UTC',
      }),
    ).rejects.toThrow();
  });

  it('throws BadRequestException for a malformed email', async () => {
    await expect(
      service.register({
        email: 'not-an-email',
        password: 'password123',
        name: 'Alice',
        timezone: 'UTC',
      }),
    ).rejects.toThrow();
  });

  it('throws BadRequestException for an unrecognised timezone', async () => {
    await expect(
      service.register({
        email: 'a@example.com',
        password: 'password123',
        name: 'Alice',
        timezone: 'INVALID_TIMEZONE',
      }),
    ).rejects.toThrow();
  });
});
