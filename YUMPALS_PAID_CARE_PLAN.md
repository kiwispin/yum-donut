# YumPals: full school-safe paid-care plan

Status: proposal for review, 2026-09-07. No coding, student charges, cloud project creation or deployment authorised by this planning pass. Preview checkpoint: `a0465d1`; gold-standard tags remain intact. This replaces the earlier free-care design for the NEXT implementation, not the currently running preview.

## 1. Agreed requirements and proposed defaults

Agreed: an original-style virtual pet inside YumDonut, not a feed/pat checklist. One simple original pixel blob in a handheld casing; paid care consumes donuts, with no pet donut payouts. Hunger/loneliness and other unmet needs can require more paid actions to recover. Recovery is capped; no death, negative balance, debt or lost possessions. Weekends, holidays and approved absences pause deterioration. Idle feet/body stay still; occasional eye-only blinks are sufficient.

All numeric prices, decay rates, restoration amounts, schedules, caps and adoption terms below are PROPOSED, awaiting approval. They are design estimates, not measured student affordability. No live student balances were queried.

## 2. Full activity coverage

[Bandai's Original manual](https://tamagotchi-official.com/manual/toy/original/Original_webmanual.pdf) establishes feeding, lights, cleaning, health/status, games, medicine, attention and discipline. [Bandai's original-programming product description](https://www.bandai.com/original-tamagotchi-translucent-blue) specifically identifies direction-guessing play. Use Gen 1 direction play, not Gen 2 higher/lower. Sources establish original behaviours, not our prices or exact animation timings. School protections and paid care are intentional adaptations; do not claim an exact replica.

| Function | YumPals behaviour | Minimal screen animation |
| --- | --- | --- |
| Meal / snack | Priced food menu, restores hunger | Open mouth → close and remove bite; three food sizes → gone; happy finish |
| Game | Left/right guessing, three rounds per paid session | Look left/right; happy or neutral reaction |
| Health/status | Four-heart hunger, happiness, cleanliness and health meters; age/stage and attention reason | Static small panels; inspecting is uncharged |
| Cleaning | Visible mess reflects bounded cleanliness deficit | Two/three sweep frames, some/all mess disappears |
| Medicine | Available below full health, guaranteed stated recovery | Medicine prop, blink; illness marker clears as health recovers |
| Sleep / lights | Natural sleep plus paid bedtime routine | Closed eyes, alternating Z/Zz, dim lights; wake expression |
| Discipline / attention | Gentle routine reminder; never physical punishment or shaming | Listen/acknowledge pose; attention flag clears |
| Pat, an addition | Paid alternative to game for happiness | Happy eyes and one pixel heart |
| Growth | Preserve cumulative progress and earned rewards | Brief silhouette/frame change and celebration |

All these activities are core planned scope. Cosmetics are secondary. Use original blob art, not copied characters, branding or sprite sheets.

## 3. Proposed donut economy

Use existing spendable wallet `balance`, not `bank_balance`, giving allowances, lifetime received or Given totals. Never automatically withdraw savings. Students may use the existing Bank first. No second live currency: pet spending removes donuts from circulation.

| Purchase | Donuts | Guaranteed benefit |
| --- | ---: | --- |
| First adoption | 5 | One full-needs pet; no retrospective charge for existing pets |
| Meal | 2 | Up to 2 hunger hearts |
| Snack | 1 | 1 hunger heart, different food prop |
| Game | 2 | Up to 2 happiness hearts and three playable rounds |
| Pat | 1 | 1 happiness heart |
| Clean | 1 | Up to 2 cleanliness hearts |
| Medicine | 2 | Up to 2 health hearts |
| Bedtime routine / lights out | 1 | Settle pet and dim room until scheduled wake, at most once per school date |
| Gentle reminder | 1 | Clear an active unnecessary-attention flag |
| Optional owned items | 5–25 | Permanent case pattern, bed, hat or similar clearly identified item |

Every initiated care activity costs donuts. Status, menus, leaving the module, accessibility settings, equipping already-owned items and automatic time transitions are not purchases. No fee just to open or close a screen.

Block ineffective care at full meters and reminders without a flag. Show exact partial benefit before buying; if only one hunger heart is missing, suggest the cheaper snack. Confirm action, cost and remaining wallet. No hidden surcharge, automatic spending, subscription or compulsory catch-up bundle.

Game fee buys a session and guaranteed care, not a wager. Correct guesses change score/reaction, not donut winnings or whether the promised care is delivered. Commit happiness plus a resumable game entitlement with payment; reconnecting resumes it without another fee. No random loot boxes.

## 4. Needs, deterioration and recovery

Four integer meters range 0–4: hunger, happiness, cleanliness, health. Start full. Zero means a recoverable need, not death. Labels describe the pet's needs without publicly judging the student.

Proposed timing:

- Each completed unpaused school date reduces hunger, happiness and cleanliness by 1, floored at 0.
- Health falls by 1 only if hunger or cleanliness was already 0 at the START of that daily step. Otherwise it stays unchanged; medicine restores it.
- First decline follows the first complete eligible day after adoption. Server evaluates eligible Auckland calendar dates once each, not elapsed milliseconds divided by 24 hours and not a browser timer.
- Weekends, holidays, approved absence intervals and teacher/module pauses contribute no decline. No catch-up charge for frozen dates. Keep effective-dated calendar/config history so later edits do not retroactively invent deterioration or undo past care. A newly approved absence applies to a recorded interval, with any retroactive correction separately reviewed/audited rather than replaying transactions.
- Needs saturate at their floors. No backlog of mess, illness multipliers, compound fees or accumulating debt. Long gaps use bounded/cached calendar calculations, not unlimited transaction loops.

Default recovery from all four meters at zero:

| Need | Care required | Cost |
| --- | --- | ---: |
| Hunger | 2 meals | 4 |
| Happiness | 2 games or 4 pats | 4 |
| Cleanliness | 2 cleans | 2 |
| Health | 2 medicines | 4 |
| All meters restored | | **14** |
| Plus one outstanding reminder and one bedtime routine | | **16 total** |

This is the default maximum for one full care checklist without intervening decline, not an automatic bill. Adoption and optional purchases are separate. Further days can create new ordinary needs, but not an unbounded neglect surcharge. Example: one missing hunger heart costs a 1-donut snack; four missing hearts cost two meals, 4 donuts. Unit prices stay fixed.

Show a recovery estimate and allow gradual recovery. If wallet funds are insufficient, no debit or effect occurs; show the shortfall and Bank link. The pet can reach its floor but never deteriorates past it. Do not silently waive charges, overdraw or erase progress.

Proposed care-spending cap: 25 donuts per school date, with optional items separately capped by the teacher. Validate that configured care cap is at least the configured maximum recovery cost. Show upkeep/recovery estimates when changing prices or restoration sizes. Tune prospectively after a pilot; daily gifting income has not been measured for this proposal.

## 5. Sleep, attention and growth

Proposed automatic sleep window: 19:00–07:00 Auckland, teacher-configurable. Automatic sleeping/waking is the passage of time, not a free purchased care action. Students can buy the bedtime routine during their school visit and schedule it for that evening. No obligation to log in at bedtime; missing lights-out adds no overnight penalty or debt. At most one paid routine per school date; repeated toggling cannot repeatedly charge. The current free cosmetic Nap/Wake is replaced by this coherent sleep/light behaviour.

For automatic attention, highlight a genuine unmet need. To retain original-style discipline safely, propose at most one gentle unnecessary-attention prompt every five eligible dates, only while all needs are satisfied. One paid reminder clears it. It never prevents feeding/medicine, causes injury, recurs repeatedly that day or increases the capped backlog. No moral labels or snack-caused death.

Preserve all existing careDays, earned milestones, name/species and possessions. Proposed future growth: at most one care day per eligible date when a beneficial paid action occurs and all four meters are at least 3 afterward. Extra purchases cannot farm growth. Retain current 3/5/10/20-day thresholds unless separately approved. Settings changes never revoke already-earned rewards.

## 6. Device and animation specification

Screen-led design: care icons around the little display, blob and props, compact status/menu screens. Do not bury the experience under dashboard cards. Three round buttons: A cycles, B selects/confirms, C cancels/returns without charging. Direction-game A/B choose left/right, C exits; explain the temporary mapping on screen. Direct icon taps and labelled keyboard equivalents remain supported. Settings must remain visibly separate and restore focus.

One original 16x16 blob, preserving existing species IDs as colour variants. Stationary idle silhouette and feet, with an eye-only blink about every 5–8 seconds. Two basic expression poses per activity plus the minimum prop states needed. Eating remains open → closed/bite removed. No continuous foot shuffle, smooth bobbing or elaborate choreography. Reduced motion shows a meaningful static result and releases controls normally.

One sequence at a time. Pending payment precedes animation; animate only confirmed delivery. Failure/rejection never pretends successful eating or healing. Closing the tab cannot cancel a committed benefit or cause a second payment. Food, medicine, mess and heart must be real visible pixel props, not emoji or text substitutes.

## 7. Financial and security integration gates

Read-only repository findings:

- Bank code accesses a UID-private profile and name-keyed public profile; existing shop code uses the public wallet. Determine the canonical wallet and required mirror protocol first. Copying the current purchase handler is not sufficient evidence of correctness.
- The audit view recognises `The Shop` as spending; other outgoing recipients may count as giving. Pet charges need explicit transaction type/category support so they affect Spent/Available, not Given. Preserve old records and historical totals; do not rewrite history to force agreement.
- Earlier live-rule inspection found broad public reads/authenticated writes. Pet-only protection does not secure the wallet. Paid activation is blocked until wallet permissions, identity mapping and every overlapping allow are reviewed. Tightening them can affect bank, gifting, Arcade, shop and Teams writers: stage a separately reviewed compatibility change, not an untested blanket deny.

Required purchase protocol:

1. Authenticate non-anonymous UID; resolve the exact owned wallet/public record using verified server-owned mapping, never a supplied name. Ambiguity fails closed without modifying either Lara's account.
2. Read current price/config version, eligible date, pet/inventory, canonical wallet/mirrors and prior request receipt. Server calculates price and effect. Invalid, missing or conflicting balances require repair; never turn them into zero or choose the larger copy.
3. One stable operation ID per confirmed purchase survives timeout/retry/reload. Same ID plus different payload is rejected. Client sends expected price version, not authority to choose the price; a change requires reconfirmation.
4. ONE server Firestore transaction debits wallet/required mirrors, delivers pet effect/item/game entitlement, writes a protected authoritative receipt and compatible activity record. All commit or none. Receipt contains UID, request ID, action/category, amount, config version, before/after wallet and effects, delivery ID and server time. Public activity contains only reviewed display fields, not the full private receipt.
5. Concurrent purchases, bank moves, gifting, Arcade rewards and shop transactions must preserve the same wallet invariant. Existing client synchronisation must not resurrect spent donuts. This is a release gate even if a separately approved shared-wallet change is necessary.
6. After uncertain responses, fetch receipt before retrying. Failed/insufficient/no-op attempts have no successful-spend entry or debit; record operational outcomes privately. Refunds are authorised compensating entries linked to the original receipt, not deleted history. No orphan charges or double delivery.

Explicit tests cover new users, existing users, renamed users and same-name/different-UID users. No account merge, backdated charge, balance reset or silent public/private reconciliation.

## 8. Settings and migration

Teacher settings use trusted server claims: enablement, positive integer prices, restoration sizes, decline rate, calendar/absence freezes, sleep hours, care/item spend caps and available extras. Save prospective versioned changes with actor and before/after audit. Show maximum recovery cost before saving. No zero-price preset under the current paid-care policy.

Student settings: pet name, owned decorations/casing, reduced motion and mute. Preferences do not change needs, funds, ownership or price; accessibility is uncharged.

Add versioned paid-care state without resetting existing pets. Initialise new meters full at migration time; preserve prior progress/items and charge no retrospective adoption/neglect. Migration is idempotent. Explicitly translate prior daily care records. Old free-care callables must be disabled or version-gated for migrated pets; old clients cannot bypass payment. Do not turn on charges while the free-care UI is the only available workflow.

## 9. Staged delivery and acceptance

1. User reviews defaults in this proposal. No implementation starts merely because this planning pass was requested.
2. Luna Extra High builds the full device/needs loop in a clearly labelled pretend-donut demo; no live wallet calls. Parent reviews every row of the activity table and the capped recovery example, not only unit tests. Remove idle foot movement in this stage.
3. Audit shared wallet/identity/security and agree the compatibility change. Establish an authorised separate cloud stage. Current emulator evidence is not cloud-staging approval; no project creation, claims or rules deployment without authorisation.
4. Luna implements authoritative paid care, receipts and migration in staging. Parent reviews measured correctness/security and regression results. Log every attempt as accepted/refused; reuse corrected work rather than repeating failed approaches.
5. Limited rollout only after explicit approval, with default-off feature gate and reconciliation monitoring. No live student test purchases without approval. Observe affordability and recovery burden before tuning prices.

Required verification: each action's price/effect/no-op; zero/full/partial meters; exact 14/16-donut recovery; wallet insufficient but bank sufficient; intentional bank withdrawal; calendar/DST/holiday/absence/long gaps; prospective config changes; concurrent cross-module debits/credits; duplicate/reloaded request; failed commit; wrong UID/name collision; forged price/time/claims; direct wallet/pet writes; old free endpoint bypass; receipt privacy and audit classification; migration retries; refunds; game resume; animation frames, keyboard, reduced motion, mobile and existing bank/auth/Arcade/gifting/shop/Teams regressions.

Rollback: retain gold-standard tags and checkpoint again before coding. Pause new charges AND decline first. Keep all pets, inventory and receipts; preserve valid post-launch wallet transactions. A frontend rollback must not re-enable free endpoints or overwrite current balances from old snapshots. Server versions must remain compatible. Never restore an old database over newer student purchases.

## 10. Evidence for this planning pass

Read existing plan/log, bank/shop/audit handlers and identity helper; verified official Bandai feature description. Only planning documents/log changed. No application/configuration changes, UI resets, deployments or live data writes. No new runtime tests/build claimed; implementation and monetary safety remain unverified until the stages above run.
