# Paid-care handheld prototype: parent review

Scope: isolated Stage 2 pretend-donut demo. User approved seeing/trying the full original-style experience. No approval to connect real wallets, deploy rules or charge students. Coder: Luna Extra High. Parent: independent code/visual review. Starting checkpoint: c44234c, tag checkpoint-before-paid-yumpals-demo-2026-09-07.

## Acceptance checklist

- Corrected reference: no primary word list. Four top icons and four bottom icons surround the visible pet; A changes selected icon, B opens that action, C clears/returns. Only secondary choices and paid confirmation replace the centre. Three round buttons on the shell, with accessible direct tap/keyboard equivalents.
- Idle feet/body stationary; eye blink only. Distinct minimal pixel responses for eating, cleaning, medicine, pat, reminder, direction game and sleep/wake.
- Prices/remaining pretend balance visible before confirmation; no-op, insufficient funds and duplicate confirmation cannot consume extra donuts.
- Local receipt and delivered effect agree. Game costs once, gives its stated benefit once, and C exit/resume does not charge again.
- Hunger/happiness/cleanliness/health capped at 0–4; default full-meter recovery costs14, plus reminder/bedtime16. Calendar simulation clearly labelled, no assertion of production clock/security fidelity.
- Mobile sprite/grid fit; no overflow; reduced-motion static feedback releases controls. Native focused-button Enter must not also trigger global confirm.
- Existing non-demo view, wallet, bank, gifting, Arcade, Teams, rules and production gate preserved. No live data write.

## Findings during implementation

R-H04 — Primary word-list navigation REFUSED by user. Parent visually inspected the official Gen 1 manual diagram on the resumed correction turn: top food/lights/game/medicine, bottom cleaning/status/discipline/attention; three A/B/C buttons. New icon-first implementation must be reviewed against that layout. Earlier written-instruction review was insufficient visual evidence.

R-H05 — First game guess crashed the prototype because its result omitted the target used by the reveal screen. Coder added targets to every round result; parent browser retest completed three rounds and confirmed one debit/benefit. Final regression verification remains required.

R-H06 — Buttons initially floated below the casing; parent requested and observed them moved inside it. Also flagged duplicate pat hearts, fractional grid sizes, premature visual unlock, off-by-one reveal label and unreflected paid lights-out. Latest interrupted revisions require final verification; they are not automatically accepted.

R-H01 — Initial pure-state draft REFUSED pending revision: beginPaidCare grants game happiness, then submitGameChoice can grant it again. Fix by delivering guaranteed care once with purchase and completing only the game session/score afterward. Require a start/exit/resume/finish regression.

R-H02 — Initial draft REFUSED pending revision: advancing the demo day or clearing a session can discard paid game progress. Preserve resumable entitlement unless the user explicitly resets the disposable scenario.

R-H03 — Initial estimate REFUSED pending revision: three missing hunger/happiness hearts were estimated as two 2-donut actions, overlooking the 1-donut alternative. Recovery estimate must match the cheapest guaranteed available care sequence.

## Baseline evidence

Unchanged backend/Teams tests23/23, 129.614ms; backend lint exit0. Final UI and paid-care checks remain pending. Existing gold tags and prior source checkpoint retained. No runtime acceptance implied by this draft review.

## Final parent disposition — ACCEPTED as a local prototype

2026-09-07: R-H01–R-H06 revised implementations accepted for this isolated demo. Further refused intermediate revisions: oversized icons caused by the later base-grid CSS rule; Game icon resolving to a missing submenu; C unexpectedly leaving the toy; no distinct paid night dim. Each was corrected on new evidence, not retried unchanged.

- Browser cycled all eight icons in reference order with the central pet visible every time. C clears selection and a second C remains in the toy. Secondary Food and Play choices remain intentionally textual; primary navigation is icons.
- Meal cancellation left25; focused native Enter purchased exactly once, leaving23. Food pixels decreased28→22→14→0; controls stayed locked through completion and then released. Clean showed three distinct prop patterns; medicine/reminder showed their own props and charged2/1. Preferences opened and toggled reduced motion without charge.
- Game pause/resume/three rounds finished with one2-donut receipt and happiness2, without another benefit or crash. Full-motion first reveal displayed ROUND1, LEFT, MATCH with A locked; game sprite measured80px.
- Bedtime left24, persisted across00:00/06:00 and woke07:00 with24 unchanged. Purchased night LCD changed from rgb(158,173,117) to rgb(135,152,109). No-funds care preserved0.
- Idle lower-body pixel pattern was identical across6.1seconds. At390×844, document width390, casing x26.40–363.60, sprite128×128, all eight icons24×24. Screenshot visually checked; temporary viewport override reset.
- Parent frontend/bank suite25/25 in52.328625ms; lint/build/diff-check exit0. Build472ms/1696modules, JS835.76kB (245.98gzip), CSS78.06kB (14.50gzip). Existing stale browser-data and large-chunk warnings remain.

This is not production acceptance: state/receipts reset on reload, wallet and clock are simulated, no real student is charged, and cloud staging/wallet-security prerequisites remain unresolved. Existing live module stays gated and its care UI is unchanged. Historical HMR errors occurred during incomplete edits; they are not represented as a clean development history.

Final clean reload and fresh Needs Care selection: no new browser error entries. Review tab left with25 pretend donuts, Food selected and testing controls collapsed.
