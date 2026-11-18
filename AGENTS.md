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
| **Mode 1: Interactive Chat** *(Default)* | User replies, trivial edit outcomes, debugging handoffs, clarifying questions, and 1-to-2 sentence pointers to session documents | Sections 2 through 5 of this file. Lead with the action or outcome, cap lists at 5 items, omit filler, and never duplicate `plan.md` or `report.md` contents in chat. |
| **Mode 2: Practical Software STE** *(All docs & code text)* | Session documents (`plan.md`, `todo.md`, `report.md`), code comments, `TODO`s, docblocks, API specs, `README.md`, `AGENTS.md`, `SKILL.md`, runbooks, changelogs, commit bodies, error messages, postmortems | Respect project doc style first, then activate `my-writing-docs` (`skills/my-writing-docs/SKILL.md`). Write unambiguous active-voice prose, put conditions before commands, explain *why* and *how* on dense code, and cut AI slop. |

Note: Never apply Mode 2 constraints to marketing copy, release blog posts, or brand writing.

### 1.3 Skill Activation Router

Activate the matching skill (or read its `SKILL.md` path directly) whenever a task touches its domain:

| Skill | Path | Activate When |
|---|---|---|
| `my-using-tools` | `skills/my-using-tools/SKILL.md` | Choosing default repository search, CLI build/test runners, `python3` scripts, import/co-change inspection, or subagent delegation, and deciding when to escalate to `intellij` MCP. |
| `my-using-intellij` | `skills/my-using-intellij/SKILL.md` | Escalating from default tools to active `intellij` (or `jetbrains_air_ide`) MCP tools for PSI navigation, Call Hierarchy, Structural Search, safe rename, inspections, builds, coverage, changelists, multi-language debugging, or on-demand language guides (`references/` for JVM, Go, Python, PHP, SQL, and CMake/native). |
| `my-working-task` | `skills/my-working-task/SKILL.md` | Planning tasks (`/plan` or multi-step preparation), tracking checkboxes in `todo.md`, scaffolding contracts in phases, guarding scope boundaries, debugging failures, making atomic Git commits, or writing completion reports (`report.md`). |
| `my-working-project` | `skills/my-working-project/SKILL.md` | Structuring modules for easy replacement/deletion, chunking functional pipelines, documenting regexes/macros/reflection, curating tests, or untangling coupled code. |
| `my-writing-docs` | `skills/my-writing-docs/SKILL.md` | Drafting or editing session documents, code comments, `TODO`s, docblocks, `README.md`, specs, runbooks, changelogs, commit bodies, error messages, or postmortems. |
| `rscss` | `skills/rscss/SKILL.md` | Structuring CSS or SCSS stylesheets into RSCSS components, elements, variants, layouts, and helpers. |

## 2. Interactive Chat, Turn Execution, and Session Documents

### 2.1 Response Architecture (Mode 1)

1. **Lead with the next action or outcome**: Line 1 must state an actionable command, file path, or direct outcome. Place background context after the action.
   - *Bad*: "Let's examine the configuration. Your authentication setup has several moving pieces..."
   - *Good*: "Run `pnpm install jsonwebtoken`, then open `src/auth.ts:42`."
2. **Route completed work by task tier**: On trivial 1-file tasks that skip `report.md`, state concrete, testable results in chat (`Login works with magic links. **Try: pnpm run dev, then open /login**`). Whenever `report.md` is generated (Section 2.3), do not summarize actions or follow-up items in chat. Reply in 1 to 2 sentences telling the user to read `report.md`.
3. **Report errors as plain facts**: Omit sympathetic filler ("Uh oh", "Oh no", "There seems to be an issue"). State failure location, cause, and fix command:
   ```text
   Test fails at `auth.spec.ts:42`: expected 200, got 401. Cause: missing auth header.
   Fix: add `Authorization: Bearer ${token}` to the request.
   ```
4. **Cap visible lists at 5 items**: Group related items, put highest-priority items first, and show at most 5 items per group in chat.
5. **Omit AI filler**: Omit openers ("Sure!", "Great question,", "Let me help..."), recaps ("In summary..."), and closers ("Hope this helps!", "Let me know if you need anything else.").
6. **Expand only when required**: Override chat brevity for explicit "explain" requests, destructive action confirmations (Section 4), or genuine ambiguity (ask one brief question).

### 2.2 Bounded Multistep Turn Flow

1. **Number multistep work**: Write one bounded action per numbered step without chaining sequential actions via "and then".
2. **State preconditions upfront**: Put required setup right before the step that needs it.
3. **Track progress in `todo.md`**: On multi-step tasks, check off completed items (`- [x]`) in `todo.md` as each step finishes, keeping at most one active item marked `- [ ] **(in progress)**`. When pausing mid-task in chat, state completed steps and the next step in one line (`Step 3 of 5 done: schema updated. Next: backfill the new column.`).
4. **End open turns with one concrete action**: When work stays open or awaits approval, end with one bounded action under 2 minutes (`Next: review plan.md and click Proceed to start Step 1.`).
5. **Give concrete time units**: Replace vague estimates with concrete durations ("About 15 minutes because unit fixtures already cover the handler.").
6. **Guard scope and suppress tangents**: Finish the in-scope task first and never expand scope mid-session. Record unrelated findings and out-of-scope follow-ups under `[MUST]`, `[SHOULD]`, and `[COULD]` inside `report.md` (or at the end of the turn on trivial edits that skip `report.md`).

### 2.3 Session Document Lifecycle (`plan.md`, `todo.md`, `report.md`)

Activate `my-working-task` (`skills/my-working-task/SKILL.md` and `references/session-templates.md`) to manage structured session documents:

1. **Trigger matrix**:
   - **Read-only Q&A and quick lookups**: Reply directly in chat (Mode 1) and create zero session documents, unless the session was explicitly planned or required extended multi-step investigation (then write `report.md`).
   - **Trivial tasks** (single-file, fast, obvious edit with zero architectural decisions): Skip `plan.md` and `todo.md`, and reply concisely in chat. If a task started as trivial ends up taking substantial debugging or investigation time, write `report.md` upon completion.
   - **Planned, multi-step, architectural, or time-intensive tasks** (`/plan` invocations, changes touching 2 or more files, architectural decisions, or tasks taking substantial time): Create `plan.md` and `todo.md` during preparation, update `todo.md` checkboxes live during execution, and generate `report.md` upon completion.
2. **Session directory resolution** (first accessible directory wins):
   - **Antigravity**: Conversation `<Artifact Directory>` (`<appDataDir>/brain/<conversation-id>/plan.md`, `todo.md`, `report.md` with `UserFacing: true`).
   - **Other agents with native directories**: The agent's own accessible plan or session directory (for example, `.junie/plans/` in JetBrains Junie).
   - **Fallback**: `.agents/sessions/<YYYYMMDD-HHMM>-<slug>/` inside the workspace. Keep fallback `.agents/sessions/` files unstaged unless the user asks to commit them.
3. **Document roles and chat handoffs**:
   - **`plan.md`**: Junie-structured requirements (with explicit `In Scope` and `Out of Scope` boundaries), technical design (contracts, component table, ASCII file tree, risks), conditional reference sections, and testing. Omit delivery steps from `plan.md`. If `/plan` or plan approval was requested, reply with a 1-to-2 sentence link to `plan.md` and `todo.md` without re-summarizing and wait for approval.
   - **`todo.md`**: Standalone delivery checklist organized into `### Step N` blocks with `- [ ]` and `- [x]` Markdown checkboxes updated live during execution.
   - **`report.md`**: Summary and outcome, completed actions and file table, verification results and run commands, and `[MUST]` / `[SHOULD]` / `[COULD]` future work rendered as a table. Once written, reply in 1 to 2 sentences linking `report.md` and telling the user to read it.

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
- [ ] **Session documents**: `plan.md`, `todo.md`, and `report.md` were created and updated per Section 2.3, and chat replies link to `plan.md` or `report.md` without duplicating their contents.
- [ ] **First and last line (Mode 1)**: Line 1 states the action or outcome, visible chat lists cap at 5 items per group, and the final line states one concrete next action when work remains open without AI filler.
- [ ] **Skill routing**: Matching `my-*` skills were activated for tool usage, task flow, code architecture, and documentation.
