# Using IntelliJ PhpStorm MCP Tools

Use your built-in file tools, `rg`, and local `composer` commands via your shell runner first when working locally.
Escalate to these PhpStorm tools (and core `search_structural` or `xdebug_*` in [SKILL.md](../SKILL.md)) when inspecting
remote PHP interpreters over Docker or SSH, querying indexed monorepo `composer.lock` files without disk I/O, or running
AST-based PHP Structural Search.

Parameters marked with `*` are required. Always pass `projectPath` on every tool call.

---

## 1. PHP Interpreter and Composer Tools

- `get_php_project_config` (optional `projectPath` only): Read PhpStorm's configured PHP language level, interpreter metadata (local, Docker, or SSH), exact PHP runtime version, loaded extensions, `php.ini` path, and active debuggers without disk or network calls.
- `get_composer_dependencies` (`nameFilter`): Return installed Composer packages and exact versions from indexed `composer.lock` across the project and monorepo sub-projects, optionally filtered by case-insensitive glob `nameFilter`.
- `get_structural_patterns` (`category`): List verified predefined PHP Structural Search (SSR) templates by category (`General`, `Expressions`, `Suspicious`) before calling `search_structural` with `fileType: "PHP"`.

---

## 2. Running PHP Structural Search (`search_structural`)

Combine `get_structural_patterns` with `search_structural` from [SKILL.md](../SKILL.md) (`fileType: "PHP"`):

1. Call `get_structural_patterns` first to discover reliable templates and pattern syntax (`$a$->$b$()`, `new $Class$()`, `class $a$ extends $b$ {}`).
2. Call `search_structural` with `fileType: "PHP"`, `pattern`, optional `directoryToSearch`, and optional `constraints` (keyed by variable name without `$` signs).
3. Account for PHP SSR limits: some class modifiers such as `readonly` can fail to match, and complex nested patterns with constraints can behave inconsistently compared to Java SSR.

---

## 3. PHP Runtime Debugging Note

Interactive PHP step debugging, breakpoints, stack frames, and expression evaluation use the cross-language `xdebug_*` tools documented in [SKILL.md](../SKILL.md).
