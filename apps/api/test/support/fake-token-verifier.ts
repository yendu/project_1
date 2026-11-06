import { randomUUID } from 'node:crypto';
import {
  InvalidTokenError,
  type TokenVerifier,
  type VerifiedToken,
} from '../../src/modules/auth/token-verifier.js';

const PREFIX = 'fake-token.';

/** A unique Google account, so tests sharing the database never meet each other's rows. */
export function googleAccount(overrides: Partial<VerifiedToken> = {}): VerifiedToken {
  const id = randomUUID();
  return {
    uid: `uid-${id}`,
    email: `${id}@example.com`,
    emailVerified: true,
    name: 'Ada Lovelace',
    provider: 'google.com',
    ...overrides,
  };
}

/** A token that `FakeTokenVerifier` accepts as this account. */
export function tokenFor(account: VerifiedToken): string {
  return PREFIX + Buffer.from(JSON.stringify(account)).toString('base64url');
}

/** Stands in for Firebase in tests, so they need no network and no real Google account. */
export class FakeTokenVerifier implements TokenVerifier {
  verify(token: string): Promise<VerifiedToken> {
    if (!token.startsWith(PREFIX)) return Promise.reject(new InvalidTokenError());
    const payload = Buffer.from(token.slice(PREFIX.length), 'base64url').toString();
    return Promise.resolve(JSON.parse(payload) as VerifiedToken);
  }
}
