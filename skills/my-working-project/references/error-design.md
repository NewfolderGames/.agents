# Caller-Focused Error Design

Apply these guidelines whenever the target repository does not establish another error-handling convention.

Most weaknesses in error types share one root cause: optimizing for the author who propagates errors at the expense of the caller who must handle them. Treat every error type as a public interface designed for the caller who must handle failures. Before finalizing an error type, ask two questions:

1. Given this error type and its documentation, can a caller write reliable recovery logic?
2. Can a caller translate each failure variant into a clear message that an end user can understand?

This guide adapts the error-design philosophy of Roman Kashitsyn's [*Designing error types in Rust*](https://mmapped.blog/posts/12-rust-error-handling) and updates its Rust idioms for current toolchains (`core::error::Error` and `thiserror` 2.x).

---

## 1. Libraries vs. Applications

Choose the error strategy that matches who consumes the interface:

| Boundary | Primary Caller | Responsibility | Typical Rust Representation |
|---|---|---|---|
| **Libraries and reusable domain modules** | Other code | Recover transparently when safe, and expose a complete, structured set of unrecoverable failure cases. | Narrow domain `enum` (or opaque error struct with a `.kind()` enum) implementing `core::error::Error`. |
| **Applications (CLIs, daemons, services)** | Humans or external operators | Resolve issues automatically when safe, or report the failure and recovery steps clearly to the user. | Dynamic error containers such as `anyhow::Result` or `eyre::Result` with operation context attached at call sites. |

Do not leak application-style dynamic error containers (`anyhow::Error`) into public library signatures. Conversely, do not force boilerplate error enums at top-level binary boundaries where every failure only logs and exits.

---

## 2. Six Core Design Goals

### 2.1 Prefer Specific Error Types Over Catch-All or Global Enums

Opaque error containers (`anyhow::Result`) and giant project-wide enums (`ProjectWideError`) make *propagating* errors easy, but they make *handling* errors hard because callers cannot tell which variants a given function can actually return.

Define a dedicated, narrow error type for each fallible operation or cohesive module boundary. Expressing exact failure modes in the type system takes less effort than documenting interface quirks in prose, and it turns unit tests into direct equality assertions.

```rust
// Avoid: forces callers to guess which variants apply to this operation.
pub enum ProjectWideError {
    InvalidInput,
    DatabaseConnectionError,
    Unauthorized,
    FileNotFound,
}

// Prefer: names the exact failure modes of this operation.
#[derive(thiserror::Error, Debug, PartialEq, Eq)]
pub enum FrobnicateError {
    /// Input exceeded the supported upper bound.
    #[error("input exceeded maximum allowed value {0}")]
    InputExceeds(u64),

    /// Operation is disabled on Mondays by policy.
    #[error("cannot frobnicate on Mondays")]
    CannotFrobnicateOnMondays,
}

pub fn frobnicate(n: u64) -> Result<String, FrobnicateError> {
    /* ... */
}
```

### 2.2 Reserve Panics for Bugs in Your Code

Panics indicate program bugs, violated internal invariants, or broken contracts. Do not panic on invalid external or end-user inputs even if you document the behavior under `# Panics`, because callers frequently miss prose warnings. Express recoverable input failures in the return type (`Result`).

Use `panic!`, `assert!`, and `debug_assert!` for:
- Internal invariants and post-conditions (`debug_assert!(tree.is_balanced())`)
- Severe caller bugs that violate structural preconditions, such as out-of-bounds indexing or broken trait laws (for example, an `Ord` implementation that violates total ordering)

### 2.3 Lift Input Validation into Boundary Types ("Parse, Don't Validate")

Functions that return `Result` prevent panics on invalid inputs. Functions that accept already-validated types remove repeated runtime validation and drop validation error variants from their error enums.

Parse raw strings or numbers once at the system boundary into validated domain newtypes (implementing `FromStr` or `TryFrom`). Downstream functions accept the validated type, remove duplicated validation code, and let callers surface format errors early where input enters the program.

```rust
pub struct EmailAddress(String);

impl core::str::FromStr for EmailAddress {
    type Err = MalformedEmailAddress;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        /* validate once at the boundary */
    }
}

#[derive(thiserror::Error, Debug)]
pub enum SendMailError {
    // No MalformedAddress variant is needed here.
    #[error("failed to connect to mail server {host}: {reason}")]
    ConnectionFailed {
        host: String,
        reason: String,
        #[source]
        cause: Option<std::io::Error>,
    },
}

pub fn send_mail(
    to: &EmailAddress,
    cc: &[&EmailAddress],
    body: &str,
) -> Result<(), SendMailError> {
    /* ... */
}
```

### 2.4 Implement the Standard Error Trait (`core::error::Error`)

Always implement `core::error::Error` (or `std::error::Error` on toolchains older than Rust 1.81) on public error types, even when your own callers match on concrete variants. Downstream callers building small CLIs or integration glue frequently convert library errors into `Box<dyn core::error::Error>`, `anyhow::Result`, or `eyre::Result`. Implementing the standard trait keeps your library compatible with standard error ecosystems.

Use `thiserror` 2.x to derive `core::error::Error` and `Display` without boilerplate in both `std` and `no_std` crates.

### 2.5 Define Errors in Terms of the Problem Domain, Not the Solution

Wrapping every transitive dependency error directly leaks internal implementation details into the public API (for example, `IoError(std::io::Error)`, `HttpError(http2::Error)`, `SerdeError(serde_cbor::Error)`, or `OpensslError(openssl::ssl::Error)`):

1. Low-level errors propagate up the stack with almost zero operational context (for example, `No such file or directory` without naming the missing path or action).
2. Callers must read third-party dependency documentation to design recovery logic.
3. Callers must depend on your internal crates directly, so swapping `openssl` for `rustls` or `serde_cbor` for `ciborium` breaks downstream code.

Model variants around domain failures so callers can pick concrete recovery actions, and replace ambiguous `Result<Option<T>, E>` signatures with an explicit `NotFound` variant when absence is a failure mode.

```rust
#[derive(thiserror::Error, Debug)]
pub enum FetchTxError {
    /// Failed to establish a network connection to the peer.
    #[error("failed to connect to {url}: {reason}")]
    ConnectionFailed {
        url: String,
        reason: String,
        #[source]
        cause: Option<std::io::Error>,
    },

    /// No transaction exists for the requested identifier.
    #[error("transaction {0} was not found")]
    TxNotFound(Txid),

    /// Payload bytes could not be decoded as a valid transaction.
    #[error("invalid transaction encoding at offset {error_offset:?}: {error_message}")]
    InvalidEncoding {
        error_offset: Option<usize>,
        error_message: String,
    },

    /// Caller supplied a malformed public key.
    #[error("malformed public key: {reason}")]
    MalformedPublicKey { reason: String },

    /// Peer returned a transaction whose signature did not match the public key.
    #[error("signature verification failed for transaction {txid}")]
    SignatureVerificationFailed { txid: Txid },
}
```

With domain variants, a caller can distinguish a user mistake (on `MalformedPublicKey`, prompt the user for a valid key) from a faulty peer (on `SignatureVerificationFailed`, retry another peer).

### 2.6 Embed Error Cases Instead of Wrapping Third-Party Errors

When one interface delegates to multiple backends such as ECDSA and BLS signature verifiers, wrapping each backend error separately introduces three defects (for example, `EcdsaError(ecdsa::Error)` and `BlsError(bls12_381_sign::Error)`):

1. The type system does not prevent returning `BlsError` when the caller requested `Algorithm::Ecdsa`.
2. Backend crate types leak into the public API.
3. Adding a third algorithm forces callers to update every `match` expression.

Remove that nesting layer by embedding and deduplicating shared failure modes (`MalformedPublicKey`, `MalformedSignature`, `SignatureVerificationFailed { algorithm, reason }`) directly in your error enum.

Two pragmatic exceptions justify wrapping or stringifying a lower-level error:

1. **Wrapping `std::io::Error` with context**: `std::io::Error` adds zero external dependencies, is familiar to Rust engineers, and preserves `raw_os_error()` codes for low-level diagnostics. Pair it with the attempted operation and relevant path or endpoint.
2. **Attaching a formatted detail string**: Converting an internal third-party error to a `String` field inside a specific domain variant is acceptable when callers do not need to match on the internal crate's sub-variants. Verify that formatted strings never include secrets, private keys, tokens, or personal data such as email addresses.

Weigh `Box<dyn core::error::Error>` carefully before using it as an escape hatch:
- If callers need structured data from the failure, embed the relevant fields or add a dedicated variant instead of forcing downcasts.
- Downcasting breaks silently whenever the caller and the library link against different semver-incompatible versions of the same transitive crate.
- Trait-object fields prevent deriving `Clone`, `PartialEq`, and `Serialize`, which blocks sending errors across process or RPC boundaries.

---

## 3. Modern Rust Refinements (2024 to 2026)

Kashitsyn's 2022 design goals still hold, and recent Rust releases add four practical refinements:

1. **Target `core::error::Error` and `thiserror` 2.x**: Rust 1.81 stabilized `core::error::Error`, so `#![no_std]` libraries can implement the standard error trait without `#[cfg(feature = "std")]` gates. Prefer `thiserror` 2.x over manual `Display` and `Error` implementations.
2. **Preserve `Error::source()` on deliberate causes**: Mark owned or standard wrapped causes (such as `std::io::Error`) with `#[source]` so structured loggers and diagnostic libraries (`anyhow`, `eyre`, `miette`) can traverse the cause chain without exposing third-party types in public match arms.
3. **Keep `Result<T, E>` stack size small**: Embedding rich structs directly in enum variants can bloat `size_of::<Result<T, E>>()` on the success path. When `clippy::result_large_err` warns on hot paths, box the large variant payload (`Box<InvalidEncodingDetail>`) instead of erasing the error type into `Box<dyn Error>`.
4. **Choose semver evolution semantics intentionally**: For libraries published to external callers, decide whether callers must match exhaustively (plain public `enum`) or stay source-compatible when new failure modes appear (`#[non_exhaustive]` on the enum, or an opaque error struct exposing a `.kind()` enum similar to `std::io::Error`).

---

## 4. Cross-Language Application

The same caller-focused philosophy applies outside Rust when a project defines no stricter local pattern:

| Language | Library Error Shape | Boundary Validation | Panic / Crash Boundary |
|---|---|---|---|
| **Rust** | Narrow domain `enum` + `core::error::Error` (`thiserror` 2.x) | Validated newtypes (`FromStr`, `TryFrom`) | `panic!` / `debug_assert!` for bugs and violated invariants only |
| **TypeScript** | Discriminated union result types (`{ ok: false, kind: "..." }`) or domain `Error` subclasses | Parse untrusted payloads at I/O boundaries into narrow branded or validated types | Throw uncaught assertions only on unreachable programmer bugs (`satisfies never`) |
| **Go** | Typed domain errors or sentinel errors checked with `errors.Is` / `errors.As`, wrapping causes with `fmt.Errorf("action %s: %w", id, err)` | Validate and normalize inputs at package or transport entry points | Reserve `panic` for unrecoverable startup or invariant bugs, never user input |
| **Java** | Sealed error interfaces (`sealed interface ... permits ...`) or narrow domain exception hierarchies | Value `record` constructors enforcing non-null and format invariants | Reserve unchecked `AssertionError` / `IllegalStateException` for broken internal invariants |

---

## 5. Sources

- Roman Kashitsyn (2022). [*Designing error types in Rust*](https://mmapped.blog/posts/12-rust-error-handling).
- The Rust Standard Library. [*When to use `panic!` vs `Result`*](https://doc.rust-lang.org/std/macro.panic.html#when-to-use-panic-vs-result).
- Alexis King (2019). [*Parse, don't validate*](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).
