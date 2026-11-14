---
name: my-writing-docs
description: >-
  Write clear, unambiguous technical documentation, code comments, TODO markers, docblocks,
  API specs, READMEs, runbooks, changelogs, commit bodies, error messages, and postmortems
  while respecting project conventions first. Activate this skill whenever drafting or editing
  repository documentation or technical prose.
---

# Practical Software Technical Writing (Mode 2)

Write technical documentation and code comments that engineers and AI agents parse on the first read without ambiguity, filler, or robotic unnaturalness.

## 1. Project Voice and Style Precedence

Always inspect the target project's existing documentation before applying default formatting rules:
1. **Local style wins**: Follow the project's `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CONTRIBUTING.md`, ADR templates, and existing docstring style first.
2. **Match repository language**: Write in the established language of the codebase. In Korean repositories, write comments and documentation in a clear declarative written style (문어체 서술형 사용, 명령조 금지) unless the project uses another convention.
3. **Exclude creative copy**: Never apply controlled technical-writing constraints to marketing pages, release blog posts, or brand copy where voice and persuasion are the goal.

When the target project defines no house style (or when writing specifications, runbooks, error messages, commit bodies, and rationale comments), apply the Practical Software STE rules in Sections 2 through 6.

---

## 2. Separate Instructions from Explanations

Decide whether a passage directs an action (**Procedural**) or explains how/why something works (**Descriptive**). Keep instructions and background explanations in separate paragraphs or blocks so readers never miss a required step inside a wall of prose.

| Dimension | Procedural Text (Runbooks, Setup Steps, `TODO`s) | Descriptive Text (Architecture, Rationale Comments, Specs) |
|---|---|---|
| **Purpose** | Tells the reader or agent what action to take | Explains *why*, *how*, constraints, invariants, or system state |
| **Verb Form** | Imperative (`Run the migration.`) | Simple present, simple past, or simple future |
| **Target Length** | Aim for **20 words or fewer** per step; 1 action per step | Aim for **25 words or fewer** per sentence; 1 topic and at most 6 sentences per paragraph |
| **Conditions** | Put the trigger **before** the command (`If the build fails, inspect the log.`) | Use explicit logical connectors (`Because`, `As a result`, `Otherwise`) |

---

## 3. Clear Sentence Structure and Modals

1. **Active voice**: Name the actor (`The worker drops duplicate events.`). Use passive voice only when the actor is unknown or irrelevant.
2. **Direct verbs over nominalizations**: Write `validate the payload` and `compress the archive`, not `perform a validation of the payload` or `do file compression`. Normal software verbs (`test`, `check`, `run`, `render`, `display`, `insert`, `avoid`, `deploy`) are natural and encouraged.
3. **Short noun clusters**: Keep stacked nouns to **3 words or fewer** (`connection pool timeout`, or `the timeout for the connection pool`, rather than `the database connection pool timeout configuration parameter`).
4. **Explicit pronouns and complete grammar**: Follow `this` or `these` with a noun (`this lock`, `these headers`) so the referent is never ambiguous. Avoid contractions (`do not`, `cannot`, `it is`) in formal docs, specs, and comments.
5. **Clean punctuation**: Avoid semicolons (`;`) and clause-joining em-dashes in technical prose. Split run-on clauses into separate sentences or use explicit conjunctions (`because`, `but`). Introduce 3 or more parallel items or steps with a colon (`:`) and a vertical list.
6. **Untouchable literals**: Never alter code snippets, backtick identifiers, CLI flags, file paths, URLs, quoted log strings, SQL keywords, or configuration keys to satisfy prose rules.
7. **Clear modals vs. honest uncertainty**:
   - In **specifications, rules, and procedures**, use `must` (requirement), `can` (capability/permission), and `will` (deterministic behavior). Replace weak `should` requirements with `must`, or state the concrete trade-off as a fact.
   - In **debugging notes, incident postmortems, and root-cause analysis**, never upgrade an unverified hypothesis into a false fact. State what is confirmed and explicitly label what remains unverified.
8. **Risk callouts**: Place `WARNING:` (security breach or catastrophic irreversible harm) and `CAUTION:` (data loss, downtime, or lock contention) immediately before the risky step. Put the command or prohibition first and the specific consequence second.

---

## 4. Documenting Dense Code (*Why* + *How*)

Twenty lines of well-explained regex, macro logic, reflection, or compact algorithm are easier to maintain than 200 lines of sprawling boilerplate when the prose removes all mystery:
1. **State *Why***: Explain the constraint, performance metric, or boilerplate eliminated, plus why a naive alternative falls short.
2. **State *How***: Walk through capture groups, bit fields, state transitions, macro output, or reflection contracts in plain bullets.
3. **Show one concrete example**: Include a realistic sample input and expected output (or macro expansion sketch) right in the comment block so the next developer can modify it safely in seconds.

---

## 5. Terminology Consistency and Anti-Slop Discipline

1. **One concept, one word per document**: Do not rotate synonyms (`config` / `settings` / `options`, or `user` / `client` / `caller`) for the same thing inside one file. Match whatever term the codebase types already use.
2. **Eliminate AI rhetorical habits**:
   - No inflated significance (`vital`, `pivotal`, `a testament`)
   - No negative parallelisms (`not just X, it is Y`)
   - No decorative adjective triplets or throat-clearing (`it is worth noting that`, `crucially`)
   - No vague claims (`gracefully handles`, `blazingly fast`, `robust`). State exact retry counts, timeouts, or benchmarks instead.
   - Spell out `for example` and `that is` instead of `e.g.`, `i.e.`, and trailing `etc.`

---

## 6. Quick Pre-Delivery Check

Before finishing documentation or comments, scan for:
- [ ] **Project fit**: Matches the repository's existing doc conventions, terminology, and language.
- [ ] **Actionable flow**: Conditions appear before commands, steps contain one action each, and risky commands carry `WARNING:` or `CAUTION:` callouts.
- [ ] **High signal**: Comments explain *why* and *how* (especially on dense regexes, macros, reflection, or external quirks) without restating obvious code syntax.
- [ ] **Zero slop or ambiguity**: Free of AI filler words, Latin abbreviations (`e.g.`, `i.e.`, `etc.`), run-on semicolons/em-dashes, and bare `this` pronouns.

---

## 7. Reference Tables and Templates

- [references/slop-substitutions.md](references/slop-substitutions.md): Full 50-row AI slop substitution table and practical software precision swaps.
- [references/domain-templates.md](references/domain-templates.md): Copy-ready patterns for dense-code *why/how* blocks, error messages, `TODO`s, runbooks, postmortems, and commit bodies.
