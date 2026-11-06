import { sql } from 'drizzle-orm';
import { check, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns.js';

export const USER_ROLES = ['customer', 'restaurant_staff', 'courier', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** One row per login. Firebase proves who someone is; the role here decides what they can do. */
export const users = pgTable(
  'users',
  {
    id: primaryId(),
    email: text().notNull(),
    // Empty until the first sign-in, so an admin can add an email and role ahead of time.
    firebaseUid: text(),
    role: text({ enum: USER_ROLES }).notNull().default('customer'),
    ...timestamps(),
  },
  (table) => [
    unique('users_email_unique').on(table.email),
    unique('users_firebase_uid_unique').on(table.firebaseUid),
    check(
      'users_role_check',
      sql`${table.role} in ('customer', 'restaurant_staff', 'courier', 'admin')`,
    ),
    check('users_email_lowercase_check', sql`${table.email} = lower(${table.email})`),
  ],
);

export const customers = pgTable(
  'customers',
  {
    id: primaryId(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    phone: text(),
    ...timestamps(),
  },
  (table) => [unique('customers_user_unique').on(table.userId)],
);
