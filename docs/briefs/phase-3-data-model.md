# Phase 3: Data model and first tables

## Status

Done on 2026-11-05. The data model below is approved, and the first group of tables is built and
applied locally. Differences from the plan:

- `src/db/schema/columns.ts` holds the id and timestamp columns that every table shares.
- `menu_categories` has an extra unique `(id, restaurant_id)`, which the foreign key from
  `menu_items` needs to keep an item inside its own restaurant's categories.

## Goal

Agree the whole data model once, then build it one group of tables at a time. This phase adds the
first group: restaurants and their menus. No endpoints yet.

## Data model

16 tables in 7 groups. Every table follows the database conventions in CLAUDE.md, so ids and
timestamps aren't repeated below.

| Group       | Table              | Main columns                                                                                                                                                        |
| ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login       | `users`            | email, firebase_uid, role                                                                                                                                           |
| Customers   | `customers`        | user_id, name, phone                                                                                                                                                |
|             | `addresses`        | customer_id, street, postal_code, city, latitude, longitude                                                                                                         |
| Restaurants | `restaurants`      | name, cuisine, status, street, postal_code, city, latitude, longitude, delivery_radius_m, delivery_fee_cents, delivery_minutes_min, delivery_minutes_max, photo_key |
|             | `restaurant_staff` | user_id, restaurant_id, name                                                                                                                                        |
|             | `opening_hours`    | restaurant_id, weekday, opens_at, closes_at                                                                                                                         |
| Menu        | `menu_categories`  | restaurant_id, name, position                                                                                                                                       |
|             | `menu_items`       | restaurant_id, category_id, name, description, price_cents, photo_key, is_available, daily_stock, stock_remaining, stock_date, archived_at                          |
| Orders      | `orders`           | customer_id, restaurant_id, status, status_changed_at, copied address, items_total_cents, delivery_fee_cents, discount_cents, total_cents, idempotency_key          |
|             | `order_items`      | order_id, menu_item_id, name, unit_price_cents, quantity                                                                                                            |
|             | `order_events`     | order_id, from_status, to_status, actor_type, actor_user_id, reason                                                                                                 |
| Payments    | `payments`         | order_id, stripe_payment_intent_id, status, amount_cents                                                                                                            |
|             | `refunds`          | payment_id, stripe_refund_id, amount_cents, reason, admin_user_id                                                                                                   |
|             | `stripe_events`    | id (Stripe's event id), type, processed_at                                                                                                                          |
| Deliveries  | `couriers`         | user_id, name, phone, is_online                                                                                                                                     |
|             | `deliveries`       | order_id, courier_id, status, accepted_at, picked_up_at, delivered_at                                                                                               |

## Decisions

- **Card confirmation.** European cards often need a confirmation step in the browser, and Stripe
  is never called inside a transaction. So an order starts as `payment_pending`, which reserves
  stock and stays hidden from customers and staff. It becomes `placed` when the card hold
  succeeds, or `expired` after 15 minutes.
- **Logins.** One `users` table for every kind of account, with one role per account. Sign-in is
  Google only, through Firebase Auth, so no passwords are stored. See the Phase 4 brief.
- **Location.** Plain latitude and longitude columns, without PostGIS, for one city. Turning an
  address into coordinates needs an outside service, chosen when addresses are built.
- **Cart.** It lives in the browser, so there's no table. The server recalculates prices.
- **Daily stock.** Three columns on `menu_items`, with no nightly job. `daily_stock` is the limit,
  and `stock_remaining` counts down for the day in `stock_date`. If `stock_date` isn't today, the
  first order of the day starts again from `daily_stock`. Days follow Europe/Berlin.
- **Opening hours.** Stored as Berlin local time. Hours past midnight are split into two rows:
  18:00–24:00 and 00:00–02:00 on the next weekday.
- **Photos.** Tables store a file key only. Where the files live is decided with the upload work.

## How rules are enforced

- Stock and courier offers: one atomic `UPDATE ... WHERE ... RETURNING`, so only one caller wins.
- Status changes: the update names the expected status. No changed row means a 409.
- Double orders: a unique `(customer_id, idempotency_key)` on `orders`.
- Order totals: a CHECK that total = items + delivery fee − discounts.
- Webhooks: `stripe_events` has Stripe's event id as its key, so each event counts once.
- Indexes: only for queries we know we run, plus what primary keys and unique constraints add.

## Build order

1. Restaurants and menu: this phase.
2. Users and customers, together with login (Phase 4). Addresses and `restaurant_staff` follow with their features.
3. Orders and stock.
4. Payments.
5. Couriers and deliveries.

## Scope

1. Tables `restaurants`, `opening_hours`, `menu_categories` and `menu_items`, in
   `src/db/schema/restaurants.ts` and `src/db/schema/menu.ts`.
2. One generated migration.
3. Tests against real PostgreSQL for every constraint.

## Out of scope

Endpoints, seed data, photo upload, item options such as sizes and extras, and per-test-file
database isolation. These tests roll back their own rows, so isolation can wait until API tests
write rows.

## Acceptance

- `pnpm check` passes. A test proves each CHECK, unique and foreign key rule.
- A menu item can't sit in another restaurant's category.
- An active restaurant must have a photo.
- The migration SQL is shown before it is applied.

## Checkpoints

1. After the migration is generated: show the SQL, wait before applying it locally.
2. Done: full report per CLAUDE.md.
