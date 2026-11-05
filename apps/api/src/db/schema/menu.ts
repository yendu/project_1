import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns.js';
import { restaurants } from './restaurants.js';

export const menuCategories = pgTable(
  'menu_categories',
  {
    id: primaryId(),
    restaurantId: uuid()
      .notNull()
      .references(() => restaurants.id),
    name: text().notNull(),
    position: integer().notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    // Also serves as the index for looking up a restaurant's categories.
    unique('menu_categories_name_unique').on(table.restaurantId, table.name),
    // Target of the foreign key that keeps an item inside its own restaurant's categories.
    unique('menu_categories_id_restaurant_unique').on(table.id, table.restaurantId),
    check('menu_categories_position_check', sql`${table.position} >= 0`),
  ],
);

export const menuItems = pgTable(
  'menu_items',
  {
    id: primaryId(),
    restaurantId: uuid()
      .notNull()
      .references(() => restaurants.id),
    categoryId: uuid().notNull(),
    name: text().notNull(),
    description: text(),
    priceCents: integer().notNull(),
    photoKey: text(),
    isAvailable: boolean().notNull().default(true),
    // Daily limit. Empty means unlimited.
    dailyStock: integer(),
    // Count left on stockDate. If stockDate isn't today, the day starts again from dailyStock.
    stockRemaining: integer(),
    stockDate: date(),
    // Old orders point at their items, so items are archived and never deleted.
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    foreignKey({
      name: 'menu_items_category_fk',
      columns: [table.categoryId, table.restaurantId],
      foreignColumns: [menuCategories.id, menuCategories.restaurantId],
    }),
    index('menu_items_restaurant_idx').on(table.restaurantId),
    index('menu_items_category_idx').on(table.categoryId),
    check('menu_items_price_check', sql`${table.priceCents} >= 0`),
    check('menu_items_daily_stock_check', sql`${table.dailyStock} > 0`),
    check('menu_items_stock_remaining_check', sql`${table.stockRemaining} >= 0`),
    check(
      'menu_items_stock_day_check',
      sql`(${table.stockRemaining} is null) = (${table.stockDate} is null)`,
    ),
    check(
      'menu_items_stock_limit_check',
      sql`${table.dailyStock} is not null or ${table.stockRemaining} is null`,
    ),
    check('menu_items_stock_ceiling_check', sql`${table.stockRemaining} <= ${table.dailyStock}`),
  ],
);
