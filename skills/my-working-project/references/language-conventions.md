# Language-Specific Conventions (Defaults When Unspecified by Project)

Apply these conventions only when the target project's `AGENTS.md`, `CLAUDE.md`, `README.md`, linter configuration, or surrounding files do not establish another style.

## 1. TypeScript

1. **Contracts and shapes**: Prefer `interface` for object shapes and public contracts. Use `type` for unions, intersections, mapped types, and primitive aliases.
2. **State modeling**: Model multi-state lifecycles (`idle`, `loading`, `ready`, `failed`) as discriminated unions with an explicit tag field (`status` or `kind`) rather than optional fields and boolean combinations.
3. **Functional pipelines**: Break `.filter()`, `.map()`, and `.flatMap()` chains across one line per stage. Extract non-trivial inline callbacks into named functions (`isBillableItem`, `toLineSummary`) or split long pipelines at domain boundaries.
4. **Type narrowing**: Prefer explicit type guards and exhaustive `switch` checks (`satisfies never` in the default branch) over `as` type assertions. When a type assertion is unavoidable, add a brief comment stating the invariant that guarantees safety.

## 2. React

1. **Component boundaries**: Keep one primary component per file. Extract a subcomponent when a JSX subtree owns independent state or obscures the parent layout, without splitting tiny markup fragments prematurely.
2. **Declarations and props**: Declare components with `function` declarations and an explicit `Props` interface unless neighboring components standardize on another form.
3. **Memoization discipline**: Follow the repository's React version and compiler setup. Where React Compiler is not enabled, wrap callbacks passed to memoized children or effect dependencies in `useCallback`, and wrap expensive derived computations in `useMemo`.
4. **Styling hooks**: Prefer data attributes (`data-state`, `data-active`) or CSS variables over nested template-literal class concatenation, unless the project standardizes on a utility helper such as `clsx` or `cn`.
5. **Shared UI primitives**: Reuse existing design-system primitives before building one-off buttons, dialogs, or inputs.

## 3. Go

1. **Guard-clause error handling**: Check errors immediately (`if err != nil { return ... }`) and wrap errors with context (`fmt.Errorf("load account %s: %w", id, err)`). Never follow a terminating `return` with `else`.
2. **Concrete types first**: Define interfaces on the consumer side only when multiple implementations or test seams are genuinely required. Return concrete structs from constructors.
3. **Boundary validation**: Trim whitespace and validate non-empty identifiers at package or transport boundaries before persistence calls.
4. **Doc comments**: Start package comments and exported symbol comments with the exact symbol name (`// ParseToken validates...`).

## 4. Rust

1. **Domain modeling**: Model mutually exclusive states and typed errors with `enum` variants. Use newtypes (`struct AccountId(String)`) when mixing raw primitives risks argument-order bugs.
2. **Iterator pipelines**: Format multi-step iterator chains (`.iter().filter(...).map(...).collect()`) one adapter per line. When closures grow past two lines or borrow lifetimes get noisy, split the chain into named bindings or use a plain `for` loop with `continue`.
3. **Macros and `unsafe`**: Procedural or declarative macros (`macro_rules!`) are encouraged when they eliminate repetitive boilerplate across types. Pair every non-trivial macro with a doc comment showing a concrete expansion sketch, and precede every `unsafe` block with a `// SAFETY:` comment proving the invariant.
4. **API naming and docs**: Follow Rust API Guidelines (`as_*` free borrow view, `to_*` allocating/computing conversion, `into_*` ownership transfer, no `get_` prefix on plain getters). Include `# Errors`, `# Panics`, `# Safety`, and `# Examples` sections on public items whenever those conditions apply.

## 5. Java

1. **Records and immutability**: Prefer `record` types and sealed interfaces (`sealed interface ... permits ...`) for immutable domain data and algebraic state modeling on modern JDKs. Follow standard `get*`/`is*` conventions on traditional classes and beans.
2. **Null safety and guard clauses**: Enforce non-null invariants at constructor and public method entry points (`Objects.requireNonNull`) or via the project's nullness annotations (`@NonNull`, `@Nullable`). Keep method bodies flat with early returns.
3. **Stream pipelines**: Format `Stream` pipelines one operation per line using method references (`Order::isPaid`) or named helper methods rather than multi-line inline lambdas.
4. **Reflection and annotations**: When framework integration, serialization, or code generation relies on reflection or custom annotations, document the runtime lookup contract, target retention rules, and failure modes directly on the entry point.
