---
name: my-working-project
description: >-
  Design, write, refactor, untangle, and document source code across TypeScript, React,
  Go, Rust, and Java. Activate this skill when writing or reviewing code, designing module
  boundaries, eliminating special cases or coupling, curating regression tests, or writing
  inline semantic comments and public documentation blocks.
---

# Code Architecture, Untangling, Style, and Symbol Documentation

Write deterministic, unindented, single-responsibility code that survives one read without ambiguity.

## 1. Core Engineering Philosophy

1. **Act as a machine**: Write direct, deterministic code. Eliminate metaprogramming tricks and artificial complexity.
2. **Survive one read**: Write code so a tired engineer, non-native reader, or language model understands control flow, edge cases, and side effects on the first read.
3. **Keep It Simple (KISS)**: Write linear success paths. Repeat simple, explicit code instead of creating premature abstractions. Stop only when nothing remains to remove.
4. **Redesign from first principles**: When requirements change or special cases accumulate, redesign the module for current requirements from scratch. Do not stack workarounds or parallel layers onto brittle code.
5. **Colocate by domain**: Give each file one responsibility. Group files by domain feature instead of splitting one feature across distant layer directories.

---

## 2. Vertical Rhythm, Formatting, and Guard Clauses

### 2.1 Blank Line Placement and Formatters

Use vertical whitespace to separate logical steps:
1. Put a blank line after variable declarations and initializations.
2. Put a blank line before and after control flow blocks (`if`, `for`, `switch`, `match`, `return`).
3. Put a blank line between discrete procedural steps inside a function.
4. Put a blank line before every `return` statement, unless `return` is the sole statement in a short block.
5. After every edit, run the connected IDE formatter first, or run the canonical CLI tools:
   - **Rust**: `cargo fmt` (`rustfmt`) and `cargo clippy`
   - **TypeScript / JavaScript**: Project Prettier, ESLint, or Biome
   - **Go**: `gofmt` and `goimports`
   - **Java**: Google Java Format or Checkstyle

### 2.2 Control Flow and Guard Clauses

1. **Validate early**: Validate inputs, preconditions, and error states at the top of the function with early returns.
2. **Keep an unindented happy path**: Keep the primary success path at base indentation. Never put an `else` block after a terminating `return`, `break`, `continue`, or `throw`.

---

## 3. Naming and Type Discipline

1. **State intent explicitly**: Use full, descriptive identifiers (`recordId`, `isWebSocketConnected`, `userRole`). Do not use cryptic abbreviations or single-letter names, except `i` and `j` in short loops or trivial single-line lambdas.
2. **Name booleans positively**: Frame booleans affirmatively (`isEnabled`, `hasPermission`) instead of negatively (`isDisabled`, `isNotValid`) to prevent double negatives (`!isDisabled`).
3. **Prefix boolean identifiers**: Prepend `is`, `has`, `can`, `should`, `will`, `did`, or `was` to boolean variables, fields, and predicate functions (code identifiers are exempt from the Mode 2 modal ban).
4. **Use standard conversion prefixes**:
   - `as_*`: Zero-cost borrowed-to-borrowed view conversion (no allocation).
   - `to_*`: Borrowed-to-owned conversion (allocates or computes a copy).
   - `into_*`: Consumes an owned value and transforms it into a new type.
5. **Replace flag combinations with tagged unions**: Replace multiple booleans or string status fields with explicit `enum` or discriminated union types.
6. **Match exhaustively**: Use exhaustive `switch` or `match` statements so new variants cause compile-time errors at unhandled sites.

---

## 4. Co-Change Architecture, Deep Modules, and Special-Case Elimination

Evaluate every module boundary with one question: **must these pieces change together?** Pieces that change together must live together. Pieces that change for different reasons must stay separate. Stable modules must never import volatile modules.

1. **Eliminate hidden links (pieces that must change together, where code hides the link)**:
   - **Duplicate logic or constants**: Consolidate copies of rules, action lists, and constants into one source of truth.
   - **Shared globals or implicit files**: Pass dependencies explicitly instead of sharing state through globals or side-effect files.
   - **Layer-split features**: Colocate domain logic, handlers, and types that change together in one module directory.
   - **Implicit call order**: Encode required call sequences in the type signature or state machine.
2. **Eliminate needless links (pieces tied together that change for different reasons)**:
   - **Leaked internals**: Hide internal data representations behind module boundaries so callers stay unbroken when internals change.
   - **Inverted dependency direction**: Make volatile implementations depend on stable interfaces. Never import a volatile module into a stable core module.
   - **Caller-specific parameters**: Remove parameters used by only one caller workflow from general-purpose functions.
   - **Shallow modules**: Build deep modules where a small, stable interface hides complex internal logic.
3. **Eliminate surplus (pieces with no independent reason to change)**:
   - **Pass-through wrappers**: Delete wrapper functions and classes that forward calls without adding domain translation or invariants.
   - **Speculative generality**: Delete extension points, interfaces, and configuration keys for nonexistent variations.
   - **Dead code**: Delete unused functions, types, exports, and feature flags immediately.
4. **Treat special cases as missing design requirements**:
   - Flag every single-value `if` branch, caller-specific parameter, swallowed exception, arbitrary retry or `sleep`, and disabled test.
   - Redesign the core abstraction (for example, a unified command interface) so one structural fix removes multiple special cases at once.

---

## 5. Whole-Codebase Untangling and Regression Test Discipline

When you untangle a codebase or subsystem, run these five steps in order:

1. **Ask scope**: Ask the user which optional additions (`Comments`, `Tests`) to include with the structural refactor:
   - **Comments**: Delete comments that restate the code.
   - **Tests**: Delete tests that cannot catch a bug, and rewrite brittle tests that fail without a bug.
2. **Log every problem before you edit**: Inspect the target scope (high-impact modules first) and record all hidden links, needless links, surplus, and special cases.
3. **Redesign from first principles**: Group related problems in the decision log under the single structural fix that resolves them:
   ```markdown
   - Define a `PaymentProvider` interface that Stripe and PayPal both implement:
     - `checkout/submit.ts:9` depends directly on `payments/stripe.ts`.
     - `refunds/refund.ts:22` wraps every Stripe call in `if (order.provider === "paypal")`.
   ```
4. **Scaffold, then migrate**: Activate `my-working-task`. Scaffold the new interfaces and signatures first, validate the import graph, fill bodies incrementally, and delete obsolete special cases.
5. **Audit with subagents until clean**: If the user selected `Tests`, modify tests last so the test suite acts as a regression safety net:
   - Delete tests that repeat the implementation or cannot fail.
   - Rewrite tests tied to internal details so they validate public behavior.
   - Invoke subagents (see `my-using-tools`) to find remaining special cases, hidden links, needless links, and surplus until zero remain.
   - Run the test suite at the end to make sure that public behavior matches the baseline.

---

## 6. Language-Specific Conventions

| Language / Framework | Mandatory Conventions |
|---|---|
| **TypeScript** | Prefer `interface` over `type` for object shapes and public contracts. Model state machines with discriminated unions. |
| **React** | Put one component per file and split large components into subcomponents. Declare components with `function` declarations and an explicit `Props` interface. Wrap child/dependency callbacks in `useCallback` and expensive derived state in `useMemo`. Prefer data attributes (`data-active`, `data-role`) or CSS variables over conditional class-string concatenation. Extract shared UI primitives into the design system. |
| **Go** | Handle errors immediately with guard clauses (`if err != nil { return ... }`). Never put `else` after a terminating `return`. Start package and exported symbol doc comments with the exact exported symbol name. Trim whitespace and validate non-empty string identifiers before persistence calls. |
| **Rust** | Model domain states with tagged `enum` variants. Obey Rust API Guidelines for `as_*`, `to_*`, and `into_*`. Omit `get_` prefixes on getters unless disambiguating calculated properties. Document public items with `# Arguments`, `# Returns`, `# Errors`, `# Panics`, and `# Examples`. |
| **Java** | Obey Bean and Record accessor conventions (`get*`, `is*`). Enforce non-null invariants at constructor and method entry points with `Objects.requireNonNull`. Keep method bodies flat with early guard clauses. Document classes and public methods with Javadoc (`@param`, `@return`, `@throws`). |

---

## 7. Code Comments and Structured Public Documentation

Activate `my-writing-docs` whenever you write comments, docstrings, or repository docs so all text obeys Mode 2 (ASD-STE100).

### 7.1 Inline Comment Discipline and Semantic Section Blocks

1. **Never restate syntax**: Omit comments that change only when code syntax changes (`// sort first so binary search works`). Keep comments that state external facts invisible in code (`// the proxy closes websockets, so poll`). When a refactor removes a workaround, delete the comment for that workaround.
2. **Single-line semantic section headers**: Inside multi-step functions, mark self-explanatory phases with title-case headers:
   ```text
   // Input Validation
   // Data Retrieval
   // State Verification
   // Persistence Operation
   ```
3. **Multi-line semantic manual blocks**: When a phase has non-obvious logic, external constraints, or failure handling, expand the header into a multi-line Mode 2 block separated by empty comment lines. Include any of these four facts that the code alone cannot show:
   - **Design rationale**: Why this structure is required and why simpler alternatives fail.
   - **Failure modes**: How this step can fail (race conditions, lock contention, clock skew, upstream timeouts).
   - **Handling rationale**: Why errors or edge cases must run in this exact sequence.
   - **Non-obvious prerequisites**: Hidden invariants, protocol quirks, or external constraints.

   ```text
   // Idempotent Lock Acquisition
   //
   // The payment gateway can deliver duplicate webhook events within a 500ms window.
   // A standard database transaction does not prevent concurrent processing across worker nodes.
   //
   // This step acquires a distributed Redis lock before the worker reads the ledger state.
   // If the lock acquisition fails, the worker returns HTTP 202 so the gateway does not retry.
   ```

### 7.2 Six-Part Public Documentation Blocks

Every exported or public symbol must carry a Mode 2 documentation block with these six parts:
1. **Summary Line**: One sentence of 25 words or fewer ending with a period, in third-person singular present indicative ("Updates the account status.", "Calculates the tax delta.").
2. **Parameters / Arguments**: Valid input ranges, sanitization rules, and invariant requirements for each parameter.
3. **Returns**: Exact return values for both success and error outcomes.
4. **Errors / Exceptions / Panics**: Every error condition, thrown exception, or panic scenario and its exact trigger.
5. **Behavior, Invariants, and Caveats**: Idempotency guarantees, thread-safety, side effects, and state mutations.
6. **Usage Example**: Concrete call example whenever integration is non-trivial.

### 7.3 Codebase Language and Doc Synchronization

1. **Match repository language**: Write comments and docs in the primary language of the repository. In Korean codebases, use a strict declarative written style (문어체 서술형 사용, 명령조 금지).
2. **Update docs in the same task**: When behavior, configuration keys, CLI flags, or public interfaces change, update `README.md`, `AGENTS.md`, OpenAPI/API specs, schemas, and docstrings in Mode 2 before you close the task.

---

## 8. Pre-Delivery Code and Git Audit Checklist

Before you commit code changes, make sure that every item passes:
- [ ] **Scaffold-first execution**: Interfaces, types, docstrings, and stubs were type-checked before filling bodies incrementally or via subagents.
- [ ] **Co-change and special cases**: Pieces that change together live together, stable modules never import volatile modules, and hidden links, needless links, surplus wrappers, and special cases are removed.
- [ ] **Guard clauses**: Edge cases and errors return early with an unindented happy path.
- [ ] **Vertical rhythm**: Blank lines appear after declarations, around control flow blocks, and before `return` statements.
- [ ] **Naming and types**: Booleans use positive prefixes (`is*`, `has*`, `can*`), conversions use `as_*`/`to_*`/`into_*`, and multi-state flags use enums or tagged unions.
- [ ] **Comments and documentation**: Semantic comment blocks, `TODO`s, 6-part docstrings, `README.md`, `AGENTS.md`, and API specs obey Mode 2 (`my-writing-docs`), with syntax-restating and obsolete comments deleted.
- [ ] **Clean tree and tests**: Formatters, linters, and behavioral tests pass, and all temporary `TODO` markers and stubs are deleted before committing.
