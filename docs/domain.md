# Domain: food ordering and delivery

A marketplace in one city (Berlin to start). Customers order from restaurants;
couriers deliver. Prices in EUR, stored as integer cents. Times stored in UTC.

## Actors

- Customer: browses restaurants, orders, pays, tracks delivery (Next.js web app)
- Restaurant staff: manage menu and opening hours, accept and prepare orders (Next.js dashboard)
- Courier: accepts deliveries, picks up, delivers (Next.js web app)
- Admin: support, refunds, restaurant onboarding

Every client is a responsive web app that works in desktop and phone browsers.

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
  The first version has no discounts, so that term is 0 for now.
- The delivery fee is one flat fee per restaurant, set during onboarding.
- Customers can browse without an account. Placing an order requires signing in.
- Staff only see their own restaurant's orders. Customers only see their own orders.
- Deliveries are open offers: the first courier to accept gets the delivery. If no courier accepts
  within 10 minutes of an order reaching ready_for_pickup, admins are alerted.

## Order lifecycle

placed → accepted → preparing → ready_for_pickup → picked_up → delivered

- From placed: rejected (by restaurant, or automatically after 5 minutes without an answer) or
  cancelled (by customer)
- From accepted or preparing: cancelled (by restaurant or admin)
- From ready_for_pickup: cancelled (by admin)
- From picked_up: delivery_failed (reported by the courier when delivery isn't possible)
- From delivery_failed: delivered or cancelled (by admin)
- Every status change is recorded with time and actor (order_events table). Automatic changes
  record the system as actor, and a failed delivery also records the reason.
- Invalid transitions return 409.

## Payments

- Payment authorized when the order is placed; captured when delivered.
- A rejected or cancelled order releases the authorization, so nothing was charged. Customers are
  told their payment hold was released, never that they were refunded.
- Refunds only apply after capture: an admin issues them after delivery.
- If a failed delivery ends in cancellation, the platform covers the cost of the food for now.
- Stripe in test mode. Webhooks verified by signature and processed idempotently.

## Language

English first. Layouts leave room for German, which is added later and needs more space.

## Out of scope for now

Multiple cities, scheduled orders, promotions engine, ratings, courier payouts.
