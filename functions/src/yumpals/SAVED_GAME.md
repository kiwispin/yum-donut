# Saved three-round game service — LR015, internal only

Baseline21dfcf6; checkpoint
`checkpoint-before-yumpals-saved-game-2026-09-08`.
No production endpoints, paths, activation, rules, claims or live records changed.

## Contract

`createSavedGameService({db, refs, ready, now, chooseTarget})` requires trusted
config/pet/receipt/game/gameTurn resolvers. Readiness is default-closed; a
nonanonymous authenticated UID is checked before readiness and database access.
No display-name lookup or caller-supplied owner/path is accepted.

- `getGame({auth,data:{gameId}})` returns schema/owner/gameId, enabled, completed
  turn count, completion, score and already-recorded turns. It never initializes
  a session, draws a target, advances care or writes anything.
- `choose({auth,data:{gameId,operationId,round,choice}})` accepts exactly one
  left/right choice for round0,1,2. Return is `{outcome,duplicate}`. A successful
  outcome binds all four request fields plus owner, target, correctness and the
  server timestamp. Same operation replay returns the original recorded outcome;
  altered binding, skipped/stale rounds, corrupt records and paused fresh play
  fail without mutations.

The existing game purchase grants happiness once at purchase. The original
validated payment receipt and active pet entitlement are required for play.
Game turns never read or write a wallet, charge, pay a prize, grant more happiness,
change care-day/needs/checkpoint fields or edit the original payment receipt.
Completion only clears that game's active entitlement. A replay of a completed
older game cannot clear a newer game's marker.

The existing pet entitlement stays `{id,benefit,round:0}` for compatibility.
Separate server-owned game records hold progress; immutable turn records hold
each operation's result. Every saved turn is validated against its audit before
further reads or play. Unknown/corrupt/missing history is refused, not reset or
reconstructed. Completing the third turn atomically writes the game/audit and
clears the current pet marker; all original opaque pet fields are preserved.

Production default targets use Node crypto.randomInt independently of choices.
Tests inject predictable draws. A transaction retry can draw again, but only its
committed result is returned or revealed. Unplayed targets are never projected.
There is no payout or score-dependent care benefit. The original demo's fixed
targets and mutable receipt status are not copied into saved financial records.

## Integration boundary

No callable wrapper, public export, game transport/journal or handheld game
buttons are connected in this slice. The saved UI still deliberately refuses a
new game sale until the complete round/recovery connection is tested. Future
clients must keep an exact pending choice before dispatch, retry with its same
ID after uncertainty, and use a fresh getGame response for current progress.
Historical replay is not a current state snapshot. Raw errors are not permission
to reset a game or invent a new paid purchase. Teacher pauses preserve progress;
past committed turn replays remain readable while fresh turns are paused.

## Evidence

Ten new deterministic tests cover three-round completion, original payment and
benefit preservation, strict auth/readiness/input, owner/purchase proof, concurrent
duplicate turns, changed binding, paused/resumed play, every final staging failure,
commit failure, pet/gift overlap, corrupt audit/session, clock/random-source
failure, and old-game replay after a newer purchase. Full backend121 runner
entries passed380.892334ms; backend lint exit0.

Frontend122/122 regression tests passed388.325709ms; root lint exit0.
Build834ms,1710modules, unchanged JS890.50kB/263.35gzip and CSS80.85kB/15.10gzip.
Existing browser-data/chunk-size warnings remain. Harness helper5/5 passed
962.6305ms; syntax/diff checks passed.

The existing guarded Auth/Firestore/Functions verifier passed29 groups in27860ms
with cleanup PASS. The previous27 groups are retained; two new groups test
actual-SDK game read/duplicate convergence and final-write abort/completion with
full payment/wallet/opaque-progress comparisons. Explicit synthetic happiness2
setup permits a beneficial game purchase; it is not offline progression evidence.
Game calls use injected synthetic internal auth, not new HTTP handlers. Artifacts:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-E6YDvu`.
The separate cleanup sentinel exited1 intentionally after readiness with cleanup
PASS and no verification success; artifacts:
`/var/folders/2d/gft75_193hj9vpjv06mb63qh0000gq/T/yumpals-ownership-verification-X3RZwA`.
All five ports were independently free after both runs. This remains local
evidence, not production JWT, live ownership or compatible wallet-rules proof.
The central log records acceptance of the internal service only, not a live or
UI-connected game release.
