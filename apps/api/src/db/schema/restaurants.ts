import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  integer,
  pgTable,
  smallint,
  text,
  time,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns.js';

export const RESTAURANT_STATUSES = ['onboarding', 'active', 'paused'] as const;

export const restaurants = pgTable(
  'restaurants',
  {
    id: primaryId(),
    name: text().notNull(),
    cuisine: text().notNull(),
    status: text({ enum: RESTAURANT_STATUSES }).notNull().default('onboarding'),
    street: text().notNull(),
    postalCode: text().notNull(),
    city: text().notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    deliveryRadiusM: integer().notNull(),
    deliveryFeeCents: integer().notNull(),
    deliveryMinutesMin: integer().notNull(),
    deliveryMinutesMax: integer().notNull(),
    // Key of the stored file. Required once the restaurant leaves onboarding.
    photoKey: text(),
    ...timestamps(),
  },
  (table) => [
    check('restaurants_status_check', sql`${table.status} in ('onboarding', 'active', 'paused')`),
    check(
      'restaurants_photo_check',
      sql`${table.status} = 'onboarding' or ${table.photoKey} is not null`,
    ),
    check('restaurants_latitude_check', sql`${table.latitude} between -90 and 90`),
    check('restaurants_longitude_check', sql`${table.longitude} between -180 and 180`),
    check('restaurants_delivery_radius_check', sql`${table.deliveryRadiusM} > 0`),
    check('restaurants_delivery_fee_check', sql`${table.deliveryFeeCents} >= 0`),
    check(
      'restaurants_delivery_minutes_check',
      sql`${table.deliveryMinutesMin} >= 1 and ${table.deliveryMinutesMax} >= ${table.deliveryMinutesMin}`,
    ),
  ],
);

/** One row per time slot, in Berlin local time. Hours past midnight are split into two rows. */
export const openingHours = pgTable(
  'opening_hours',
  {
    id: primaryId(),
    restaurantId: uuid()
      .notNull()
      .references(() => restaurants.id),
    // ISO weekday: 1 is Monday, 7 is Sunday.
    weekday: smallint().notNull(),
    opensAt: time().notNull(),
    closesAt: time().notNull(),
    ...timestamps(),
  },
  (table) => [
    // Also serves as the index for looking up a restaurant's hours.
    unique('opening_hours_slot_unique').on(table.restaurantId, table.weekday, table.opensAt),
    check('opening_hours_weekday_check', sql`${table.weekday} between 1 and 7`),
    check('opening_hours_times_check', sql`${table.opensAt} < ${table.closesAt}`),
  ],
);
