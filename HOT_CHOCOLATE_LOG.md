# Hot chocolate — 3 November 2026

Request: add hot chocolate to the shop without it becoming too popular. The owner
chose 25 donuts, about 3 a day in total, and once a week per person. Supply is
fixed: no bigger items.

Branch: `codex/hot-chocolate`, from `main` `050c658` (the reward rework release).

## Changes / disposition

- ACCEPTED — two shop settings beside the per-person daily limit
  (`src/shopLimits.js`): a stock shared by everyone each Auckland day
  (`dailyStock`), and a per-person limit each Auckland week, Monday to Sunday
  (`weeklyLimit`). null means no limit; a stock of 0 takes an item off sale.
- ACCEPTED — `handlePurchase` reads `shop_weekly/{weekKey}_{name}_{item}` and
  `shop_stock/{dateKey}_{item}` in the purchase transaction, refuses a sold-out
  ("SOLD_OUT") or already-bought-this-week ("WEEKLY_SHOP_LIMIT") purchase, and
  writes both counts with the sale. Existing items have neither setting, so their
  purchases are unchanged.
- ACCEPTED — the Shop card shows "Only n left today", "Sold out today" or "Not on
  sale today", and "This week n/1"; the button reads Sold Out, Next Week or Not on
  sale. Live counts come from two listeners (this student's weekly counts, today's
  shared stock).
- ACCEPTED — Admin Settings → Store Items has Weekly Limit and Stock Per Day (all)
  for every item; `handleSaveShopItem` validates and saves both.
- ACCEPTED — Hot Chocolate ☕, 25 donuts, weekly limit 1, stock 0, so it starts off
  sale. To sell it, set Stock Per Day to 3 in Admin Settings and save; set 0 to stop.
- ACCEPTED — `releaseScope.test.js` names `handlePurchase` and `handleSaveShopItem`
  as approved changes.
- NOT CHANGED — What's New. The owner may announce hot chocolate when it goes on sale.

## Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 216 pass,
  0 fail (6 new). `npx eslint .`: clean.
- Browser, local dev server, the app's read-only sandbox (no purchase or save):
  as the student "Alice", Hot Chocolate shows 25, "Not on sale today", "This week
  0/1", and a disabled "Not on sale" button. The owner's new prices were visible
  (raffle 4, Snack Box 8, Double Snack 14). As the teacher, Store Items shows Weekly
  Limit and Stock Per Day for every item, and Hot Chocolate at 25 / 1 / 0. No
  console errors.
- Not exercised: buying while in stock, selling out, and the weekly limit, which
  would write to the live project.
