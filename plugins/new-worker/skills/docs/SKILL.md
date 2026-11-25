---
name: new::docs
description: >-
  Write unambiguous, substantive technical documentation, boundary API docblocks,
  dense-code rationale blocks, API specs, READMEs, runbooks, changelogs, commit bodies,
  error messages, postmortems, substantial session plans or reports, and Korean
  documentation while respecting project conventions first. Activate this skill when
  drafting or editing substantive documentation. Routine tasks.md entries and short
  inline comments follow rules/AGENTS.md Section 3 without loading this skill.
---

# Practical Software Technical Writing (Mode 2)

Write technical documentation and code comments that engineers and AI agents parse on the first read without ambiguity,
filler, or robotic phrasing.

## 1. Project Voice and Style Precedence

Always inspect the target project's existing documentation before applying default formatting rules:

1. **Local style wins**: Follow the project's `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CONTRIBUTING.md`, ADR
   templates, and existing docstring style first.
2. **Match repository language**: Write in the established language of the codebase. In Korean repositories without
   another local convention, follow [references/korean-style-guide.md](references/korean-style-guide.md) (adapted
   from [eGovFramework/egovframe-docs](https://github.com/eGovFramework/egovframe-docs)):
    - Use a consistent formal declarative written style (`~한다 / ~이다`), without imperative commands or conversational
      endings.
    - Maintain an objective instructional tone and define key technical terms on first use.
    - Keep sentences short, terminology consistent, and headings monotonic.
3. **Exclude creative copy**: Never apply controlled technical-writing constraints to marketing pages, release blog
   posts, or brand copy where voice and persuasion are the goal.

When the target project defines no house style (or when writing specifications, runbooks, error messages, commit bodies,
and rationale comments), apply the Practical Software STE rules in Sections 2 through 6.

---

## 2. Separate Instructions from Explanations

Decide whether a passage directs an action (**Procedural**) or explains how/why something works (**Descriptive**). Keep
instructions and background explanations in separate paragraphs or blocks so readers never miss a required step inside a
wall of prose.

| Dimension         | Procedural Text (Runbooks, Setup Steps, `TODO`s)                                                                                                            | Descriptive Text (Architecture, Rationale Comments, Specs)                                      |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| **Purpose**       | Tells the reader or agent what action to take                                                                                                               | Explains *why*, *how*, constraints, invariants, or system state                                 |
| **Verb Form**     | Imperative (`Run the migration.`) *(in Korean docs, use formal declarative style per [references/korean-style-guide.md](references/korean-style-guide.md))* | Simple present, simple past, or simple future                                                   |
| **Target Length** | Aim for **20 words or fewer** per step. Keep 1 action per step.                                                                                             | Aim for **25 words or fewer** per sentence. Keep 1 topic and at most 6 sentences per paragraph. |
| **Conditions**    | Put the trigger **before** the command (`If the build fails, inspect the log.`)                                                                             | Use explicit logical connectors (`Because`, `As a result`, `Otherwise`)                         |

---

## 3. Clear Sentence Structure, Readability, and Modals

Rules 1 through 6 counter the information-compression patterns that make frontier LLM output harder for humans to parse
([Clark, Martin, & Mahowald, 2026](https://arxiv.org/abs/2610.29162)). Write for uniform information density and easy
first-pass reading rather than minimum token count:

1. **Active voice with literal verbs**: Name the actor (`The worker drops duplicate events.`). Use passive voice only
   when the actor is unknown or irrelevant. When the subject is inanimate (code, a function, an error, or a
   specification), use a literal mechanical verb instead of an animate-agent verb (`swallows`, `bites`, `eats`,
   `forgets`, `promises`, `expects`, `wants`, `misunderstands`). Write `the check handles str but omits bytes`, not
   `the check covered str but forgot bytes`.
2. **Direct verbs without ad-hoc denominal verbs**: Prefer direct verbs over nominalizations (`validate the payload` and
   `compress the archive`, not `perform a validation of the payload` or `do file compression`). Normal software verbs
   are natural and encouraged: `test`, `check`, `run`, `render`, `display`, `insert`, `avoid`, and `deploy`. Avoid
   coining ad-hoc denominal verbs from nouns outside established domain terms (`cache`, `stage`, `hash`, `log`). For
   example, write `add a footnote` instead of `footnote it`, and `schedule it on the calendar` instead of `calendar it`.
3. **Short dependency distances**: Keep each subject close to its main verb and each verb close to its object. Do not
   wedge long parenthetical lists or nested clauses between a subject and its verb. Place heavy qualifiers or lists at
   the end of the sentence, or split them into a separate sentence.
4. **Break stacked noun compounds (3 or more nouns)**: Chains of 3 or more modifying nouns introduce bracketing
   ambiguity (`absolute dotfile backup path handling`, `class-time shutdown requirement`). Keep noun compounds to 2
   nouns, or unpack longer stacks with prepositions (`handling of absolute backup paths for dotfiles`,
   `the shutdown requirement during class time`). Keep an established 3-word technical compound
   (`connection pool timeout`) only when its grouping is unambiguous.
5. **Keep optional `that` and `which` where omission hurts parsing**: Do not drop optional relativizers or
   complementizers to save tokens. Retain `that` in object relative clauses
   (`the behavior that the old code never reached`) and complement clauses (`confirm that the lock released`) whenever
   omission creates a garden path or spikes reading effort. Prefer subject-relative or direct clauses over tangled
   object relatives.
6. **Conventional phrasing over telegraphic compression**: Spread information evenly across a sentence instead of
   packing maximum meaning into rare or unattested word pairs. Use predictable wording and connecting words instead of
   terse shorthand (`verified that every behavioral test fails against the original source`, not
   `verified red against the original source`).
7. **Explicit pronouns and complete grammar**: Follow `this` or `these` with a noun (`this lock`, `these headers`) so
   the referent is never ambiguous. Avoid contractions in formal docs, specs, and comments (write `do not`, `cannot`,
   and `it is` instead).
8. **Clean punctuation**: Avoid semicolons (`;`) and clause-joining em-dashes in technical prose. Split run-on clauses
   into separate sentences or use explicit conjunctions (`because`, `but`). Introduce 3 or more parallel items or steps
   with a colon (`:`) and a vertical list.
9. **Untouchable literals**: Never alter code snippets, backtick identifiers, CLI flags, file paths, URLs, quoted log
   strings, SQL keywords, or configuration keys to satisfy prose rules.
10. **Clear modals vs. honest uncertainty**:
    - In **specifications, rules, and procedures**, use `must` (requirement), `can` (capability/permission), and `will`
      (deterministic behavior). Replace weak `should` requirements with `must`, or state the concrete trade-off as a
      fact.
    - In **debugging notes, incident postmortems, and root-cause analysis**, never upgrade an unverified hypothesis into
      a false fact. State what is confirmed and explicitly label what remains unverified.
11. **Risk callouts**: Place `WARNING:` (security breach or catastrophic irreversible harm) and `CAUTION:` (data loss,
    downtime, or lock contention) immediately before the risky step. Put the command or prohibition first and the
    specific consequence second.

---

## 4. Documenting Dense Code (*Why* + *How*)

Twenty lines of well-explained regex, macro logic, reflection, or compact algorithm are easier to maintain than 200
lines of sprawling boilerplate when the prose documents every non-obvious constraint and step:

1. **State *Why***: Explain the constraint, performance metric, or boilerplate eliminated, plus why a naive alternative
   falls short.
2. **State *How***: Walk through capture groups, bit fields, state transitions, macro output, or reflection contracts in
   plain bullets.
3. **Show one concrete example**: Include a realistic sample input and expected output (or macro expansion sketch) right
   in the comment block so the next developer can modify it safely without re-deriving the logic.

---

## 5. Terminology Consistency and Anti-Slop Discipline

1. **One concept, one word per document**: Do not rotate synonyms (`config` / `settings` / `options`, or `user` /
   `client` / `caller`) for the same thing inside one file. Match whatever term the codebase types already use.
2. **Do not invent ad-hoc nouns or undefined labels**: Avoid coining metaphorical or hyphenated names (`retry-throttle`,
   `backoff-envelope`, `aggressive-throttle posture`, `throttle-driven latency lift`) for ordinary parameters, ranges,
   states, or causal steps. Describe what changes and what happens directly with established domain terms and plain
   verbs (`adjust the retry delay between 100ms and 2s`, `when the retry delay increases, p99 latency increases`). Name
   a new concept only when it is distinct and recurs across the document, and define it explicitly on first use.
3. **Eliminate AI rhetorical habits**:
    - No inflated significance (`vital`, `pivotal`, `a testament`)
    - No negative parallelisms (`not just X, it is Y`)
    - No decorative adjective triplets or throat-clearing (`it is worth noting that`, `crucially`)
    - No vague claims (`gracefully handles`, `blazingly fast`, `robust`). State exact retry counts, timeouts, or
      benchmarks instead.
    - Spell out `for example` and `that is` instead of `e.g.`, `i.e.`, and trailing `etc.`

---

## 6. Quick Pre-Delivery Check

Before finishing documentation or comments, scan for:

- [ ] **Project fit**: Matches the repository's existing doc conventions, terminology, and language.
- [ ] **Actionable flow**: Conditions appear before commands, steps contain one action each, and risky commands carry
  `WARNING:` or `CAUTION:` callouts.
- [ ] **High signal**: Comments explain *why* and *how* (especially on dense regexes, macros, reflection, or external
  quirks) without restating obvious code syntax.
- [ ] **Psycholinguistic readability**: Short subject-verb distances, literal verbs for inanimate subjects, no ad-hoc
  denominal verbs, no ambiguous 3+ noun stacks, optional `that` retained where helpful, and conventional phrasing over
  telegraphic shorthand.
- [ ] **Zero slop or ambiguity**: Free of AI filler words, invented undefined labels, Latin abbreviations (`e.g.`,
  `i.e.`, `etc.`), run-on semicolons/em-dashes, and bare `this` pronouns.

---

## 7. Reference Tables, Templates, and Sources

- [references/slop-substitutions.md](references/slop-substitutions.md): Full substitution table for AI slop, precision
  swaps for software prose, and readability swaps against compression.
- [references/domain-templates.md](references/domain-templates.md): Copy-ready patterns for dense-code *why/how* blocks,
  error messages, `TODO`s, runbooks, postmortems, and commit bodies.
- [references/korean-style-guide.md](references/korean-style-guide.md): Detailed style guide for Korean technical and
  code documentation (written in Korean), including `문체`, `어조`, terminology notation, document templates, code/table
  patterns, and integrity checks.
- **Sources**:
    - [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/).
    - Thomas Hikaru Clark, Matias B. Martin, and Kyle Mahowald (2026). [*Why is AI-generated language so hard to
      understand?*](https://arxiv.org/abs/2610.29162) (`arXiv:2610.29162`).
    - [eGovFramework Documentation (`egovframe-docs`)](https://github.com/eGovFramework/egovframe-docs).
