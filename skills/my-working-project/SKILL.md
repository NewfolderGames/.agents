---
name: my-working-project
description: >-
  Design, write, refactor, untangle, and document human-readable, easily removable code
  while respecting project-local conventions. Activate this skill when writing or reviewing
  code, structuring modules, chunking functional pipelines, documenting regexes, macros, or
  reflection, curating tests, or untangling coupled codebases.
---

# Code Architecture, Readable Clarity, and Deletable Design

Write direct, maintainable code with low cognitive overhead so the human developer can read it on one pass, continue working on it without friction, and replace or delete any part cleanly.

## 1. Project Conventions Always Come First

Before you choose patterns, folder layouts, naming styles, or comment formats, check the target project:
1. **Project guides and configs win**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CONTRIBUTING.md`, `.editorconfig`, and linter/formatter configs (`eslint`, `biome`, `rustfmt`, `checkstyle`, `golangci-lint`) override every default in this skill.
2. **Blend into neighboring code**: Read 2 to 3 adjacent files in the same package before writing new code. Match existing directory conventions, error types, state management, and testing patterns so your changes look written by the project maintainer unless you were asked to refactor them.

---

## 2. Core Engineering Philosophy

### 2.1 Nothing Left to Remove (Deletable Architecture)

1. **Optimize for easy replacement and removal**: Structure features so replacing or deleting a feature means deleting one file or directory, not doing surgery across eight shared layers.
2. **Avoid "lasagna" indirection**: Do not stack pass-through controllers, services, managers, adapters, and factories that just forward arguments unchanged. Trace inputs -> domain logic -> side effects cleanly without jumping across five files.
3. **Earn every abstraction**: Duplicate a short, clear 5-to-10 line snippet across two callers rather than coupling unrelated workflows through a premature shared helper with boolean mode flags. Extract an interface or shared module only when multiple real callers or implementations share a true domain contract today.
4. **Redesign cleanly when requirements shift**: When early assumptions no longer hold, reshape the module directly for today's requirements rather than taping special-case flags onto brittle code.

### 2.2 Twenty Explained Lines Beat 200 Verbose Lines

Simplicity means low reading and maintenance cost, **not** fear of expressive language features:
1. **Do not bloat code into 200 lines of "self-documenting" ceremony**: Complex regexes, declarative/procedural macros, reflection dispatchers, bitwise packing, and compact domain algorithms are welcome whenever they replace hundreds of lines of repetitive boilerplate or hand-rolled state machines.
2. **Isolate and explain *why* + *how***: Encapsulate the dense mechanism behind one clear function, type, or macro boundary, and pair it with a thorough comment block explaining:
   - **Why** this mechanism is used (for example, eliminating 200 lines of duplicate packet decoders or avoiding hot-path allocations).
   - **How** it works step by step (capture-group breakdown for a regex, expansion sketch for a macro, lookup contract for reflection) plus concrete input/output examples.
3. **Spend tokens for clarity, never false brevity**: Conversely, never cram ordinary business logic into nested ternaries or cryptic variable names just to save tokens. See [references/examples.md](references/examples.md) for side-by-side patterns.

### 2.3 Functional Pipelines in Readable Chunks

Functional chaining (`.filter().map().flatMap()`, Rust iterators, Java streams) is idiomatic and clear when chunked for human eyes:
1. Format multi-step pipelines with **one stage per line**.
2. Extract non-trivial predicates and transforms into **named functions** (`isSettledInvoice`, `toLedgerRow`) instead of nesting multi-line anonymous lambdas inside `.map(...)`.
3. When a pipeline grows long or changes domain meaning mid-flight, split it into **2 to 3 named milestone variables** (`activeSubscriptions` -> `chargesByAccount`) so types and intent stay obvious at each step.

---

## 3. Vertical Rhythm, Guard Clauses, Naming, and Types

### 3.1 Spacing and Guard Clauses

1. **Vertical breathing room**: Separate variable setup, control-flow blocks (`if`, `for`, `switch`, `match`), discrete procedural phases, and final `return` statements with blank lines so code never reads like a dense wall.
2. **Early guard returns**: Validate inputs, permissions, and error cases at the top of the function and return early. Keep the main success path unindented at the base level, and never write `else` after a terminating `return`, `break`, `continue`, or `throw`.
3. **Run project formatters**: Run the repository's configured formatter and linter after edits (see [references/language-conventions.md](references/language-conventions.md) for language defaults when unconfigured).

### 3.2 Naming and Type Discipline

1. **Intent-revealing names**: Use clear, full identifiers (`invoiceTotalCents`, `retryBudgetMs`, `userRole`). Keep single-letter names only for tiny loop counters (`i`, `j`) or trivial one-expression lambdas.
2. **Positive booleans**: Name booleans affirmatively with auxiliary prefixes (`isEnabled`, `hasValidToken`, `canPublish`, `shouldRetry`) to avoid double negatives (`!isDisabled`).
3. **Standard conversions**: Follow `as_*` (free view/borrow), `to_*` (computed/allocated conversion), and `into_*` (ownership-consuming transform) where idiomatic.
4. **Illegal states unrepresentable**: Replace loose combinations of boolean flags and raw status strings with tagged unions / `enum` variants and exhaustive `switch` / `match` statements.

---

## 4. Co-Change Boundaries and Codebase Untangling

Evaluate module boundaries with one question: **must these pieces change together?** Pieces that change together belong in the same feature folder. Pieces that change for unrelated reasons belong apart, and stable domain modules must not depend on volatile outer adapters.

### 4.1 Four Coupling Smells to Remove

1. **Hidden links**: Duplicated business rules/constants that drift out of sync, implicit global state, or temporal call-order traps not enforced by types.
2. **Needless links**: Leaked internal data layouts, core domain code importing transport/vendor specifics directly, or general functions taking caller-specific flags.
3. **Surplus**: Pass-through wrappers that add zero invariants, speculative interfaces with only one implementation and no test seam need, unused exports, and dead feature flags.
4. **Special-case patches**: Single-caller `if` branches, swallowed errors, arbitrary `sleep` retries, and disabled tests that signal a missing domain concept.

### 4.2 Five-Step Untangling Workflow

When asked to untangle or clean up a messy subsystem:
1. **Confirm scope**: Ask whether to include `Comments` cleanup (deleting stale/restating comments) and `Tests` cleanup (replacing brittle implementation-coupled tests with behavioral tests) alongside the refactor.
2. **Catalog coupling first**: List the hidden links, needless links, surplus wrappers, and special cases before editing files.
3. **Group under structural fixes**: Map multiple symptoms to the single design change that eliminates them cleanly.
4. **Scaffold and migrate incrementally**: Follow `my-working-task` to validate new types/signatures first, migrate callers step by step, and delete dead layers.
5. **Verify behavior and audit**: Update tests last so existing tests catch regressions during migration, then audit with a subagent (`my-using-tools`) until zero dead code or special-case leftovers remain.

---

## 5. Signal-Scaled Comments and Documentation

Activate `my-writing-docs` when drafting comments and documentation so prose stays crisp and unambiguous, while matching the project's primary language (in Korean codebases, use declarative written style: 문어체 서술형 사용, 명령조 금지).

1. **Zero code-restating comments**: Never write comments that repeat what the identifier name or static type already says (`// increment counter`). When you delete a workaround, delete its comment too.
2. **Phase headers in longer functions**: Use short title-case headers (`// Input Validation`, `// Ledger Settlement`) only when a function spans distinct procedural stages.
3. **Deep *why* and *how* blocks where needed**: Invest rich multi-paragraph comments on external protocol quirks, concurrency/lock ordering, non-obvious failure modes, and compact mechanisms (regexes, macros, reflection, bitwise logic).
4. **Scale public docblocks to complexity**:
   - **Simple, obvious functions**: A crisp one-sentence summary is sufficient when parameter names and types already express the full contract (unless project linters require full tags).
   - **Boundary APIs and complex contracts**: Document the summary, non-obvious parameter invariants/ranges, return semantics, error/panic triggers, side effects/idempotency, and a short usage example.

---

## 6. Reference Guides

- [references/language-conventions.md](references/language-conventions.md): Default idioms for TypeScript, React, Go, Rust, and Java when the host project does not define its own rules.
- [references/examples.md](references/examples.md): Worked examples of readable functional chunking, *20 explained lines vs. 200 verbose lines* (regex, macro, and lock rationale blocks), and deletable modules.
