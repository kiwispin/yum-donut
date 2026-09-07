# YumPals implementation contract

## Approved experience

An original pixel virtual pet in an egg-shaped handheld device: coloured frame, inset pixel screen, room, status icons, three real working pretend-hardware buttons (cycle/select/back). Also allow direct icon taps and accessible labels/keyboard use. Original 32x32-style creatures and pixel animations, no copied Tamagotchi branding/art. Responsive mobile/desktop; scoped styling, muted by default, reduced-motion support.

One UID-owned pet per student, including new accounts and same-name students. Adopt one of three original creatures, choose name/colour. Daily feed plus pat/play, approximately one minute. Free essential care, no donut purchases/payouts/wallet writes in v1. Casing customisation included. Student-drawn decorations and social gallery deferred. No competitive leaderboard.

Missed days never kill pets, remove progress, or create catch-up debt. Rest during weekends/holidays; cumulative eligible school-day care, not streaks. Suggested milestones: day 3 trick, 5 accessory, 10 junior/toy, 20 grown/theme. Clearly reflect milestones in UI. Define and test Auckland day boundaries, school days, holiday handling, once-per-day completion, repeat-click/concurrency safety.

Settings: teacher-controlled enable/disable (default OFF for safe rollout), holiday rest, growth speed presets and available starter creatures where feasible; student name, colour/casing, reduced motion. Disabling or changing settings must not erase pets. Integrate existing school calendar where appropriate, without changing existing logic. No false success on failed saves; show loading/retry clearly. Keep existing app functional on pet failures.

## Architecture and safety

Module owns UI, pure care/progression rules, persistence adapter, sprites, tests and documentation. App.jsx edits limited to navigation/render/settings integration. No changes to existing auth, bank, arcade, gifting, leaderboard, Teams behaviour or monetary data. No broad refactors or dependency upgrades.

Use server-validated time and UID identity for authoritative cloud state. Save care/state/audit atomically and deduplicate repeats. Never pretend client-only checks are server security. Inspect existing infrastructure; if secure backend/rules deployment cannot be verified safely, deliver a clearly labelled local demo/preview and keep cloud/production rollout disabled with exact prerequisites documented. Do not add broad Firestore rules or overwrite production rules. Do not use admin display name as new server authorisation.

Provide isolated demo mode with controlled date/time for test/review that never writes real accounts. Cover adoption, daily care, growth, no loss on missed days, weekend/holiday, midnight/DST, duplicate submissions, same-name/different-UID identity, settings preservation, invalid persisted data, error/retry and existing bank regression tests as feasible. Avoid asserting unperformed browser/server tests passed.

## Workflow

Luna Extra High implements and tests. Parent reviews; send fixes back to Luna rather than silently changing model for coding. Read YUMPALS_CHANGE_LOG.md before every revision, log each attempt and measured results, retain refused attempts. No previously attempted change repeated without new evidence. Parent owns final acceptance/refusal decisions.

Do not deploy, push, mutate live records, or reset the gold standard. Baseline tags and details are in the change log. Finish with file list, tests/results, limitations, deployment prerequisites and rollback impact.
