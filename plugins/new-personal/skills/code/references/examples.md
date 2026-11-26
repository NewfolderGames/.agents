# Worked Examples: Readable Chunks, Concise Power, and Deletable Modules

Use these reference patterns when balancing conciseness, readability, and maintainability.

## 1. Functional Pipelines in Readable Chunks

Functional chaining is clear when each stage states one domain step. It becomes hard to maintain only when anonymous multi-line logic is crammed into one expression.

### Hard to Resume (Unchunked Inline Chain)

```ts
const report = orders
  .filter((o) => o.status === "paid" && o.items.some((i) => !i.refunded && i.netCents > 0) && o.paidAt >= cutoff)
  .map((o) => ({ region: o.shipping?.country ?? "UNKNOWN", total: o.items.reduce((s, i) => s + (i.refunded ? 0 : i.netCents), 0) }))
  .reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.region]: (acc[x.region] ?? 0) + x.total }), {});
```

### Easy to Resume (Named Predicates and Milestone Chunks)

```ts
const isNetPositiveItem = (item: OrderItem): boolean =>
  !item.refunded && item.netCents > 0;

const resolveOrderRegion = (order: Order): string =>
  order.shipping?.country ?? "UNKNOWN";

const isSettledOrder = (order: Order): boolean =>
  order.status === "paid" &&
  order.paidAt >= cutoff &&
  order.items.some(isNetPositiveItem);

const sumOrderNetCents = (order: Order): number =>
  order.items.reduce((sum, item) => sum + (item.refunded ? 0 : item.netCents), 0);

const settledOrders = orders.filter(isSettledOrder);
const ordersByRegion = Map.groupBy(settledOrders, resolveOrderRegion);

const revenueByRegion: Record<string, number> = Object.fromEntries(
  Array.from(ordersByRegion, ([region, regionOrders]) => [
    region,
    regionOrders.reduce((sum, order) => sum + sumOrderNetCents(order), 0),
  ]),
);
```

Why this chunked pipeline works:
1. One pipeline step per line lets the reader scan top-to-bottom without horizontal scrolling.
2. Named helpers (`isSettledOrder`, `isNetPositiveItem`, `resolveOrderRegion`, `sumOrderNetCents`) turn the chain into domain prose.
3. Splitting at `settledOrders` and `ordersByRegion` gives debuggers and readers clear intermediate milestones when types shift from `Order[]` to grouped orders and finally to revenue totals.

---

## 2. Twenty Explained Lines Beat 200 Verbose Lines

Do not expand a compact regex, macro, reflection dispatcher, or bitwise algorithm into 200 lines of sprawling state-machine boilerplate only to claim that the code is "self-documenting". Keep the 20 concise lines, isolate them inside one dedicated function or macro, and document **why** this mechanism is used and **how** each part works.

### Example A: Documented Regex Instead of a 180-Line Character Scanner

```ts
/**
 * Compiled parser for RFC-5424-like upstream proxy log lines produced by {@link parseLogFrame}.
 *
 * @remarks
 * A single compiled regex parses 1M lines in ~45ms without allocating intermediate token arrays,
 * whereas a hand-rolled character scanner took 190 lines of state branches.
 *
 * Capture groups:
 * 1. `isoTimestamp` - UTC ISO-8601 timestamp prefix (`YYYY-MM-DDTHH:mm:ssZ`).
 * 2. `level` - Severity tag inside the first brackets (`INFO | WARN | ERROR`).
 * 3. `traceId` - Optional hex identifier from `[trace=<id>]` (`undefined` when absent).
 * 4. `subsystem` - Dotted logger name before `: `.
 * 5. `message` - Remaining line payload.
 *
 * @example
 * Matched input lines:
 * ```text
 * 2026-11-14T09:12:04Z [WARN] [trace=ab12cd] auth.session: token expired
 * 2026-11-14T09:12:05Z [ERROR] db.pool: connection reset
 * ```
 *
 * @see {@link ParsedLogFrame}
 */
const LOG_FRAME_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) \[(INFO|WARN|ERROR)\](?: \[trace=([0-9a-f]+)\])? ([a-z0-9_.]+): (.*)$/;
```

### Example B: Documented Macro / Reflection Boundary

```rust
/// Implements [`FramedCodec`] with 4-byte length-prefix framing and CRC checks for a packet struct.
///
/// Every frame variant shares identical framing logic. Trait dynamic dispatch adds heap boxing on
/// the hot path, and manual implementations repeated 240 lines across 12 packet structs.
///
/// # Expansion
///
/// Calling `impl_framed_codec!(PingFrame, 0x01)` generates:
///
/// ```ignore
/// impl FramedCodec for PingFrame {
///     const OPCODE: u8 = 0x01;
///     fn encode_framed(&self, buf: &mut BytesMut) { /* ... */ }
///     fn decode_framed(payload: &[u8]) -> Result<Self, FrameError> { /* ... */ }
/// }
/// ```
///
/// See [`FrameError`] for framing validation failures.
macro_rules! impl_framed_codec {
    ($frame_ty:ty, $opcode:expr) => {
        // ... 18 lines of framing logic ...
    };
}
```

### Example C: In-Function Rationale Block for External Constraints

Use plain `//` comments inside a function body when explaining procedural failure ordering or external constraints that
are not attached to a declaration:

```go
// Idempotent Lock Acquisition
//
// The payment gateway can deliver duplicate webhook events within a 500ms window.
// A database transaction alone does not block concurrent workers across nodes.
//
// Acquire a short-lived Redis lock before reading ledger state. If lock acquisition
// fails because another worker owns the event key, return HTTP 202 immediately so
// the gateway does not schedule an exponential retry storm.
```

---

## 3. Deletable Concrete Code vs. Premature Abstraction

Design modules so removing or replacing a feature means deleting one file or directory instead of untangling shared layers.

- **Premature coupling (avoid)**: Creating `NotificationTransport`, `NotificationFactory`, `AbstractChannelAdapter`, and a shared `formatPayload(msg, isSlack, isEmail, includeFooter)` helper when the project only sends Slack webhooks today.
- **Deletable concrete module (prefer)**: A single `notifications/slack_webhook.ts` module exposing `sendOpsAlert(alert: OpsAlert): Promise<void>`. If the team switches from Slack to Discord next quarter, an engineer can replace one 60-line file in 10 minutes. Introduce a shared `AlertChannel` interface only when both Slack and PagerDuty run side by side in production.
