import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TokenCheckUnavailableError,
  type TokenVerifier,
} from '../src/modules/auth/token-verifier.js';
import { googleAccount, tokenFor } from './support/fake-token-verifier.js';
import { LogCapture } from './support/log-capture.js';
import { createTestApp } from './support/test-app.js';

const WHOAMI = '/v1/probe/protected/whoami';
const ADMIN_ONLY = '/v1/probe/protected/admin-only';

describe('sign-in guard', () => {
  const logs = new LogCapture();
  const adminAccount = googleAccount();
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({
      env: { LOG_LEVEL: 'info', ADMIN_EMAIL: adminAccount.email ?? '' },
      logDestination: logs,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string, token?: string): request.Test => {
    const test = request(app.getHttpServer()).get(path);
    return token === undefined ? test : test.set('Authorization', `Bearer ${token}`);
  };

  describe('without a valid token', () => {
    it('answers 401 on a route with no decorator', async () => {
      const response = await get(WHOAMI);

      expect(response.status).toBe(401);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.body).toMatchObject({ code: 'unauthenticated', status: 401 });
    });

    it('answers 401 for a token that does not verify', async () => {
      expect((await get(WHOAMI, 'not-a-real-token')).status).toBe(401);
    });

    it.each(['Basic abc', 'Bearer', 'Bearer ', 'abc'])(
      'answers 401 for the header %j',
      async (header) => {
        const response = await request(app.getHttpServer())
          .get(WHOAMI)
          .set('Authorization', header);
        expect(response.status).toBe(401);
      },
    );

    it('answers 401 for an unverified email', async () => {
      const token = tokenFor(googleAccount({ emailVerified: false }));
      expect((await get(WHOAMI, token)).status).toBe(401);
    });

    it('answers 401 for a token without an email', async () => {
      const token = tokenFor(googleAccount({ email: undefined }));
      expect((await get(WHOAMI, token)).status).toBe(401);
    });

    it('answers 401 for a sign-in that did not use Google', async () => {
      const token = tokenFor(googleAccount({ provider: 'password' }));
      expect((await get(WHOAMI, token)).status).toBe(401);
    });
  });

  describe('public routes', () => {
    it.each(['/healthz', '/readyz', '/v1/probe/ok', '/v1/probe/protected/opened'])(
      'keeps %s open without a token',
      async (path) => {
        expect((await get(path)).status).toBe(200);
      },
    );
  });

  describe('with a valid token', () => {
    it('passes the caller to the route', async () => {
      const account = googleAccount();
      const response = await get(WHOAMI, tokenFor(account));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: account.email, role: 'customer' });
    });

    it('answers 403 when the role is not allowed', async () => {
      const response = await get(ADMIN_ONLY, tokenFor(googleAccount()));

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'forbidden' });
    });

    it('lets an allowed role through', async () => {
      expect((await get(ADMIN_ONLY, tokenFor(adminAccount))).status).toBe(200);
    });
  });

  it('never logs a token', async () => {
    const valid = tokenFor(googleAccount());
    const invalid = 'invalid-token-that-must-stay-secret';

    await get(WHOAMI, valid);
    await get(WHOAMI, invalid);

    expect(logs.text).toContain('/v1/probe/protected/whoami');
    expect(logs.text).not.toContain(valid);
    expect(logs.text).not.toContain(invalid);
  });
});

describe('sign-in guard when tokens cannot be checked', () => {
  const unavailable: TokenVerifier = {
    verify: () => Promise.reject(new TokenCheckUnavailableError('Token check timed out')),
  };
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ tokenVerifier: unavailable });
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 503, because the token may be fine', async () => {
    const response = await request(app.getHttpServer())
      .get(WHOAMI)
      .set('Authorization', 'Bearer any-token');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'service_unavailable' });
  });
});
