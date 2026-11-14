---
name: my-writing-docs
description: >-
  Write and audit technical documentation, inline comments, TODO markers, docstrings,
  API specifications, READMEs, runbooks, changelogs, commit bodies, error messages, and
  postmortems in Mode 2 (ASD-STE100 Simplified Technical English). Activate this skill
  whenever drafting or editing repository text, code comments, or technical prose.
---

# Strict Manual-Style Technical Writing (Mode 2: ASD-STE100)

Mode 2 applies Simplified Technical English (ASD-STE100 Issue 9) to software documentation and code text. Every sentence must survive one read without ambiguity.

## 1. Scope and Text Classification

Apply Mode 2 to all repository and code text:
- Inline code comments, semantic section blocks, and `TODO` markers
- Public documentation blocks (Javadoc, Rustdoc, JSDoc, Go doc comments)
- `README.md`, `AGENTS.md`, `SKILL.md`, runbooks, changelogs, and postmortems
- API specifications, OpenAPI schemas, commit bodies, and error messages

Note: Do not apply Mode 2 constraints to marketing copy or persuasive brand writing.

Classify each paragraph before you write. Never mix procedural instructions and descriptive explanations in one paragraph.

| Dimension | Procedural Text (Instructions, Runbooks, `TODO`s) | Descriptive Text (Comments, Docstrings, Specs) |
|---|---|---|
| **Purpose** | Directs the reader or agent to do an action | Explains rationale, architecture, failure modes, or state |
| **Verb Form** | Imperative mood ("Deploy the service.") | Simple present, simple past, or simple future |
| **Sentence Limit** | **Maximum 20 words** (Rule 5.1) | **Maximum 25 words** (Rule 6.3) |
| **Unit Limit** | **1 instruction** per sentence (Rule 5.2), unless simultaneous | **1 new fact** per sentence (Rule 6.1), **1 topic** and **<= 6 sentences** per paragraph (Rules 6.5–6.6) |
| **Notes & Flow** | `Note:` gives information only, never commands (Rule 5.5) | Connect sentences with explicit transitions (`Then`, `As a result`) (Rule 4.4) |

## 2. Sentence Structure and Grammar Rules

1. **Condition before command (Rule 5.4)**: Put the condition before the imperative command, separated by a comma.
   - *Bad*: "Run the database migration if the build passes."
   - *Good*: "If the build passes, run the database migration."
2. **Active voice (Rule 3.6)**: Use active voice. In descriptive text, use passive voice only when the actor is unknown.
3. **Simple verb forms (Rules 3.2–3.4)**: Use only simple present, simple past, simple future, imperative, and infinitive forms. Use past participles only as adjectives (`the cached response`). Never use perfect tenses (`deployed`, never `has deployed` or `had been deployed`).
4. **No `-ing` verbs or trailing clauses (Rule 3.5)**: Use `-ing` words only as technical nouns or modifiers (`logging`, `the mounting bracket`). Replace trailing clauses with a new sentence and an explicit subject.
5. **Verbs over nominalizations (Rule 3.7)**: Describe actions with verbs (`compress the file`, not `do a compression of the file`).
6. **No noun-verb swaps (Rules 1.5, 1.7, 1.12, 1.13)**: Domain nouns (`webhook`, `commit`, `endpoint`) and domain verbs (`deploy`, `compile`, `merge`, `install`) are permitted. Never use a technical noun as a verb (`send an event to the webhook`, not `webhook the event`) or a technical verb as a noun (`deploy the service`, not `do a deploy`).
7. **No phrasal verbs (Rule 9.3)**: Replace multi-word phrasal verbs with single verbs (`install` or `configure` instead of `set up`, `decrease` instead of `go down`).
8. **Complete grammar (Rules 4.2, 4.5, GR-1..8)**: Never use contractions (`do not`, `it is`, `cannot`, `will not`). Keep articles (`the`, `a`, `an`) and relative pronouns (`that`). Put an explicit noun after `this` or `these` (`this configuration`). Use American English spelling (Rule 1.14).
9. **Three-word noun limit (Rules 2.1–2.2)**: Keep noun clusters to **3 words or fewer**. Break longer chains with prepositions (`the timeout value for the connection pool`, not `the connection pool timeout configuration value`).

## 3. The Modal Ladder and Safety Directives

Only three modal verbs are permitted in prose, comments, and specifications:
- **`must`**: Mandatory requirement.
- **`can`**: System possibility or permission.
- **`will`**: Deterministic future action.

Prose must not contain `should`, `would`, `may`, `might`, or `could` (literal triage tags `[MUST]`, `[SHOULD]`, `[COULD]` and code identifiers are exempt).

| Banned Modal | Approved Replacement |
|---|---|
| `should` (requirement) | Replace with `must`. |
| `should` (recommendation) | Delete, or state the benefit as a fact ("X is faster because Y."). |
| `may` / `might` / `could` (possibility) | Replace with `can`. |
| `would` (hypothetical) | Rewrite as a conditional ("If X occurs, Y occurs."). |

Format high-risk instructions with explicit severity labels (Rules 7.1–7.3). Put the command or condition first, and state the risk immediately after:
- **`WARNING`**: Personal injury, severe security vulnerability, or irreversible catastrophic harm.
- **`CAUTION`**: Data loss, schema corruption, service downtime, or equipment damage.

```text
CAUTION: Do not run this migration against the production replica during peak traffic.
The migration locks the orders table for 10 minutes.
```

## 4. Punctuation, Word-Count Rules, and Untouchable Technical Strings

1. **No semicolons (`;`) (Rule 8.1)**: Forbidden in prose and comments. Split into two sentences.
2. **No em-dashes**: Forbidden in prose and comments. Use `because`, `but`, parentheses, or two sentences.
3. **Vertical lists (Rules 4.3, 8.4)**: Use vertical lists for 3 or more items or steps. End the lead-in with a colon (`:`), start items with a capital letter, and put a period only on full sentences. Each item has its own 20/25-word budget.
4. **Single-word counting exemptions (Rules 8.5–8.7)**: Count as **1 word** each: numbers with units (`500ms`, `10GB`), hyphenated compounds (`read-only`), backtick code tokens, CLI flags, file paths, URLs, and parenthetical text `(...)`.
5. **Untouchable technical strings**: Never alter code blocks, inline backtick identifiers, CLI flags, file paths, URLs, quoted log/error strings, SQL keywords (`INSERT`, `SELECT`), HTTP codes, product names, API routes, or configuration keys.

## 5. Terminology Consistency, Anti-Patterns, and Slop Substitutions

Never alternate synonyms for one concept:

| Concept | Approved Term | Context Routing | Banned Synonyms |
|---|---|---|---|
| State verification | `make sure that` | All modes (`examine` for logs, `measure` for metrics) | `ensure`, `check`, `verify`, `confirm` |
| Settings / options | `configuration` | All modes | `config`, `settings`, `options`, `preferences` |
| Run a command / job | `run` or `operate` | `run` for CLI/tests, `operate` for services, `do` for general actions | `execute`, `fire off`, `spin up` |
| Fault condition | `error` | All modes (`problem` also permitted in Mode 2) | `issue`, `glitch`, `hiccup` |
| Loss of function | `failure` | All modes ("a failure of the database connection") | `outage`, `breakdown` |

Eliminate these six AI anti-patterns:
1. **Inflated significance**: Never call routine changes `vital`, `crucial`, `pivotal`, or `a testament`.
2. **Negative parallelism**: Never write `not just X, it is Y`.
3. **Decorative triplets**: Do not pad sentences with three-adjective or three-adverb chains.
4. **Vague attribution**: Never write `best practices suggest` or `studies show`. Name the standard, RFC, or benchmark.
5. **False ranges**: Do not write `ranging from X to Y` unless X and Y are numeric or ordered bounds.
6. **Editorializing asides**: Delete `it is important to remember`, `it is worth noting that`, and `crucially`.

If a prohibited word adds no factual meaning, delete the word instead of replacing it:

| Prohibited / Slop Term | Approved Simple Replacement |
|---|---|
| `leverage`, `utilize`, `harness` | `use` |
| `in order to` | `to` |
| `prior to` | `before` |
| `ensure`, `verify`, `confirm` | `make sure that` |
| `it is worth noting that`, `it's important to`, `crucially` | *(delete)* |
| `simply`, `just`, `easily`, `seamlessly`, `effortlessly` | *(delete)* |
| `robust`, `powerful`, `comprehensive`, `performant` | *(delete or give exact metric)* |
| `blazingly fast`, `state-of-the-art`, `cutting-edge`, `groundbreaking`, `innovative` | `fast` *(with benchmark)*, `new`, or *(delete)* |
| `functionality` | `function`, `feature` |
| `enables you to`, `allows you to` | `you can` |
| `is designed to`, `aims to` | *(delete and state what it does)* |
| `facilitate` | `help`, `make possible` |
| `dive into`, `delve into` | `read`, `examine` |
| `when it comes to` | `for` |
| `in the event that` | `if` |
| `due to the fact that`, `since` *(causal)* | `because` |
| `as needed`, `as necessary` | *(state exact condition)* |
| `and/or` | `X, or Y, or both` |
| `e.g.`, `i.e.`, `etc.` | `for example`, `that is`, *(list items)* |
| `gracefully handles` | *(state exact behavior: "retries 3 times, then exits")* |
| `out of the box` | `by default` |
| `under the hood` | `internally` |
| `streamline` | `make simpler`, `make faster` |
| `plethora`, `myriad` | `many` |
| `addresses the issue`, `tackles` | `corrects the fault`, `removes the error` |
| `pivotal`, `crucial`, `paramount` | `important` |
| `tapestry`, `testament`, `synergy` | *(delete)* |
| `interplay` | `interaction` *(or delete)* |
| `intricate` | `complex` |
| `vibrant`, `nuanced`, `multifaceted` | *(delete or name exact parts)* |
| `realm`, `landscape` *(metaphorical)* | `area` |
| `transformative`, `game-changer` | *(delete and state what changes)* |
| `revolutionize` | `change` |
| `showcase`, `underscore`, `emphasize` | `show` |
| `foster`, `empower`, `bolster` | `help`, `support`, `let` |
| `enhance` | `improve` |
| `elevate` | `increase` |
| `furthermore`, `moreover` | `also` |
| `however`, `that being said`, `notwithstanding` | `but` |
| `therefore` | `thus`, `as a result` |
| `in conclusion`, `in summary`, `at the end of the day` | *(delete)* |
| `embark`, `endeavor` | `start`, `try` |
| `meticulous`, `meticulously` | `careful`, `carefully` |
| `holistic` | `full` |
| `paradigm` | `model` |
| `navigate` *(metaphorical)* | `go to`, `inspect` |
| `boasts` | `has` |
| `nestled`, `in the heart of` | *(delete and state exact location)* |
| `bustling` | `busy` |
| `I hope this helps`, `let's dive in` | *(delete)* |

## 6. Strict Dictionary and Part-of-Speech Rulings

| Term / Category | Strict STE Ruling | Approved Usage |
|---|---|---|
| `test`, `check`, `work` | **Nouns only** (never verbs) | `do a test` / `run the test suite`, `make sure that X`, `operate` |
| `validate` | Domain verb (Rule 1.12) | `validate the payload`, or `make sure that` |
| `help` | **Verb only** (never noun) | For the noun, write `aid` (`with the aid of`) |
| `oil` | **Noun only** | For the verb, write `lubricate` |
| `fall` | Physical drop only | For metrics or numbers, write `decrease` |
| `follow` | "Come after" only (never "obey") | `obey the instructions` or `obey the protocol` |
| `above` / `below` | Physical position only | For numeric limits, write `more than` / `less than` |
| `delete`, `drop`, `destroy` | `drop` and `destroy` banned in prose | `erase` (data), `remove` (items), or `delete` (Rule 1.12) |
| `run`, `execute`, `invoke`, `launch` | `execute` rejected | `operate` (services), `do` (general), `run`/`invoke`/`launch` (CLI/processes, Rule 1.12) |
| `display`, `render`, `present` | Rejected verbs | `show` (`render` -> `make` or `show`) |
| `perform` | Rejected verb | `do` |
| `insert` | Rejected in prose (SQL `INSERT` exempt) | `put` |
| `reach` | Rejected verb | `get` or `get to` |
| `avoid` | Rejected verb | `prevent` |
| `repeat` | Rejected verb | `do ... again` |
| `acceptable` | Vague adjective | `permitted`, or state exact limit (`latency of less than 200ms`) |
| `complete` (adjective) | Verb only | `completed` for the adjective (`the completed migration`) |
| `need to`, `have to` | Rejected modal phrases | Imperative in procedures (`Install X.`); `it is necessary to` or `must` in descriptions |
| `any` | Rejected determiner | Delete, or rewrite as conditional (`if you have questions`) |
| `now` | Informal adverb | Delete in imperatives (`Start the service.`); `at this time` in descriptions |
| `the example below` | Positional ambiguity | Name the target identifier or write `the example that follows` |

## 7. Domain-Specific Templates and Pre-Delivery Prose Audit

- **Error Messages**: Simple past fact, cause, then imperative fix command (`Connection to the database failed. The password for user app was not correct. Set DB_PASSWORD and connect again.`).
- **Semantic Code Comments**: Multi-line descriptive blocks for design rationale, failure modes, handling sequence, and hidden invariants (`my-working-project`).
- **`TODO` Markers**: Condition first plus imperative command `<= 20` words (`// TODO: If the token expires during streaming, refresh the session before retrying.`).
- **Runbooks and SOPs**: Imperative mood, 1 command per numbered step, condition first, `<= 20` words per step.
- **Incident Postmortems**: Simple past tense only. Never write "may have affected". State exact numbers or `unknown`.
- **API Specs and Changelogs**: Simple present or past facts. Format breaking changes as `CAUTION:` blocks (command first, risk second).
- **Agent Prompts and Rules**: Imperative mood, condition first, `must` instead of banned modals.

Before delivery, inspect all Mode 2 text against this checklist:
- [ ] Zero contractions (`'ll`, `'re`, `'ve`, `n't`, `it's`)
- [ ] Zero perfect tenses (`has been`, `have been`, `had been`, `has <participle>`)
- [ ] Zero banned modals in prose (`should`, `would`, `may`, `might`, `could`)
- [ ] Zero noun-as-verb errors (`test`, `check`, `work` used as verbs)
- [ ] Zero trailing participle clauses (`, making`, `, allowing`, `, enabling`)
- [ ] Zero semicolons (`;`) and zero em-dashes in prose
- [ ] Zero Latin abbreviations (`e.g.`, `i.e.`, `etc.`)
- [ ] Zero mid-sentence `if` or `when` conditions (move every condition before the command)
- [ ] Limits met: procedural sentences and `TODO`s `<= 20` words, descriptive sentences `<= 25` words, paragraphs `<= 6` sentences, noun clusters `<= 3` words
