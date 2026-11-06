import type { DecodedIdToken } from 'firebase-admin/auth';
import { describe, expect, it } from 'vitest';
import { createFirebaseAuth, FirebaseTokenVerifier } from './firebase-token-verifier.js';
import { InvalidTokenError, TokenCheckUnavailableError } from './token-verifier.js';

const TOKEN = 'secret-token-value';

const failingWith = (failure: unknown) => ({ verifyIdToken: () => Promise.reject(failure) });

describe('FirebaseTokenVerifier', () => {
  it('maps a verified token', async () => {
    const decoded = {
      uid: 'uid-1',
      email: 'ada@example.com',
      email_verified: true,
      name: 'Ada',
      firebase: { sign_in_provider: 'google.com', identities: {} },
    } as unknown as DecodedIdToken;
    const verifier = new FirebaseTokenVerifier({ verifyIdToken: () => Promise.resolve(decoded) });

    await expect(verifier.verify(TOKEN)).resolves.toEqual({
      uid: 'uid-1',
      email: 'ada@example.com',
      emailVerified: true,
      name: 'Ada',
      provider: 'google.com',
    });
  });

  it('treats a missing email_verified claim as not verified', async () => {
    const decoded = {
      uid: 'uid-1',
      firebase: { sign_in_provider: 'google.com', identities: {} },
    } as unknown as DecodedIdToken;
    const verifier = new FirebaseTokenVerifier({ verifyIdToken: () => Promise.resolve(decoded) });

    await expect(verifier.verify(TOKEN)).resolves.toMatchObject({ emailVerified: false });
  });

  it('rejects a garbage token through the real Firebase code, without any network', async () => {
    const verifier = new FirebaseTokenVerifier(createFirebaseAuth('demo-food-delivery'));

    await expect(verifier.verify('garbage')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects an expired token', async () => {
    const verifier = new FirebaseTokenVerifier(failingWith({ code: 'auth/id-token-expired' }));

    await expect(verifier.verify(TOKEN)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('reports a failed key fetch as unavailable, although Firebase calls it a bad argument', async () => {
    const error = {
      code: 'auth/argument-error',
      message: 'Error fetching public keys for Google certs: boom',
    };
    const verifier = new FirebaseTokenVerifier(failingWith(error));

    await expect(verifier.verify(TOKEN)).rejects.toBeInstanceOf(TokenCheckUnavailableError);
  });

  it('gives up when Firebase takes too long', async () => {
    const verifier = new FirebaseTokenVerifier(
      { verifyIdToken: () => new Promise<DecodedIdToken>(() => {}) },
      10,
    );

    await expect(verifier.verify(TOKEN)).rejects.toBeInstanceOf(TokenCheckUnavailableError);
  });

  it('reports anything unexpected as unavailable', async () => {
    const verifier = new FirebaseTokenVerifier(failingWith(new Error('boom')));

    await expect(verifier.verify(TOKEN)).rejects.toBeInstanceOf(TokenCheckUnavailableError);
  });

  it('never repeats Firebase error text, which could quote the token', async () => {
    const verifier = new FirebaseTokenVerifier(
      failingWith({ code: 'auth/argument-error', message: `bad token ${TOKEN}` }),
    );

    const error = await verifier.verify(TOKEN).catch((caught: unknown) => caught);

    expect(String(error)).not.toContain(TOKEN);
    expect((error as Error).cause).toBeUndefined();
  });
});
