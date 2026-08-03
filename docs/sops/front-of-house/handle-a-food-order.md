---
slug: handle-a-food-order
title: Handle a food order
category: front-of-house
audience: [reception, ops, admin]
route: /food-orders
relatedCode:
  - src/components/FoodOrders.jsx
  - src/lib/foodMenu.js
  - api/food/charge.js
  - api/food/checkout.js
relatedSops: [add-a-recurring-fee]
version: 1
reviewDue: 2027-02-01
---

## Purpose

Work through the day's café and bakery orders, and keep the menu current.

## When to do this

Each morning as part of the opening routine, and whenever an order comes in.

## The statuses

| Status | Meaning |
|---|---|
| **Awaiting payment** | Placed but not paid — do not fulfil |
| **Placed** | Paid, waiting to be accepted |
| **Accepted** | You've taken it on |
| **Delivered** | Handed over |
| **Cancelled** | Called off |

## Steps — work the orders

1. Open **Food Orders**.
2. Work through anything **Placed** — accept it, then mark it **Delivered** when handed over.
3. Leave **Awaiting payment** alone. It isn't paid.

## Steps — manage the menu

1. Switch to the menu tab and click **Add item**.
2. Set the name, price and **category**: **Breads**, **Pastries**, **Coffee** or **Drinks**.
3. Save. Members see it in the portal and app.

## What happens automatically

- Orders come in from the member portal and app.
- Payment is handled at checkout — which is why **Awaiting payment** exists as a distinct state.
- Menu changes are live to members immediately.

## Common mistakes

- **Fulfilling an Awaiting payment order.** It hasn't been paid for.
- **Marking everything Delivered at the end of the day.** The member sees the status; accurate is better than tidy.
- **Editing a price mid-morning.** Orders already placed keep their price; the change affects new ones. Fine, as long as you know.
- **Leaving sold-out items on the menu.** Members order things you can't supply.
- **Confusing a food order with a fee.** Food is paid at checkout, not swept onto the month-end invoice.

## If something goes wrong

- **An order was paid but shows Awaiting payment** — check with the member before charging again, then escalate rather than taking a second payment.
- **A member wants to cancel a paid order** — cancel it, then refund through Billing. There's no automatic refund here.
- **The menu isn't showing in the app** — check the item saved, then have the member reload.

> **TODO(verify):** confirm the exact button labels on the orders tab. I documented the statuses from `FoodOrders.jsx` and the **Add item** control on the menu tab, but did not pin the accept/deliver button wording. Walk the UI and quote them.

## Related

- [Add a fee or charge](../billing/add-a-recurring-fee.md)
- [Daily opening routine](../start-here/daily-opening-routine.md)
