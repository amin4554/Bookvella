const { existsSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const { generateKeyPairSync } = require('crypto');

const envPath = resolve(__dirname, '..', '.env');
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const existing = existsSync(envPath)
  ? readFileSync(envPath, 'utf8').split(/\r?\n/)
  : [];

const filtered = existing.filter(
  (line) => !/^JWT_(KEY_ID|PRIVATE_KEY|PUBLIC_KEY)=/.test(line),
);

const next = [
  ...filtered.filter((line) => line.length > 0),
  'JWT_KEY_ID="bookvella-local-1"',
  `JWT_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"`,
  `JWT_PUBLIC_KEY="${publicKey.replace(/\n/g, '\\n')}"`,
  '',
].join('\n');

writeFileSync(envPath, next);
console.log('JWT keys written to .env');
