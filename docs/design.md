# Design: customer web app

The chosen look is **Market refined**, decided on 2026-11-05. It covers the customer web app. The
restaurant dashboard, courier app and admin tools aren't designed yet.

- [Design canvas](https://claude.ai/artifact/77mmy1PyxLuBBj2qgFCr7e), on its "Market refined" page
- [Customer flow and wording](https://claude.ai/artifact/YWgkvof32jR3CNf9uoFKwq)

Both links are private to the project owner. The food illustrations are stored on the canvas.

## Principles

- Dark and food-first: big, image-led cards on a dark page, with bright colour from the food.
- Wolt is a reference for layout and feel only. Never copy its logo, colours or artwork.
- Every page works in desktop and phone browsers. Grids wrap, and long rows scroll sideways.
- Customer wording comes from the flow map. Never tell a customer they were refunded when a hold
  was released.
- Nothing out of scope appears on screen: no ratings, discounts, sponsored labels or memberships.

## Colours

Dark only for now.

| Name       | Value     | Use                                     |
| ---------- | --------- | --------------------------------------- |
| Ground     | `#0e1712` | Page background                         |
| Surface    | `#18261f` | Cards, panels, search and address pills |
| Line       | `#223229` | Dividers and borders                    |
| Text       | `#eef3ee` | Main text                               |
| Muted      | `#a7b5ab` | Secondary text                          |
| Lemon      | `#ffcf3d` | Primary buttons, prices, highlights     |
| On lemon   | `#14201a` | Text on lemon                           |
| Lemon tint | `#3b2d08` | Soft highlights and notices             |
| Tomato     | `#c93a1a` | Feature banners, with white text        |
| Deep green | `#12492f` | Order status banner                     |

Restaurant cards use bright image tiles: lemon, tomato, `#a9dcf2`, `#ffb59e`, `#1f6b49` and
`#4a2c6d`. Category tiles use dark tints: `#3b2d08`, `#3a1c10`, `#3a1410`, `#0f3a28`, `#2b1e45`
and `#0f3346`.

## Type

- Headings, restaurant and dish names, totals: Bricolage Grotesque, 700 and 800.
- Everything else: Figtree, 400 to 700.

## Shape and layout

- Radius: 28 px for banners, 24 px for panels, 20 to 22 px for cards, full pills for buttons.
- Page width is at most 1360 px, with a 32 px gutter on desktop.
- Touch targets are at least 44 px.
- Text contrast is at least 4.5:1, or 3:1 from 24 px.

## Not decided yet

- Product name. Designs show `[App name]`.
- Restaurant and menu item photos. Designs use illustrations in the same image slots.
- Delivery time estimates.
- A light theme.
