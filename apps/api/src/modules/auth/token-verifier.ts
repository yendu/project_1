export const TOKEN_VERIFIER = Symbol('TOKEN_VERIFIER');

/** Who a sign-in token proves the caller to be. */
export interface VerifiedToken {
  uid: string;
  email: string | undefined;
  emailVerified: boolean;
  name: string | undefined;
  /** How they signed in, for example `google.com`. */
  provider: string;
}

export interface TokenVerifier {
  /**
   * Checks the token's signature, expiry and project. Rejects with `InvalidTokenError` when the
   * token isn't valid, or `TokenCheckUnavailableError` when it can't be checked right now.
   */
  verify(token: string): Promise<VerifiedToken>;
}

/** The token is wrong or expired. The caller gets a 401. */
export class InvalidTokenError extends Error {}

/** The token couldn't be checked, so this isn't the caller's fault. The caller gets a 503. */
export class TokenCheckUnavailableError extends Error {}
