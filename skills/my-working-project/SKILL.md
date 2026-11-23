---
name: my-working-project
description: >-
  Design, write, refactor, untangle, and document human-readable, removable code
  and caller-focused error types while respecting project-local conventions. Activate this
  skill when writing or reviewing code, designing error types, structuring modules, chunking
  functional pipelines, documenting regexes, macros, or reflection, curating tests, or
  untangling coupled codebases.
---

# Code Architecture, Readable Clarity, and Deletable Design

Write direct, maintainable code with low cognitive overhead so the human developer can read it on one pass, continue working on it without friction, and replace or delete any part cleanly.

## 1. Project Conventions Always Come First

Before you choose patterns, folder layouts, naming styles, or comment formats, check the target repository:
1. **Project guides and configs win**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CONTRIBUTING.md`, `.editorconfig`, and linter/formatter configs (`eslint`, `biome`, `rustfmt`, `checkstyle`, `golangci-lint`) override every default in this skill.
2. **Blend into neighboring code**: Read 2 to 3 adjacent files in the same package before writing new code. Match existing directory conventions, error types, state management, and testing patterns so your changes look written by the project maintainer unless you were asked to refactor them.

---

## 2. Core Engineering Philosophy

### 2.1 Nothing Left to Remove (Deletable Architecture)

1. **Optimize for easy replacement and removal**: Structure features so replacing or deleting a feature means deleting one file or directory, not editing code across eight shared layers.
2. **Avoid "lasagna" indirection**: Do not stack pass-through controllers, services, managers, adapters, and factories that only forward arguments unchanged. Trace inputs -> domain logic -> side effects directly without jumping across five files.
3. **Earn every abstraction**: Duplicate a short, clear 5-to-10 line snippet across two callers rather than coupling unrelated workflows through a premature shared helper with boolean mode flags. Extract an interface or shared module only when multiple real callers or implementations share a true domain contract today.
4. **Redesign cleanly when requirements shift**: When early assumptions no longer hold, reshape the module directly for today's requirements rather than adding special-case flags to brittle code.

### 2.2 Twenty Explained Lines Beat 200 Verbose Lines

Simplicity means low reading and maintenance cost, **not** fear of expressive language features:
1. **Do not bloat code into 200 lines of "self-documenting" ceremony**: Complex regexes, declarative/procedural macros, reflection dispatchers, bitwise packing, and compact domain algorithms are welcome whenever they replace hundreds of lines of repetitive boilerplate or hand-rolled state machines.
2. **Isolate and explain *why* + *how***: Encapsulate the dense mechanism behind one clear function, type, or macro boundary, and pair it with a thorough comment block explaining:
   - **Why** this mechanism is used (for example, eliminating 200 lines of duplicate packet decoders or avoiding hot-path allocations).
   - **How** it works step by step (capture-group breakdown for a regex, expansion sketch for a macro, lookup contract for reflection) plus concrete input/output examples.
3. **Spend tokens for clarity, never false brevity**: Conversely, never cram ordinary business logic into nested ternaries or cryptic variable names only to save tokens. See [references/examples.md](references/examples.md) for side-by-side patterns.

### 2.3 Functional Pipelines in Readable Chunks

Functional chaining (`.filter().map().flatMap()`, Rust iterators, Java streams) is idiomatic and clear when chunked for human eyes:
1. Format multi-step pipelines with **one stage per line**.
2. Extract non-trivial predicates and transforms into **named functions** (`isSettledInvoice`, `toLedgerRow`) instead of nesting multi-line anonymous lambdas inside `.map(...)`.
3. When a pipeline grows long or changes domain meaning mid-flight, split it into **2 to 3 named milestone variables** (`activeSubscriptions` -> `chargesByAccount`) so types and intent stay obvious at each step.

---

## 3. Vertical Rhythm, Guard Clauses, Types, and Error Design

### 3.1 Spacing and Guard Clauses

1. **Vertical breathing room**: Separate variable setup, control-flow blocks (`if`, `for`, `switch`, `match`), discrete procedural phases, and final `return` statements with blank lines so code never reads like a dense wall.
2. **Early guard returns**: Validate inputs, permissions, and error cases at the top of the function and return early. Keep the main success path unindented at the base level, and never write `else` after a terminating `return`, `break`, `continue`, or `throw`.
3. **Run project formatters**: Run the target repository's configured formatter and linter after edits (see [references/language-conventions.md](references/language-conventions.md) for language defaults when unconfigured).

### 3.2 Naming and Type Discipline

1. **Intent-revealing names**: Use clear, full identifiers (`invoiceTotalCents`, `retryBudgetMs`, `userRole`). Keep single-letter names only for tiny loop counters (`i`, `j`) or trivial one-expression lambdas.
2. **Positive booleans**: Name booleans affirmatively with auxiliary prefixes (`isEnabled`, `hasValidToken`, `canPublish`, `shouldRetry`) to avoid double negatives (`!isDisabled`).
3. **Standard conversions**: Follow `as_*` (free view/borrow), `to_*` (computed/allocated conversion), and `into_*` (ownership-consuming transform) where idiomatic.
4. **Illegal states unrepresentable**: Replace loose combinations of boolean flags and raw status strings with tagged unions / `enum` variants and exhaustive `switch` / `match` statements.

### 3.3 Error Design for Callers

Design error types for the caller who must handle failures rather than for the author who propagates them (adapted from Roman Kashitsyn, [*Designing error types in Rust*](https://mmapped.blog/posts/12-rust-error-handling)). Read [references/error-design.md](references/error-design.md) for worked Rust (`core::error::Error`, `thiserror` 2.x) and cross-language patterns:

1. **Separate library errors from application errors**: Libraries expose APIs to other code and must return structured, narrow failure types. Applications interact with humans and can use dynamic context containers at top-level boundaries.
2. **Prefer specific operation errors over global enums**: Give each fallible operation or cohesive boundary its own narrow error type listing only the failures that the operation can produce, rather than a catch-all type or project-wide enum.
3. **Reserve panics and assertions for bugs**: Use panics or assertions for internal invariants and severe contract violations, never for invalid external or end-user inputs.
4. **Lift input validation into boundary types**: Parse untrusted primitives once into validated domain types (such as `EmailAddress`) at system boundaries so downstream functions drop repeated validation and validation error variants.
5. **Model errors in problem-domain terms and embed over wrap**: Describe domain failures (`ConnectionFailed`, `TxNotFound`, `SignatureVerificationFailed`) instead of leaking error types from transitive dependencies. Flatten multi-backend errors into shared domain variants, attach operation and path context when wrapping OS I/O errors, and exclude secrets or personal data from formatted error strings.
6. **Implement standard error traits**: Implement the host language's standard error interface or trait so callers can compose, log, and report failures uniformly.

---

## 4. Co-Change Boundaries and Codebase Untangling

Evaluate module boundaries with one question: **must these pieces change together?** Pieces that change together belong in the same feature folder. Pieces that change for unrelated reasons belong apart, and stable domain modules must not depend on volatile outer adapters.

### 4.1 Four Coupling Smells to Remove

1. **Hidden links**: Duplicated business rules/constants that drift out of sync, implicit global state, or temporal call-order traps not enforced by types.
2. **Needless links**: Leaked internal data layouts, core domain code importing transport/vendor specifics directly, or general functions taking caller-specific flags.
3. **Surplus**: Pass-through wrappers that add zero invariants, speculative interfaces with only one implementation and no need for a test seam, unused exports, and dead feature flags.
4. **Special-case patches**: Single-caller `if` branches, ignored errors, arbitrary `sleep` retries, and disabled tests that signal a missing domain concept.

### 4.2 Five-Step Untangling Workflow

When asked to untangle or clean up a messy subsystem:
1. **Confirm scope**: Ask whether to include `Comments` cleanup (deleting stale/restating comments) and `Tests` cleanup (replacing brittle implementation-coupled tests with behavioral tests) alongside the refactor.
2. **Catalog coupling first**: List the hidden links, needless links, surplus wrappers, and special cases before editing files.
3. **Group under structural fixes**: Map multiple symptoms to the single design change that eliminates them cleanly.
4. **Scaffold and migrate incrementally**: Follow `my-working-task` to validate new types/signatures first, migrate callers step by step, and delete dead layers.
5. **Verify behavior and audit**: Update tests last so existing tests catch regressions during migration, then audit with a subagent (`my-using-tools`) until zero dead code or special-case leftovers remain.

### 4.3 Test Curation

Keep test suites fast, readable, and coupled to public behavior rather than private implementation details:
1. **Assert behavior over internal wiring**: Prefer observable outputs, state transitions, and real boundary fakes over mock-heavy assertions that break on safe refactors.
2. **Use table-driven fixtures for boundaries**: Cover normal paths, empty inputs, upper/lower limits, and explicit error variants in compact parameterized cases.
3. **Pair bug fixes with regression tests**: Add a failing test reproducing the defect before or alongside every bug fix so the regression cannot silently return.
4. **Remove dead and permanently disabled tests**: Fix or delete stale, flaky, or permanently skipped tests during refactors instead of leaving commented-out assertions in the suite.

---

## 5. Signal-Scaled Comments and Documentation

Follow `AGENTS.md` Section 3 for short comments, and activate `my-writing-docs` when drafting substantive documentation, boundary API docblocks, Korean documentation (공식 문어체 평서형 사용, 명령조 금지), or dense-code rationale blocks.

1. **Zero code-restating comments**: Never write comments that repeat what the identifier name or static type already says (`// increment counter`). When you delete a workaround, delete its comment too.
2. **Phase headers in longer functions**: Use short title-case headers (`// Input Validation`, `// Ledger Settlement`) only when a function spans distinct procedural stages.
3. **Deep *why* and *how* blocks for non-obvious code**: Write multi-paragraph comments on external protocol quirks, concurrency/lock ordering, non-obvious failure modes, and compact mechanisms (regexes, macros, reflection, bitwise logic).
4. **Scale public docblocks to complexity**:
   - **Simple, obvious functions**: A concise one-sentence summary is sufficient when parameter names and types already express the full contract (unless project linters require full tags).
   - **Boundary APIs and complex contracts**: Document the summary, non-obvious parameter invariants/ranges, return semantics, error/panic triggers, side effects/idempotency, and a short usage example.

---

## 6. Reference Guides and Sources

- [references/error-design.md](references/error-design.md): Goals for caller-focused error design, before/after Rust examples updated for `core::error::Error` and `thiserror` 2.x, semver and stack-size trade-offs, and cross-language mappings.
- [references/language-conventions.md](references/language-conventions.md): Default idioms for TypeScript, React, Go, Rust, and Java when the target repository does not define its own rules.
- [references/examples.md](references/examples.md): Worked examples of readable functional chunking, *20 explained lines vs. 200 verbose lines* (regex, macro, and lock rationale blocks), and deletable modules.
- **Sources**:
  - Roman Kashitsyn (2022). [*Designing error types in Rust*](https://mmapped.blog/posts/12-rust-error-handling).
  - The Rust Standard Library. [*When to use `panic!` vs `Result`*](https://doc.rust-lang.org/std/macro.panic.html#when-to-use-panic-vs-result).
  - Alexis King (2019). [*Parse, don't validate*](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).
