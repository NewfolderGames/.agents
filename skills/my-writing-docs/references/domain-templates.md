# Domain-Specific Documentation Templates

Adapt these templates to the target repository's existing conventions first. Use them directly when the project defines no house template.

## 1. Explaining Dense Code (*Why* + *How*)

When 20 lines of regex, macro rules, reflection, bitwise packing, or subtle concurrency replace 200 lines of verbose code, place a structured comment block directly on the boundary:

```text
// <Mechanism Name>
//
// Why: <1-2 sentences stating the constraint, performance need, or boilerplate saved.>
//
// How: <Step-by-step breakdown of capture groups, bit layout, macro expansion,
//       or reflection lookup contract.>
//
// Example:
//   Input:  <concrete sample input or macro invocation>
//   Output: <parsed result, state change, or expanded sketch>
```

## 2. Actionable Error Messages

State what failed (simple past), state the specific cause, and give the recovery action (imperative):

```text
Connection to PostgreSQL at `db.internal:5432` failed. The password for role `app_reader` was rejected. Update `DATABASE_URL` and restart the worker.
```

## 3. `TODO` Markers

Put the condition or blocker first, followed by an imperative instruction under 20 words:

```text
// TODO: Once the billing API exposes cursor tokens, replace offset pagination in listInvoices.
```

## 4. Runbooks and Operational Procedures

Write numbered imperative steps with conditions placed before commands, one action per step, and explicit `WARNING:` or `CAUTION:` blocks before risky commands:

```text
CAUTION: Do not run `backfill_ledger` during the 00:00 UTC settlement window.
Concurrent writes lock the `journal_entries` table for up to 8 minutes.

1. If replication lag exceeds 2 seconds, wait until lag drops under 500ms.
2. Run `pnpm --filter ledger backfill:dry-run` and check that mismatch count equals 0.
3. Run `pnpm --filter ledger backfill:apply --batch-size=500`.
```

## 5. Incident Postmortems

Use simple past tense for verified timeline events. Distinguish confirmed facts from unconfirmed hypotheses explicitly instead of guessing:

```markdown
## Impact
Between 14:02 UTC and 14:19 UTC, 18.4% of `/v2/checkout` requests returned HTTP 503.

## Root Cause
Commit `8f21c04` increased the per-pod Redis pool size from 20 to 100 connections. Across 40 pods, total connections exceeded the `maxclients` limit of 3,000.

## Unconfirmed Factors
Whether the simultaneous CDN cache purge increased origin traffic remains unverified because edge logs rotated before collection.
```

## 6. Commit Bodies and Changelogs

Write an imperative subject line matching repository prefix conventions (`feat:`, `fix:`, or plain imperative). In the body, state what changed and why in plain sentences:

```text
Replace manual CSV tokenizer with precompiled field regex

The 210-line character loop misparsed escaped quotes inside multiline cells.
A 15-line RFC-4180 regex with documented capture groups passes all edge-case
fixtures and removes three intermediate buffer allocations.
```
