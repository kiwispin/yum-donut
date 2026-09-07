# LR003 compatibility boundary — not financial authorization

The App's display-name teacher access and client-writable legacy UID linkage are
unchanged security limitations. No paid-pet activation, rules change, server
authorization or deployment is implied by this slice.

## Jobs

Each claimed job document is independently payable from `claimed` or
`pending_review`. Multi-spot claims use child documents; the last claimant uses
the original document. Payout reads the saved reward and claimant, not arguments
from the screen. Claim creation/allocation itself is not changed or certified.

Both wallet mirrors, public lifetime_received, paid status, audit receipt and
activity commit together. Given, savings and private lifetime fields retain
their prior semantics. Audit receipts in `public/data/bounty_payments/{bountyId}`
bind the job ID/path, claimant UID, amount and before/after wallet/lifetime.
Old `paid` jobs without receipts remain nonpayable; changing a newly paid job
back to claimed cannot bypass its receipt. Deleting a feed item cannot repay it.

## Interest

Manual invocation and the existing rate, threshold and floor calculation remain
unchanged. Each recipient transaction reads current savings and both wallets.
The existing `resolveBankBalance` absent-field policy is retained, including
protected-owner accounts: an absent bank field can use the other valid copy;
both absent mean zero. Explicit invalid values or conflicting present values
fail. Protected owner assertions and wallet equality must still agree. Only
savings change; wallet, Given and lifetime totals are untouched.

Per-recipient audits are separate from deletable feed items, under
`public/data/bank_interest_runs/{operationId}/recipients/{uid}`. Zero-interest
receipts freeze that recipient's evaluated eligibility for the run. Confirmed
run totals include replayed receipts; newly paid totals exclude them.

Before any payout a validated manifest is saved and read back from localStorage
under `yum-donut:interest-run:v1:{teacherUid}`. Partial or uncertain failures keep
it; reload/reopen resumes its ID, rate and recipients. Storage errors/corruption
fail closed. Completion removes only an exactly matching manifest after all
recipients and the summary are confirmed. Legitimate unclaimed records without
UIDs skip; claimed missing UIDs reject before manifest creation or payouts.

REFUSED drafts: validating all unclaimed roster records blocked legitimate
interest; ref-only IDs could repay after refresh; storing null UIDs froze runs
that could never finish. These were replaced, not accepted as release evidence.

This is LOCAL recovery, not a durable server-run guarantee. Clearing browser
storage, changing browser/device, concurrent tabs/teachers, or client tampering
remain release gates. Matching removal is not a cross-tab lock. Protected
server-owned manifests, receipt rules and teacher authorization must replace
these client dependencies before financial release. Current broad rules may
still permit audit tampering despite the separate non-feed namespaces.

Tests execute actual extracted App handlers with synthetic transactions and
explicit overlap barriers; they do not certify Firestore SDK/emulator behavior.
Parent owns the central live-rollout log and acceptance decision.
