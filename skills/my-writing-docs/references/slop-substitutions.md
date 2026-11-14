# Slop-to-Simple and Software Precision Reference

Use this lookup table when writing or editing documentation, code comments, commit bodies, error messages, and specifications.

## 1. AI Slop-to-Simple Substitution Table

If a prohibited word adds no factual meaning, delete the word instead of replacing it.

| Prohibited / Slop Term | Approved Simple Replacement |
|---|---|
| `leverage`, `utilize`, `harness` | `use` |
| `in order to` | `to` |
| `prior to` | `before` |
| `ensure` *(vague)* | `make sure that` *(or state the exact check)* |
| `it is worth noting that`, `it's important to`, `crucially` | *(delete)* |
| `simply`, `just`, `easily`, `seamlessly`, `effortlessly` | *(delete)* |
| `robust`, `powerful`, `comprehensive`, `performant` | *(delete or give exact metric)* |
| `blazingly fast`, `state-of-the-art`, `cutting-edge`, `groundbreaking`, `innovative` | `fast` *(with benchmark)*, `new`, or *(delete)* |
| `functionality` | `function`, `feature` |
| `enables you to`, `allows you to` | `you can` |
| `is designed to`, `aims to` | *(delete and state what it does)* |
| `facilitate` | `help`, `make possible` |
| `dive into`, `delve into` | `read`, `inspect`, `examine` |
| `when it comes to` | `for` |
| `in the event that` | `if` |
| `due to the fact that`, `since` *(causal)* | `because` |
| `as needed`, `as necessary` | *(state the exact condition)* |
| `and/or` | `X, or Y, or both` |
| `e.g.`, `i.e.`, `etc.` | `for example`, `that is`, *(name the items)* |
| `gracefully handles` | *(state exact behavior: "retries 3 times, then exits")* |
| `out of the box` | `by default` |
| `under the hood` | `internally` |
| `streamline` | `simplify`, `speed up` |
| `plethora`, `myriad` | `many` |
| `addresses the issue`, `tackles` | `fixes the bug`, `removes the error` |
| `pivotal`, `crucial`, `paramount` | `important`, `required` |
| `tapestry`, `testament`, `synergy` | *(delete)* |
| `interplay` | `interaction` *(or delete)* |
| `intricate` | `complex` |
| `vibrant`, `nuanced`, `multifaceted` | *(delete or name the exact parts)* |
| `realm`, `landscape` *(metaphorical)* | `area`, `domain` |
| `transformative`, `game-changer` | *(delete and state what changes)* |
| `revolutionize` | `change`, `replace` |
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
| `holistic` | `full`, `end-to-end` |
| `paradigm` | `model`, `pattern` |
| `navigate` *(metaphorical)* | `open`, `go to`, `inspect` |
| `boasts` | `has`, `includes` |
| `nestled`, `in the heart of` | *(delete and state exact path or location)* |
| `bustling` | `busy`, `active` |
| `I hope this helps`, `let's dive in` | *(delete)* |

---

## 2. Practical Software Precision Swaps

Normal software verbs (`test`, `check`, `run`, `render`, `display`, `insert`, `avoid`, `repeat`, `validate`, `deploy`) are natural and permitted in software prose. Replace only phrases that create genuine ambiguity for engineers or agents:

| Ambiguous Phrase | Clear Software Phrasing | Why |
|---|---|---|
| Rotating `config` / `settings` / `options` / `preferences` in one doc | Pick one term (`configuration` unless the project names the type `Options` or `Settings`) | Synonym rotation makes readers wonder whether two distinct concepts exist |
| Rotating `user` / `client` / `caller` / `customer` in one doc | Pick the exact actor (`caller` for functions, `client` for HTTP, `user` for humans) | Distinguishes human operators from upstream services |
| `above` / `below` for numbers (`values above 500ms`) | `more than` / `less than` (`latency of more than 500ms`) | Prevents confusion between numeric direction and page layout position |
| `the example below` / `see above` | `the following example` or link the exact section heading | Survives layout reflows and chunked agent file reads |
| Bare `this` or `it` across clauses (`This breaks retries.`) | `this` + explicit noun (`This timeout breaks retries.`) | Removes antecedent ambiguity |
| Soft phrasal verbs (`spin up`, `kick off`, `reach out`, `tear down`) | Direct verbs (`start`, `begin`, `contact`, `stop` or `delete`) | Clearer to non-native readers and downstream parsers |
| Nominalizations (`perform a validation of`, `make a connection to`) | Direct verbs (`validate`, `connect to`) | Shorter and keeps the actor explicit |
| Vague thresholds (`acceptable latency`, `large payload`) | Exact bounds (`latency under 200ms`, `payloads over 4MB`) | Testable engineering specification |
