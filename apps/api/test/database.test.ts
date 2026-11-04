import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('test database', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: inject('databaseUrl') });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('runs PostgreSQL 18', async () => {
    const { rows } = await client.query<{ server_version_num: string }>('show server_version_num');
    expect(Number(rows[0]?.server_version_num)).toBeGreaterThanOrEqual(180_000);
  });

  it('generates UUIDv7 keys with uuidv7()', async () => {
    const { rows } = await client.query<{ id: string }>('select uuidv7() as id');
    expect(rows[0]?.id).toMatch(UUID_V7);
  });
});
