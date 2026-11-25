# Using IntelliJ PyCharm Python MCP Tools

Use your built-in file and shell tools first once you know the target Python executable and package manager. Escalate to
these PyCharm MCP tools (alongside core [SKILL.md](../SKILL.md) tools) when working in an unfamiliar Python module so
commands target the IDE-configured virtual environment instead of the wrong system Python binary.

Parameters marked with `*` are required. Always pass `projectPath` on every tool call.

---

## 1. Python Environment Discovery and Configuration

- `get_python_environment` (`filePath`*): Report the configured Python interpreter version, environment type (`venv`,
  `conda`, `system`), executable path, and package manager for `filePath` without guessing system Python. If
  `noInterpreterConfigured` is non-null and indicates that an interpreter must be configured, call
  `configure_python_interpreter`.
- `configure_python_interpreter` (`filePath`*): Configure a Python interpreter for the module containing `filePath`
  using PyCharm detection (existing `.venv` or fresh `uv`, `poetry`, `hatch`, or `pipenv` environment). Call only after
  `get_python_environment` reports no configured interpreter. This tool does not install missing environment tools.

**Recommended workflow before running Python commands**:

1. Call `get_python_environment` with a project Python `filePath` to obtain the exact interpreter path and package
   manager (`uv`, `poetry`, `pip`, `conda`).
2. If `noInterpreterConfigured` is non-null and indicates that an interpreter must be configured, call
   `configure_python_interpreter` for that `filePath`.
3. If `configure_python_interpreter` fails because a required tool (`uv` or `poetry`) is missing, report the missing
   tool rather than silently switching to an unconfigured system Python.
4. Once you know the interpreter path, run tests, linters, and scripts directly through your built-in shell runner.
