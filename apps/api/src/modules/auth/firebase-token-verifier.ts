import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { withTimeout } from '../../common/with-timeout.js';
import {
  InvalidTokenError,
  TokenCheckUnavailableError,
  type TokenVerifier,
  type VerifiedToken,
} from './token-verifier.js';

// firebase-admin sets no timeout on the request that fetches Google's public keys.
const VERIFY_TIMEOUT_MS = 5_000;

const INVALID_TOKEN_CODES = new Set(['auth/argument-error', 'auth/id-token-expired']);

type IdTokenChecker = Pick<Auth, 'verifyIdToken'>;

/** Checking tokens needs only the project ID, so no service account key is involved. */
export function createFirebaseAuth(projectId: string): IdTokenChecker {
  // A unique name, because Firebase refuses a second app with the same one.
  return getAuth(initializeApp({ projectId }, `food-delivery-api-${randomUUID()}`));
}

export class FirebaseTokenVerifier implements TokenVerifier {
  constructor(
    private readonly auth: IdTokenChecker,
    private readonly timeoutMs = VERIFY_TIMEOUT_MS,
  ) {}

  async verify(token: string): Promise<VerifiedToken> {
    const decoded = await this.check(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
      provider: decoded.firebase.sign_in_provider,
    };
  }

  private async check(token: string): Promise<DecodedIdToken> {
    try {
      return await withTimeout(this.auth.verifyIdToken(token), this.timeoutMs);
    } catch (error) {
      // Firebase's text can quote the token, so none of it is passed on.
      throw toTokenError(error);
    }
  }
}

function toTokenError(error: unknown): Error {
  const { code, message, name } = error as { code?: unknown; message?: unknown; name?: unknown };

  if (name === 'TimeoutError') return new TokenCheckUnavailableError('Token check timed out');
  // Firebase reports a failed key fetch with the same code as a bad token.
  if (typeof message === 'string' && message.includes('fetching public keys')) {
    return new TokenCheckUnavailableError('Could not fetch the signing keys');
  }
  if (typeof code === 'string' && INVALID_TOKEN_CODES.has(code)) return new InvalidTokenError();
  return new TokenCheckUnavailableError('Token check failed');
}
