import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const RESTAURANT = {
  name: 'Pizzeria Lindenhof',
  cuisine: 'Pizza',
  street: 'Musterstraße 1',
  postal_code: '10999',
  city: 'Berlin',
  latitude: 52.5,
  longitude: 13.4,
  delivery_radius_m: 3000,
  delivery_fee_cents: 250,
  delivery_minutes_min: 25,
  delivery_minutes_max: 35,
};

describe('restaurant and menu tables', () => {
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

  const restaurant = (overrides: Record<string, unknown> = {}): Promise<string> =>
    insert('restaurants', { ...RESTAURANT, ...overrides });

  async function category(restaurantId: string, name = 'Pizza'): Promise<string> {
    return insert('menu_categories', { restaurant_id: restaurantId, name });
  }

  async function hours(overrides: Record<string, unknown> = {}): Promise<string> {
    return insert('opening_hours', {
      restaurant_id: await restaurant(),
      weekday: 1,
      opens_at: '11:00',
      closes_at: '14:00',
      ...overrides,
    });
  }

  async function item(overrides: Record<string, unknown> = {}): Promise<string> {
    const restaurantId = await restaurant();
    const categoryId = await category(restaurantId);
    return insert('menu_items', {
      restaurant_id: restaurantId,
      category_id: categoryId,
      name: 'Margherita',
      price_cents: 950,
      ...overrides,
    });
  }

  describe('restaurants', () => {
    it('gets a UUIDv7 key and starts in onboarding', async () => {
      const id = await restaurant();
      const { rows } = await client.query<{ status: string }>(
        'select status from restaurants where id = $1',
        [id],
      );

      expect(id).toMatch(UUID_V7);
      expect(rows[0]?.status).toBe('onboarding');
    });

    it('rejects an unknown status', async () => {
      await expect(restaurant({ status: 'closed', photo_key: 'a.jpg' })).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint: 'restaurants_status_check',
      });
    });

    it('allows no photo during onboarding, but requires one once active', async () => {
      await expect(restaurant({ status: 'onboarding' })).resolves.toMatch(UUID_V7);
      await expect(restaurant({ status: 'active', photo_key: 'a.jpg' })).resolves.toMatch(UUID_V7);
    });

    it('rejects an active restaurant without a photo', async () => {
      await expect(restaurant({ status: 'active' })).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint: 'restaurants_photo_check',
      });
    });

    it.each([
      ['a latitude outside -90 to 90', { latitude: 91 }, 'restaurants_latitude_check'],
      ['a longitude outside -180 to 180', { longitude: 181 }, 'restaurants_longitude_check'],
      ['a zero delivery radius', { delivery_radius_m: 0 }, 'restaurants_delivery_radius_check'],
      ['a negative delivery fee', { delivery_fee_cents: -1 }, 'restaurants_delivery_fee_check'],
      [
        'a delivery time below one minute',
        { delivery_minutes_min: 0 },
        'restaurants_delivery_minutes_check',
      ],
      [
        'a delivery time range that runs backwards',
        { delivery_minutes_min: 40, delivery_minutes_max: 30 },
        'restaurants_delivery_minutes_check',
      ],
    ])('rejects %s', async (_, overrides, constraint) => {
      await expect(restaurant(overrides)).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint,
      });
    });
  });

  describe('opening_hours', () => {
    it('allows two slots on one day', async () => {
      const restaurantId = await restaurant();
      const slot = { restaurant_id: restaurantId, weekday: 1 };

      await insert('opening_hours', { ...slot, opens_at: '11:00', closes_at: '14:00' });
      await expect(
        insert('opening_hours', { ...slot, opens_at: '17:00', closes_at: '22:00' }),
      ).resolves.toMatch(UUID_V7);
    });

    it('allows closing at midnight, written as 24:00', async () => {
      await expect(hours({ opens_at: '18:00', closes_at: '24:00' })).resolves.toMatch(UUID_V7);
    });

    it('rejects the same slot twice', async () => {
      const slot = {
        restaurant_id: await restaurant(),
        weekday: 1,
        opens_at: '11:00',
        closes_at: '14:00',
      };

      await insert('opening_hours', slot);
      await expect(insert('opening_hours', slot)).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: 'opening_hours_slot_unique',
      });
    });

    it.each([
      ['a weekday below 1', { weekday: 0 }, 'opening_hours_weekday_check'],
      ['a weekday above 7', { weekday: 8 }, 'opening_hours_weekday_check'],
      ['closing before opening', { closes_at: '10:00' }, 'opening_hours_times_check'],
      ['closing as it opens', { closes_at: '11:00' }, 'opening_hours_times_check'],
    ])('rejects %s', async (_, overrides, constraint) => {
      await expect(hours(overrides)).rejects.toMatchObject({ code: CHECK_VIOLATION, constraint });
    });

    it('rejects an unknown restaurant', async () => {
      await expect(
        hours({ restaurant_id: '019a0000-0000-7000-8000-000000000000' }),
      ).rejects.toMatchObject({ code: FOREIGN_KEY_VIOLATION });
    });
  });

  describe('menu_categories', () => {
    it('rejects a duplicate name in one restaurant', async () => {
      const restaurantId = await restaurant();

      await category(restaurantId);
      await expect(category(restaurantId)).rejects.toMatchObject({
        code: UNIQUE_VIOLATION,
        constraint: 'menu_categories_name_unique',
      });
    });

    it('allows the same name in two restaurants', async () => {
      await category(await restaurant());
      await expect(category(await restaurant())).resolves.toMatch(UUID_V7);
    });

    it('rejects a negative position', async () => {
      await expect(
        insert('menu_categories', {
          restaurant_id: await restaurant(),
          name: 'Pizza',
          position: -1,
        }),
      ).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint: 'menu_categories_position_check',
      });
    });
  });

  describe('menu_items', () => {
    it('is available and unlimited by default', async () => {
      const id = await item();
      const { rows } = await client.query<{ is_available: boolean; daily_stock: number | null }>(
        'select is_available, daily_stock from menu_items where id = $1',
        [id],
      );

      expect(rows[0]).toEqual({ is_available: true, daily_stock: null });
    });

    it('rejects a category from another restaurant', async () => {
      const otherCategory = await category(await restaurant());

      await expect(item({ category_id: otherCategory })).rejects.toMatchObject({
        code: FOREIGN_KEY_VIOLATION,
        constraint: 'menu_items_category_fk',
      });
    });

    it('allows a limit before the first order of the day', async () => {
      await expect(item({ daily_stock: 5 })).resolves.toMatch(UUID_V7);
    });

    it('allows stock to reach 0, but never below', async () => {
      const today = { daily_stock: 5, stock_date: '2026-11-05' };

      await expect(item({ ...today, stock_remaining: 0 })).resolves.toMatch(UUID_V7);
      await expect(item({ ...today, stock_remaining: -1 })).rejects.toMatchObject({
        code: CHECK_VIOLATION,
        constraint: 'menu_items_stock_remaining_check',
      });
    });

    it.each([
      ['a negative price', { price_cents: -1 }, 'menu_items_price_check'],
      ['a daily limit of 0', { daily_stock: 0 }, 'menu_items_daily_stock_check'],
      [
        'a stock count without a day',
        { daily_stock: 5, stock_remaining: 3 },
        'menu_items_stock_day_check',
      ],
      [
        'a day without a stock count',
        { daily_stock: 5, stock_date: '2026-11-05' },
        'menu_items_stock_day_check',
      ],
      [
        'a stock count without a limit',
        { stock_remaining: 3, stock_date: '2026-11-05' },
        'menu_items_stock_limit_check',
      ],
      [
        'a stock count above the daily limit',
        { daily_stock: 5, stock_remaining: 6, stock_date: '2026-11-05' },
        'menu_items_stock_ceiling_check',
      ],
    ])('rejects %s', async (_, overrides, constraint) => {
      await expect(item(overrides)).rejects.toMatchObject({ code: CHECK_VIOLATION, constraint });
    });
  });
});
