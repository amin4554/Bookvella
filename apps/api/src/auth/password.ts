import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

export const PASSWORD_HASH_ALGORITHM = 'pbkdf2_sha256';
export const PASSWORD_HASH_ITERATIONS = 600000;
const PASSWORD_HASH_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;

export function hashPassword(password: string) {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString('base64url');
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_BYTES,
    'sha256',
  ).toString('base64url');

  return `${PASSWORD_HASH_ALGORITHM}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(
  password: string,
  storedHash: string,
): { valid: boolean; needsRehash: boolean } {
  const [algorithm, iterationsText, salt, hash] = storedHash.split('$');
  const iterations = Number(iterationsText);

  if (
    algorithm !== PASSWORD_HASH_ALGORITHM ||
    !Number.isSafeInteger(iterations) ||
    iterations <= 0 ||
    !salt ||
    !hash
  ) {
    return { valid: false, needsRehash: false };
  }

  const candidate = pbkdf2Sync(
    password,
    salt,
    iterations,
    PASSWORD_HASH_BYTES,
    'sha256',
  );
  const stored = Buffer.from(hash, 'base64url');
  const valid =
    candidate.length === stored.length && timingSafeEqual(candidate, stored);

  return {
    valid,
    needsRehash: valid && iterations < PASSWORD_HASH_ITERATIONS,
  };
}
