# Native Language Doc Comments

Apply these defaults whenever the target repository does not establish its own doc-comment format, docstring style, or
linter rules.

## 1. Why Native Doc Comments Over Plain Comments

Attach documentation for modules, exported or public symbols, domain types, constants, macros, and non-obvious internal
helpers using the host language's native doc-comment syntax instead of detached plain comments (`//` or `#`). Native doc
comments provide concrete advantages over plain comments:

1. **Call-site hover previews**: IDEs render the summary, parameter units, valid ranges, and error contracts inline
   whenever a caller inspects a symbol.
2. **One-click symbol navigation**: Native links take callers directly to related types, error enums, companion
   functions, and specifications instead of forcing manual text searches.
3. **Compiler and tool checks**: Doc generators, type checkers, and test runners catch broken symbol links, missing
   parameters, and outdated examples during builds.

Reserve plain comments (`//` or `#`) for in-function phase headers and local inline rationale blocks that are not
attached to a declaration.

---

## 2. What Context to Document (High Signal, Zero Boilerplate)

1. **Summary line first**: Open with one concise sentence stating intent or observable effect because IDEs display the
   first line in completion lists.
2. **Information that static types omit**: Document units (`ms`, `cents`, `bytes`), valid bounds, ordering, idempotency,
   side effects, concurrency or locking rules, ownership or mutation semantics, and external protocol constraints.
3. **Cross-references and clickable symbol links**: Link to related types, error enums, companion functions, and
   specifications using each language's native link syntax.
4. **Failure and edge-case contracts**: Document error variants, thrown exceptions, panic conditions, safety invariants,
   and empty or null input behavior.
5. **Concrete usage examples**: Add a short call-site example for boundary APIs, builders, macros, or dense mechanisms.
   Prefer compile-checked or test-checked formats (such as Rustdoc doctests, Go `Example*` tests, or Python doctests)
   where supported.
6. **Zero restating boilerplate**: Never write empty tags that repeat the identifier or static type (such as
   `@param id - The id` or `@returns The result`). Omit parameter and return types inside doc tags in statically typed
   languages (TypeScript, Rust, Java, Kotlin, Go, C#) unless a project linter requires them. Include types in untyped
   code (plain JavaScript, unannotated Python, untyped PHP). When a project linter requires every parameter to carry a
   tag, write a concise description with domain meaning instead of filler.

---

## 3. Language Feature Matrix

| Language / Format                           | Delimiters                                              | Structured Tags and Sections                                                                                                                                                                                          | Symbol Linking                                                                              | Examples and Checks                                                                               |
|---------------------------------------------|---------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| **TypeScript / JavaScript** (TSDoc / JSDoc) | `/** ... */`                                            | `@param name - ...` (omit `{Type}` in TS, include `{Type}` in plain JS), `@returns`, `@throws`, `@template`, `@defaultValue` / `@default`, `@deprecated`, `@remarks`, `@example`, `@see`, `@module` / `@fileoverview` | `{@link Symbol}` and `{@link Symbol \| label}`                                              | Fenced blocks inside `@example`, checked by `tsc`, `eslint`, or `typedoc`                         |
| **Rust** (Rustdoc)                          | `///` on items, `//!` on modules and crates             | Markdown headings `# Errors`, `# Panics`, `# Safety`, `# Examples`, optional `#[doc(alias = "...")]`                                                                                                                  | `` [`Type::method`] `` and `` [`MyError::Variant`] ``                                       | Code fences under `# Examples`, compiled and run by `cargo test --doc`                            |
| **Java** (Javadoc)                          | `/** ... */` and `package-info.java`                    | `@param`, `@return`, `@throws`, `@see`, `@since`, `@deprecated`, `@apiNote`, `@implSpec`, inline `{@code ...}` and `{@literal ...}`                                                                                   | `{@link Class#method}` and `{@linkplain ...}`                                               | `{@snippet ...}` on JDK 18+, `<pre>{@code ...}</pre>` on older JDKs                               |
| **Kotlin** (KDoc)                           | `/** ... */`                                            | `@param`, `@property`, `@return`, `@throws`, `@receiver`, `@constructor`, `@sample`, `@see`                                                                                                                           | `[Symbol]` and `[Class.method]`                                                             | Fenced Markdown code blocks or `@sample` function references                                      |
| **Go** (Go doc comments)                    | `// SymbolName ...` and `// Package name ...`           | Single-line section headings separated by blank comment lines                                                                                                                                                         | `[Symbol]` and `[pkg.Symbol]` on Go 1.19+                                                   | Indented code blocks, plus runnable `Example*` functions in `*_test.go`                           |
| **Python** (Docstrings)                     | `"""..."""` (default to Google style when unconfigured) | `Args:`, `Returns:`, `Yields:`, `Raises:`, `Attributes:`, `Note:`, `Examples:`                                                                                                                                        | Sphinx roles (`:class:`, `:func:`, `:exc:`) or backtick symbol names in MkDocs/mkdocstrings | `>>>` doctest blocks under `Examples:`, run by `python3 -m doctest` or `pytest --doctest-modules` |
| **C#** (XML doc comments)                   | `///`                                                   | `<summary>`, `<param name="...">`, `<typeparam name="...">`, `<returns>`, `<exception cref="...">`, `<remarks>`                                                                                                       | `<see cref="..."/>`, `<seealso cref="..."/>`, `<paramref name="..."/>`                      | `<example><code>...</code></example>`                                                             |
| **PHP** (PHPDoc)                            | `/** ... */`                                            | `@param`, `@return`, `@throws`, `@template`, `@deprecated`, `@see`, plus `@phpstan-*` or `@psalm-*` when configured                                                                                                   | `{@see Class::method()}`                                                                    | Inline examples or `@example` tags checked by static analysis                                     |

---

## 4. Worked Examples

### TypeScript (TSDoc / JSDoc)

```ts
/**
 * Charges an open invoice once against the customer's default payment method.
 *
 * @remarks
 * Uses {@link idempotencyKey} to deduplicate gateway retries within a 24-hour window.
 *
 * @param invoiceId - Target invoice identifier in open status.
 * @param amountCents - Positive integer amount in minor currency units (`amountCents > 0`).
 * @param idempotencyKey - Caller-supplied UUIDv4 reused across retries of the same charge.
 * @returns Settled charge receipt containing the gateway transaction identifier.
 * @throws {@link InvalidChargeAmountError} when `amountCents` is not a positive integer.
 * @throws {@link PaymentGatewayError} when the upstream processor rejects or times out.
 *
 * @example
 * ```ts
 * const receipt = await chargeInvoice("inv_01J", 4900, retryKey);
 * ```
 *
 * @see {@link refundCharge} for partial or full reversals.
 */
export async function chargeInvoice(
  invoiceId: string,
  amountCents: number,
  idempotencyKey: string,
): Promise<ChargeReceipt> {
  // ...
}
```

### Rust (Rustdoc)

```rust
/// Acquires an exclusive distributed lease for `resource_key` with a bounded TTL.
///
/// The returned [`LeaseGuard`] releases the lock on drop when the process exits normally.
///
/// # Errors
///
/// Returns [`LeaseError::AlreadyHeld`] when another worker owns `resource_key`.
/// Returns [`LeaseError::BackendUnavailable`] when the lock store does not respond within `ttl`.
///
/// # Panics
///
/// Panics when `ttl` is zero because a zero-duration lease cannot prevent concurrent writes.
///
/// # Examples
///
/// ```
/// # use my_crate::{acquire_lease, LeaseError};
/// # use core::time::Duration;
/// let guard = acquire_lease("ledger:close:2026-11", Duration::from_secs(30))?;
/// # Ok::<(), LeaseError>(())
/// ```
pub fn acquire_lease(resource_key: &str, ttl: Duration) -> Result<LeaseGuard, LeaseError> {
    assert!(!ttl.is_zero(), "lease ttl must be non-zero");
    // ...
}
```

### Java (Javadoc)

Note: Use `<pre>{@code ...}</pre>` instead of `{@snippet ...}` when targeting toolchains older than JDK 18.

```java
/**
 * Schedules the next retry attempt for a failed webhook delivery using capped exponential backoff.
 *
 * <p>Backoff doubles from {@code baseDelayMs} on each attempt and clamps at {@link #MAX_DELAY_MS}
 * to prevent retry storms after downstream recovery.
 *
 * @param deliveryId unique identifier of the pending {@link WebhookDelivery}
 * @param attempt zero-based failure count ({@code attempt >= 0})
 * @param baseDelayMs initial backoff delay in milliseconds ({@code baseDelayMs > 0})
 * @return scheduled UTC timestamp for the next delivery attempt
 * @throws IllegalArgumentException when {@code attempt < 0} or {@code baseDelayMs <= 0}
 * @throws DeliveryExhaustedException when {@code attempt} reaches {@link #MAX_ATTEMPTS}
 * @see WebhookDispatcher#dispatch(WebhookDelivery)
 *
 * {@snippet :
 * Instant nextRun = scheduler.scheduleRetry(delivery.id(), 2, 250L);
 * }
 */
public Instant scheduleRetry(String deliveryId, int attempt, long baseDelayMs) {
    // ...
}
```

### Go (Go doc comment)

```go
// AcquireEventLock claims a short-lived lock for eventID before ledger state transitions.
//
// If another worker holds the lock, AcquireEventLock returns [ErrLockHeld] immediately
// so callers can acknowledge the webhook without triggering gateway retries.
//
// Concurrency
//
// Callers must invoke Release on the returned [RedisLock] after committing or aborting
// the database transaction.
func AcquireEventLock(ctx context.Context, eventID string, ttl time.Duration) (*RedisLock, error) {
	// ...
}
```

### Python (Google-Style Docstring)

```python
def parse_retry_window(raw: str, *, max_seconds: int = 300) -> int:
    """Parse a positive duration suffix string into clamped whole seconds.

    Accepts integer values with `s` or `m` suffixes and enforces the upper bound
    so operator configuration typos cannot stall background workers.

    Args:
        raw: Duration token formatted as `<int>s` or `<int>m`.
        max_seconds: Upper inclusive cap in seconds (`max_seconds >= 1`).

    Returns:
        Duration in whole seconds, clamped to `max_seconds`.

    Raises:
        ValueError: When `raw` lacks a valid integer or uses an unsupported unit.

    Examples:
        >>> parse_retry_window("45s")
        45
        >>> parse_retry_window("10m", max_seconds=300)
        300
    """
    # ...
```

---

## 5. Link and Example Hygiene

1. **Validate links and doctests**: Run the repository's configured doc or lint commands when present (`tsc`, `eslint`,
   `typedoc`, `cargo doc --no-deps`, `cargo test --doc`, `javadoc`, `go doc`, `python3 -m doctest`) so broken symbol
   links and stale examples fail early.
2. **Keep docblocks synchronized with code edits**: Update or delete `@param`, `@throws`, `# Errors`, and symbol links
   in the same edit whenever signatures, error types, or invariants change.
