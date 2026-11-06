import type { NestExpressApplication } from '@nestjs/platform-express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { VerifiedToken } from '../src/modules/auth/token-verifier.js';
import { googleAccount, tokenFor } from './support/fake-token-verifier.js';
import { createTestApp } from './support/test-app.js';

describe('accounts', () => {
  const adminAccount = googleAccount();
  let app: NestExpressApplication;
  let client: Client;

  beforeAll(async () => {
    app = await createTestApp({ env: { ADMIN_EMAIL: adminAccount.email ?? '' } });
    client = new Client({ connectionString: inject('databaseUrl') });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
    await app.close();
  });

  const me = (account: VerifiedToken): request.Test =>
    request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${tokenFor(account)}`);

  async function userRows(email: string | undefined): Promise<
    {
      id: string;
      role: string;
      firebase_uid: string | null;
    }[]
  > {
    const { rows } = await client.query<{ id: string; role: string; firebase_uid: string | null }>(
      'select id, role, firebase_uid from users where email = $1',
      [email?.toLowerCase()],
    );
    return rows;
  }

  async function customerCount(userId: string | undefined): Promise<number> {
    const { rows } = await client.query<{ count: string }>(
      'select count(*) from customers where user_id = $1',
      [userId],
    );
    return Number(rows[0]?.count);
  }

  async function addUser(email: string | undefined, role: string): Promise<void> {
    await client.query('insert into users (email, role) values ($1, $2)', [email, role]);
  }

  describe('first sign-in', () => {
    it('creates a customer and returns the profile', async () => {
      const account = googleAccount({ name: 'Grace Hopper' });
      const response = await me(account);
      const [user] = await userRows(account.email);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: user?.id,
        email: account.email,
        role: 'customer',
        name: 'Grace Hopper',
      });
      expect(user).toMatchObject({ role: 'customer', firebase_uid: account.uid });
      expect(await customerCount(user?.id)).toBe(1);
    });

    it('falls back to the start of the email when Google sends no name', async () => {
      const account = googleAccount({ name: undefined });

      const response = await me(account);

      expect(response.body).toMatchObject({ name: account.email?.split('@')[0] });
    });

    it('stores the email in lowercase', async () => {
      const base = googleAccount();
      const account = { ...base, email: base.email?.toUpperCase() };

      const response = await me(account);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: base.email });
    });

    it('creates one user when the same first sign-in arrives five times at once', async () => {
      const account = googleAccount();

      const responses = await Promise.all(Array.from({ length: 5 }, () => me(account)));
      const users = await userRows(account.email);

      expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200]);
      expect(users).toHaveLength(1);
      expect(await customerCount(users[0]?.id)).toBe(1);
    });

    it('makes ADMIN_EMAIL an admin, without a customer row', async () => {
      const response = await me(adminAccount);
      const [user] = await userRows(adminAccount.email);

      expect(response.body).toMatchObject({ role: 'admin', name: null });
      expect(await customerCount(user?.id)).toBe(0);
    });
  });

  describe('later sign-ins', () => {
    it('finds the same user and adds nothing', async () => {
      const account = googleAccount();

      const first = await me(account);
      const second = await me(account);
      const users = await userRows(account.email);

      expect(second.body).toEqual(first.body);
      expect(users).toHaveLength(1);
      expect(await customerCount(users[0]?.id)).toBe(1);
    });
  });

  describe('an email an admin added first', () => {
    it('links on first sign-in and keeps the role', async () => {
      const account = googleAccount();
      await addUser(account.email, 'courier');

      const response = await me(account);
      const users = await userRows(account.email);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ role: 'courier', name: null });
      expect(users).toHaveLength(1);
      expect(users[0]?.firebase_uid).toBe(account.uid);
      expect(await customerCount(users[0]?.id)).toBe(0);
    });

    it('refuses a second Google account with the same email', async () => {
      const account = googleAccount();
      await me(account);

      const response = await me({ ...googleAccount(), email: account.email });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ code: 'email_in_use' });
    });
  });

  it('never returns the Firebase id', async () => {
    const account = googleAccount();
    const response = await me(account);

    expect(response.text).not.toContain(account.uid);
  });

  it('needs sign-in', async () => {
    expect((await request(app.getHttpServer()).get('/v1/me')).status).toBe(401);
  });
});
