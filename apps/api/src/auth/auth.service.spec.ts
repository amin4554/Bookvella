import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, createPrivateKey, sign } from 'crypto';
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
    passwordSetAt: new Date('2026-01-01T00:00:00.000Z'),
    googleSub: null,
    totpSecret: null,
    totpEnabledAt: null,
    isActive: true,
    deactivatedAt: null,
    businessDisplayName: null,
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
    accountEmailChange: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    userBackupCode: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 10 }),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    notificationPreference: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    accountDeletionRequest: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    accountActionOtp: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callbackOrQueries) =>
      Array.isArray(callbackOrQueries)
        ? Promise.all(callbackOrQueries)
        : callbackOrQueries(makePrisma()),
    ),
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
      exp: now - 1, // already expired
    };
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test' }),
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(expiredPayload)).toString(
      'base64url',
    );
    const privateKey = createPrivateKey((service as any).privateKeyPem);
    const sig = sign(
      'RSA-SHA256',
      Buffer.from(`${header}.${body}`),
      privateKey,
    ).toString('base64url');

    expect(() => service.verifyAccessToken(`${header}.${body}.${sig}`)).toThrow(
      UnauthorizedException,
    );
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
    const hash = pbkdf2Sync(
      'correct-password',
      salt,
      310000,
      32,
      'sha256',
    ).toString('base64url');
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

  it('requires a two-factor code when TOTP is enabled', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({
        passwordHash: createTestPasswordHash('password123'),
        totpSecret: 'JBSWY3DPEHPK3PXP',
        totpEnabledAt: new Date(),
      }),
    );

    await expect(
      service.login({ email: 'alice@example.com', password: 'password123' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.userSession.create).not.toHaveBeenCalled();
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

describe('AuthService email change', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;
  let emailService: { sendMail: jest.Mock };

  beforeEach(() => {
    prisma = makePrisma();
    emailService = {
      sendMail: jest.fn().mockResolvedValue({ delivered: true }),
    };
    service = new AuthService(prisma as any, emailService as any);
  });

  it('sends an OTP to the current email when starting an email change', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(null);

    await expect(
      service.requestEmailChangeOtp(
        {
          sub: 'user-1',
          email: 'alice@example.com',
          slug: 'alice',
          iat: 1,
          exp: 2,
        },
        { newEmail: ' New@Example.com ' },
      ),
    ).resolves.toMatchObject({ success: true });

    expect(prisma.accountActionOtp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        purpose: 'CHANGE_EMAIL',
        userId: 'user-1',
        email: 'alice@example.com',
        payload: { newEmail: 'new@example.com' },
      }),
    });
    expect(emailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@example.com',
        subject: 'Confirm your Bookvella email change',
      }),
    );
  });

  it('after current-email OTP, creates a single-use confirmation token and sends it to the new email', async () => {
    const code = '424242';
    prisma.user.findUnique
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce(null);
    prisma.accountActionOtp.findFirst.mockResolvedValueOnce({
      id: 'otp-1',
      attempts: 0,
      maxAttempts: 5,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      codeHash: hashTestOtpCode(code),
      payload: { newEmail: 'new@example.com' },
    });

    await expect(
      service.requestEmailChange(
        {
          sub: 'user-1',
          email: 'alice@example.com',
          slug: 'alice',
          iat: 1,
          exp: 2,
        },
        { newEmail: ' New@Example.com ', otpCode: code },
      ),
    ).resolves.toMatchObject({ success: true });

    expect(prisma.accountEmailChange.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.accountEmailChange.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        newEmail: 'new@example.com',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      },
    });
    expect(emailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        subject: 'Confirm your new Bookvella email',
      }),
    );
  });

  it('confirms a pending email change, revokes sessions, and notifies the old email', async () => {
    const token = '123456';
    const pending = {
      id: 'change-1',
      userId: 'user-1',
      newEmail: 'new@example.com',
      tokenHash: hashTestEmailChangeToken('user-1', 'new@example.com', token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(),
      user: makeUser(),
    };
    const tx = makePrisma();
    tx.user.update.mockResolvedValue(makeUser({ email: 'new@example.com' }));
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    prisma.accountEmailChange.findFirst.mockResolvedValue(pending);
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.confirmEmailChange(
        {
          sub: 'user-1',
          email: 'alice@example.com',
          slug: 'alice',
          iat: 1,
          exp: 2,
        },
        { token },
      ),
    ).resolves.toMatchObject({
      success: true,
      user: expect.objectContaining({ email: 'new@example.com' }),
    });

    expect(tx.accountEmailChange.update).toHaveBeenCalledWith({
      where: { id: 'change-1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(tx.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true },
      data: { isActive: false, lastUsedAt: expect.any(Date) },
    });
    expect(emailService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@example.com',
        subject: 'Your Bookvella email was changed',
      }),
    );
  });
});

describe('AuthService Google disconnect', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuthService(prisma as any);
  });

  it('disconnects Google sign-in when the account has a password', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ googleSub: 'google-sub-1' }),
    );
    prisma.user.update.mockResolvedValue(makeUser({ googleSub: null }));

    await expect(
      service.disconnectGoogle({
        sub: 'user-1',
        email: 'alice@example.com',
        slug: 'alice',
        iat: 1,
        exp: 2,
      }),
    ).resolves.toMatchObject({
      hasGoogleSignIn: false,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { googleSub: null },
    });
  });

  it('requires a password before disconnecting Google sign-in', async () => {
    prisma.user.findUnique.mockResolvedValue(
      makeUser({ googleSub: 'google-sub-1', passwordSetAt: null }),
    );

    await expect(
      service.disconnectGoogle({
        sub: 'user-1',
        email: 'alice@example.com',
        slug: 'alice',
        iat: 1,
        exp: 2,
      }),
    ).rejects.toThrow('Add a password before disconnecting Google sign-in');
  });
});

describe('AuthService two-factor enrollment', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuthService(prisma as any);
  });

  it('starts TOTP enrollment with a generated secret and otpauth URL', async () => {
    prisma.user.findUnique.mockResolvedValue(makeUser());

    await expect(
      service.enrollTotp({
        sub: 'user-1',
        email: 'alice@example.com',
        slug: 'alice',
        iat: 1,
        exp: 2,
      }),
    ).resolves.toMatchObject({
      secret: expect.any(String),
      otpauthUrl: expect.stringContaining('otpauth://totp/'),
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        totpSecret: expect.any(String),
        totpEnabledAt: null,
      },
    });
    expect(prisma.userBackupCode.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });
});

describe('AuthService sessions', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuthService(prisma as any);
  });

  it('captures session metadata and marks the current session in the list', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(makeUser());

    const issued = await service.register(
      {
        email: 'alice@example.com',
        password: 'password123',
        name: 'Alice',
        timezone: 'UTC',
      },
      {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
        ipAddress: '127.0.0.1',
      },
    );
    const createdSession = prisma.userSession.create.mock.calls[0][0].data;

    expect(createdSession).toMatchObject({
      userAgent: expect.stringContaining('Chrome'),
      ipAddress: '127.0.0.1',
      ipRegion: 'Local network',
    });

    prisma.userSession.findMany.mockResolvedValue([
      {
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: createdSession.refreshTokenHash,
        userAgent: createdSession.userAgent,
        ipAddress: createdSession.ipAddress,
        ipRegion: createdSession.ipRegion,
        expiresAt: new Date(Date.now() + 60_000),
        isActive: true,
        lastUsedAt: new Date(),
        createdAt: new Date(),
      },
    ]);

    await expect(
      service.listSessions(
        {
          sub: 'user-1',
          email: 'alice@example.com',
          slug: 'alice',
          iat: 1,
          exp: 2,
        },
        issued.refreshToken,
      ),
    ).resolves.toMatchObject([
      {
        id: 'session-1',
        isCurrent: true,
        browser: 'Chrome',
        os: 'Windows',
        deviceLabel: 'Chrome on Windows',
        ipRegion: 'Local network',
      },
    ]);
  });
});

describe('AuthService notification preferences', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuthService(prisma as any);
  });

  it('returns defaults merged with saved notification preferences', async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        channel: 'EMAIL',
        type: 'PRODUCT_UPDATES',
        enabled: true,
        timingMinutes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(
      service.getNotificationPreferences({
        sub: 'user-1',
        email: 'alice@example.com',
        slug: 'alice',
        iat: 1,
        exp: 2,
      }),
    ).resolves.toMatchObject({
      preferences: expect.arrayContaining([
        {
          channel: 'email',
          type: 'new_booking',
          enabled: true,
          timingMinutes: null,
        },
        {
          channel: 'email',
          type: 'product_updates',
          enabled: true,
          timingMinutes: null,
        },
      ]),
    });
  });

  it('upserts notification preferences through the authenticated settings endpoint', async () => {
    prisma.notificationPreference.upsert.mockResolvedValue({});

    await expect(
      service.updateNotificationPreferences(
        {
          sub: 'user-1',
          email: 'alice@example.com',
          slug: 'alice',
          iat: 1,
          exp: 2,
        },
        {
          preferences: [
            {
              channel: 'email',
              type: 'reminder_before',
              enabled: true,
              timingMinutes: 60,
            },
          ],
        },
      ),
    ).resolves.toMatchObject({
      preferences: expect.any(Array),
    });

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: {
        userId_channel_type: {
          userId: 'user-1',
          channel: 'EMAIL',
          type: 'REMINDER_BEFORE',
        },
      },
      create: {
        userId: 'user-1',
        channel: 'EMAIL',
        type: 'REMINDER_BEFORE',
        enabled: true,
        timingMinutes: 60,
      },
      update: {
        enabled: true,
        timingMinutes: 60,
      },
    });
  });
});

function hashTestEmailChangeToken(
  userId: string,
  newEmail: string,
  token: string,
) {
  return createHash('sha256')
    .update(`${userId}\0${newEmail}\0${token}`)
    .digest('base64url');
}

function hashTestOtpCode(code: string) {
  return createHash('sha256')
    .update(
      `${process.env.EMAIL_CODE_SECRET ?? process.env.JWT_PRIVATE_KEY ?? 'bookvella-dev'}:account-action:${code}`,
    )
    .digest('base64url');
}

function createTestPasswordHash(password: string) {
  const { pbkdf2Sync, randomBytes } = require('crypto');
  const salt = randomBytes(16).toString('base64url');
  const hash = pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString(
    'base64url',
  );
  return `pbkdf2_sha256$310000$${salt}$${hash}`;
}
