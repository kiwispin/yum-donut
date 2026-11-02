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
- ACCEPTED — food and drink opening hours, asked for during the release ("Shut the
  shop after 5pm, open at 7 am? Food food/drink stuff?"). Snack Box Treat, Double
  Snack Attack and Hot Chocolate are marked `food: true` and sell only from 7:00 to
  16:59 Auckland time, every day (`isFoodOpen`, `aucklandHour` in
  `src/shopLimits.js`). `handlePurchase` refuses outside those hours
  ("SHOP_CLOSED"); the card shows "Open 7am–5pm" and a Closed button. Everything
  else, including the raffle, is unchanged. The hour comes from the device clock, like
  the app's other daily limits.
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
- With opening hours: 218 pass, 0 fail (2 more). Lint clean. Sandbox student view
  at 17:xx Auckland: Snack Box, Double Snack and Hot Chocolate show "Open 7am–5pm"
  and a disabled Closed button; the raffle still shows Buy. No console errors.
- Not exercised: buying while in stock, selling out, the weekly limit, and the open
  state during hours, which would write to the live project or need daytime.

## Release — 3 November 2026

The owner approved the release ("Release it"), then added the opening hours.

- Frontend only: no function deploy and no Firestore rules change.
- `npm run build`: JS `index-CGOTsd8X.js` 988.72 kB / 295.23 kB gzip, CSS
  `index-OpsmyNCt.css` 106.44 kB.
- Rollback: rebuild and publish `codex/hot-chocolate-baseline-20261103` (`050c658`,
  the production source before this release). Weekly and stock counts already
  written stay as harmless `shop_weekly` / `shop_stock` documents.
- To sell hot chocolate: Admin Settings → Store Items → Hot Chocolate → Stock Per Day
  (all) = 3 → Save. It is off sale (stock 0) until then.
- RELEASE VERIFIED — source `3221cc4` is on `main` and `codex/hot-chocolate`, with
  the rollback tag `codex/hot-chocolate-baseline-20261103` (`050c658`) pushed; remote
  IDs verified. Published with `npm run deploy` as `gh-pages` `5ce01e8`, live after
  ~40s. Byte-identical to the build:
  - `index.html` (MD5 `b81be73d953f9845a6515fece849c256`).
  - JS `index-CGOTsd8X.js` (`3682e98de2d4b6bd2115c3238b39d29b`).
  - CSS `index-OpsmyNCt.css` (`eccb77a99785e1455dbfa54ab771f4fc`).
  The live bundle contains Hot Chocolate, the closed-hours refusal, "Not on sale
  today" and the Stock Per Day setting. Not seen live signed in.

## Sugar-free, 2 a day, weekdays only — 2 November 2026

Request: "There's only 10 things in the box, so let's do 2 a day ALSO, list it as
Sugar-Free Hot Chocolate." Selling every day would let 2 a day empty the box before
the week was out, so the owner chose to sell food and drink on weekdays only.

Branch: `codex/food-weekdays`, from `main` `14e37a1`.

- ACCEPTED — the default item is now "Sugar-Free Hot Chocolate", with the
  description "A sugar-free hot chocolate from the studio. Only 2 each day, one each
  per week." and a stock of 2 a day, so it goes on sale with this release. There is
  no Admin override for it yet; any saved later in Admin wins over these defaults.
- ACCEPTED — food and drink (Snack Box Treat, Double Snack Attack, Sugar-Free Hot
  Chocolate) sell Monday to Friday, 7:00–16:59 Auckland time (`aucklandWeekday`,
  `isFoodOpen(hour, weekday)`, `isFoodOpenAt` in `src/shopLimits.js`). The card
  reads "Open Mon–Fri 7am–5pm"; the refusal says "Monday to Friday, 7am–5pm".
  2 a day × 5 days = the box of 10 each week.

### Checks

- `node --test src/*.test.js src/arcade/*.test.js src/yumpals/*.test.js`: 220 pass,
  0 fail (2 new: weekends closed, weekday read on Auckland time across the UTC date
  line). `npx eslint .`: clean.
- Browser, local dev server, read-only sandbox as "Alice", Monday 6:53pm Auckland:
  the three food items show "Open Mon–Fri 7am–5pm" and Closed; Sugar-Free Hot
  Chocolate shows its new description, "Only 2 left today" and "This week 0/1";
  the raffle still shows Buy. No console errors.
- Not exercised: the open state during a weekday and a real purchase.
