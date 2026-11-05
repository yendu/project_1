import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/** Primary key shared by every table. UUIDv7 ids sort by creation time. */
export const primaryId = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);

/** `created_at` and `updated_at`, shared by every table. */
export const timestamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
