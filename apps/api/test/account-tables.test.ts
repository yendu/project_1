import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const UNKNOWN_ID = '019a0000-0000-7000-8000-000000000000';

describe('account tables', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: inject('databaseUrl') });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  // Each test runs in a transaction that is rolled back, so no rows outlive it.
  beforeEach(async () => {
    await client.query('begin');
  });

  afterEach(async () => {
    await client.query('rollback');
  });

  async function insert(table: string, row: Record<string, unknown>): Promise<string> {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const { rows } = await client.query<{ id: string }>(
      `insert into ${table} (${columns.join(', ')}) values (${placeholders.join(', ')}) returning id`,
      Object.values(row),
    );
    return rows[0]?.id ?? '';
  }

  const user = (overrides: Record<string, unknown> = {}): Promise<string> =>
    insert('users', { email: 'ada@example.com', ...overrides });

  describe('users', () => {
    it('gets a UUIDv7 key and is a customer by default', async () => {
      const id = await user();
      const { rows } = await client.query<{ role: string }>(
        'select role from users where id = $1',
        [id],
      );

      expect(id).toMatch(UUID_V7);
      expect(rows[0]?.role).toBe('customer');
    });

    it.each(['customer', 'restaurant_staff', 'courier', 'admin'])('allows %s', async (role) => {
      await expect(user({ role })).resolves.toMatch(UUID_V7);
    });

    it('rejects an unknown role', async () => {
      await expect(user({ role: 'manager' })).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint: 'users_role_check',
      });
    });

    it('rejects an email that is not lowercase', async () => {
      await expect(user({ email: 'Ada@example.com' })).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint: 'users_email_lowercase_check',
      });
    });

    it('rejects the same email twice', async () => {
      await user();
      await expect(user()).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: 'users_email_unique',
      });
    });

    it('rejects the same Firebase account twice', async () => {
      await user({ email: 'ada@example.com', firebase_uid: 'uid-1' });
      await expect(
        user({ email: 'grace@example.com', firebase_uid: 'uid-1' }),
      ).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: 'users_firebase_uid_unique',
      });
    });

    it('allows several added emails that have not signed in yet', async () => {
      await user({ email: 'ada@example.com', role: 'courier' });
      await expect(user({ email: 'grace@example.com', role: 'courier' })).resolves.toMatch(UUID_V7);
    });
  });

  describe('customers', () => {
    it('allows a customer without a phone number', async () => {
      await expect(insert('customers', { user_id: await user(), name: 'Ada' })).resolves.toMatch(
        UUID_V7,
      );
    });

    it('rejects a second customer for one user', async () => {
      const userId = await user();

      await insert('customers', { user_id: userId, name: 'Ada' });
      await expect(insert('customers', { user_id: userId, name: 'Ada' })).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: 'customers_user_unique',
      });
    });

    it('rejects an unknown user', async () => {
      await expect(insert('customers', { user_id: UNKNOWN_ID, name: 'Ada' })).rejects.toMatchObject(
        { code: FOREIGN_KEY_VIOLATION },
      );
    });
  });
});
