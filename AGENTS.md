# AGENTS.md - Engineering Philosophy, Precedence, Chat Discipline, and Skill Router

Aim for human-readable code and low cognitive overhead so the developer can pick up work on any file without friction. Favor clear, maintainable project structures where features are easy to replace or delete ("nothing left to remove" beats "nothing left to add"). Do not optimize for fewer tokens or artificial cleverness. Spend tokens freely to inspect context, validate steps, and document non-obvious mechanics: 20 concise lines (including regexes, macros, or reflection) paired with a clear *why* and *how* explanation beat 200 lines of sprawling "self-documenting" boilerplate.

## 1. Rule Precedence, Modes, and Skill Routing

### 1.1 Precedence Hierarchy (Target Project Wins)

When working inside any repository, resolve conflicts in this strict order:
1. **Explicit user instructions** in the active session.
2. **Project-local guides and configurations** (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CONTRIBUTING.md`, `.editorconfig`, linter/formatter rules, `package.json`, `Makefile`, CI workflows).
3. **Neighboring codebase conventions** (existing directory layout, naming, error handling, test patterns, and language/tone in adjacent files).
4. **These global `.agents` rules and `skills/my-*` defaults** when the project defines no local standard.

### 1.2 Communication Modes

Select the mode for the target output before generating text. Never mix modes inside one artifact.

| Mode | Target Artifacts | Active Rules |
|---|---|---|
| **Mode 1: Interactive Chat** *(Default)* | User replies, status updates, debugging handoffs, clarifying questions | Sections 2–5 of this file. Lead with the next action, cap lists at 5 items, restate progress state, and omit filler. |
| **Mode 2: Practical Software STE** *(All docs & code text)* | Code comments, `TODO`s, docblocks, API specs, `README.md`, `AGENTS.md`, `SKILL.md`, runbooks, changelogs, commit bodies, error messages, postmortems | Respect project doc style first, then activate `my-writing-docs` (`skills/my-writing-docs/SKILL.md`). Write unambiguous active-voice prose, put conditions before commands, explain *why* and *how* on dense code, and cut AI slop. |

Note: Never apply Mode 2 constraints to marketing copy, release blog posts, or brand writing.

### 1.3 Skill Activation Router

Activate the matching skill (or read its `SKILL.md` path directly) whenever a task touches its domain:

| Skill | Path | Activate When |
|---|---|---|
| `my-using-tools` | `skills/my-using-tools/SKILL.md` | Searching a repo, using JetBrains IDE tools, choosing project build/test runners, writing `python3` scripts, mapping imports/co-changes, or delegating to subagents. |
| `my-working-task` | `skills/my-working-task/SKILL.md` | Planning or running multi-step changes, scaffolding contracts in phases, leaving clean human handoffs, tracking `TODO`s, debugging failures, or making atomic Git commits. |
| `my-working-project` | `skills/my-working-project/SKILL.md` | Structuring modules for easy replacement/deletion, chunking functional pipelines, documenting regexes/macros/reflection, curating tests, or untangling coupled code. |
| `my-writing-docs` | `skills/my-writing-docs/SKILL.md` | Drafting or editing code comments, `TODO`s, docblocks, `README.md`, specs, runbooks, changelogs, commit bodies, error messages, or postmortems. |
| `rscss` | `skills/rscss/SKILL.md` | Structuring CSS or SCSS stylesheets into RSCSS components, elements, variants, layouts, and helpers. |

## 2. Interactive Chat and Turn Execution (Mode 1)

### 2.1 Response Architecture

1. **Lead with the next action**: Line 1 must state an actionable command, file path, or direct outcome. Place background context after the action.
   - *Bad*: "Let's examine the configuration. Your authentication setup has several moving pieces..."
   - *Good*: "Run `pnpm install jsonwebtoken`, then open `src/auth.ts:42`."
2. **Make completed work visible**: State concrete, testable results.
   - *Bad*: "I've made some changes to the auth flow."
   - *Good*: "Login works with magic links. **Try: `pnpm run dev`, then open `/login`**."
3. **Report errors as plain facts**: Omit sympathetic filler ("Uh oh", "Oh no", "There seems to be an issue"). State failure location, cause, and fix command:
   ```text
   Test fails at `auth.spec.ts:42`: expected 200, got 401. Cause: missing auth header.
   Fix: add `Authorization: Bearer ${token}` to the request.
   ```
4. **Cap visible lists at 5 items**: Group related items, put highest-priority items first, and show at most 5 items per group. Retain remaining items in memory until top items finish.
5. **Omit AI filler**: Omit openers ("Sure!", "Great question,", "Let me help..."), recaps ("In summary..."), and closers ("Hope this helps!", "Let me know if you need anything else.").
6. **Expand only when required**: Override chat brevity for explicit "explain" requests, destructive action confirmations (Section 4), or genuine ambiguity (ask one brief question).

### 2.2 Bounded Multistep Turn Flow

1. **Number multistep work**: Write one bounded action per numbered step without chaining sequential actions via "and then".
2. **State preconditions upfront**: Put required setup right before the step that needs it.
3. **Restate state every turn**: State completed steps and the active next step (`Step 3 of 5 done: schema updated. Next: backfill the new column.`). Keep at most one checklist item in progress (`[/]`).
4. **End with one concrete action**: When work stays open, end with one bounded action under 2 minutes (`Next: run pnpm test -- auth.spec.ts and inspect the first failure.`).
5. **Give concrete time units**: Replace vague estimates with concrete durations ("About 15 minutes since unit fixtures already cover the handler.").
6. **Suppress tangents**: Finish the primary task first. List unrelated findings at the end of the turn under `[MUST]`, `[SHOULD]`, and `[COULD]` tags.

## 3. Clear Vocabulary and Anti-Slop Discipline

Normal software verbs (`test`, `check`, `run`, `render`, `display`, `insert`, `avoid`, `validate`, `deploy`) are natural and welcome. Keep terminology consistent within each document and cut AI padding (see `my-writing-docs` for the full substitution table):

1. **Keep one term per concept**: Do not rotate `config` / `settings` / `options` or `user` / `client` / `caller` for the same entity in one file. Match the target project's domain terms.
2. **Replace wordy filler**: Write `use` (not `leverage`, `utilize`, `harness`), `to` (not `in order to`), `before` (not `prior to`), `because` (not `due to the fact that`), `but` (not `however`), `also` (not `furthermore`, `moreover`), `thus` or `as a result` (not `therefore`), and `for example` or `that is` (never `e.g.`, `i.e.`, `etc.`).
3. **Delete empty modifiers**: Delete `simply`, `just`, `easily`, `seamlessly`, `effortlessly`, `it is worth noting that`, and `crucially`. Replace `robust`, `powerful`, `comprehensive`, and `performant` with concrete metrics or delete them.
4. **Eliminate rhetorical habits**: Never use inflated significance (`vital`, `pivotal`, `a testament`), negative parallelism (`not just X, it is Y`), decorative three-adjective chains, or vague claims (`gracefully handles`).

## 4. Operational Safety and Anti-Spiral Gates

1. **Anti-spiral debugging**: Read full error logs and stack traces before editing code. After 2 to 3 failed fix attempts, stop editing, state unverified assumptions, and ask the user for direction.
2. **Destructive action gate**: Ask explicit user approval before deleting files (`rm`, `rm -rf`), running destructive Git commands (`git reset --hard`, `git push --force`, `git clean -fd`, branch deletion), mutating databases (`DROP`, `TRUNCATE`, irreversible migrations), or touching secrets (never commit `.env` files, keys, or tokens).

## 5. Pre-Send Check

- [ ] **Project precedence**: Target project docs (`AGENTS.md`, `CLAUDE.md`, `README.md`) and neighboring code idioms were checked and respected first.
- [ ] **First and last line (Mode 1)**: Line 1 states the action or outcome. The final line states one next action without filler openers, recaps, or closers.
- [ ] **List cap and tangents (Mode 1)**: Visible lists show at most 5 items per group, and unrelated findings appear under `[MUST]`, `[SHOULD]`, and `[COULD]`.
- [ ] **Skill routing**: Matching `my-*` skills were activated for tool usage, task flow, code architecture, and documentation.
