# Domain: food ordering and delivery

A marketplace in one city (Berlin to start). Customers order from restaurants;
couriers deliver. Prices in EUR, stored as integer cents. Times stored in UTC.

## Actors

- Customer: browses restaurants, orders, pays, tracks delivery (Flutter app)
- Restaurant staff: manage menu and opening hours, accept and prepare orders (Next.js dashboard)
- Courier: accepts deliveries, picks up, delivers (Flutter app)
- Admin: support, refunds, restaurant onboarding

## Core entities

customers, addresses, restaurants, restaurant_staff, opening_hours, menu_categories,
menu_items, orders, order_items, payments, couriers, deliveries

## Business rules

- An order belongs to exactly one restaurant.
- order_items store the unit price at order time. Menu price changes never change old orders.
- A menu item can be marked unavailable or have limited daily stock. Stock must never go below 0,
  even when two customers order the last one at the same moment.
- Orders are only accepted while the restaurant is open and within its delivery radius.
- Order total = items + delivery fee − discounts. Computed on the server, never trusted from the client.
- Staff only see their own restaurant's orders. Customers only see their own orders.

## Order lifecycle

placed → accepted → preparing → ready_for_pickup → picked_up → delivered

- From placed: rejected (by restaurant) or cancelled (by customer)
- From accepted or preparing: cancelled (by restaurant or admin, triggers refund)
- Every status change is recorded with time and actor (order_events table).
- Invalid transitions return 409.

## Payments

- Payment authorized when the order is placed; captured when delivered; refunded on cancellation.
- Stripe in test mode. Webhooks verified by signature and processed idempotently.

## Out of scope for now

Multiple cities, scheduled orders, promotions engine, ratings, courier payouts.
