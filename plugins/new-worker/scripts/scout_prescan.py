#!/usr/bin/env python3
"""Deterministic repository pre-scan and disjoint partition planner for new::project-scout.

Collects Git state, directory layout, shared reference excerpts, formatter configs,
commit/tag patterns, shared-module symbol skeletons, and recency-ranked files in
one read-only pass so new::project-scout and new::project-scout-worker subagents avoid
duplicate reads of shared files.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
import fnmatch
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

# Hard secret exclusion lists matching rules/AGENTS.md Section 1.2 item 1.
ALLOWED_ENV_TEMPLATES = frozenset({".env.example", ".env.sample", ".env.template"})
SECRET_EXTENSIONS = frozenset({".key", ".pem", ".p12", ".pfx", ".jks", ".tfvars"})
SECRET_KEY_PREFIXES = ("id_rsa", "id_ed25519", "id_ecdsa")
SECRET_BASENAMES = frozenset({".npmrc", ".pypirc", ".netrc", "credentials.json"})
SECRET_PATH_SUFFIXES = (".aws/credentials", ".kube/config", ".docker/config.json")

NOISE_DIR_NAMES = frozenset(
    {
        "node_modules",
        "vendor",
        "target",
        "dist",
        "build",
        ".git",
        ".venv",
        "venv",
        "__pycache__",
        ".next",
        ".nuxt",
        "out",
        "coverage",
        ".gemini",
        ".junie",
        ".claude",
    }
)

LOCKFILE_NAMES = frozenset(
    {
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
        "bun.lock",
        "bun.lockb",
        "Cargo.lock",
        "go.sum",
        "poetry.lock",
        "uv.lock",
        "Gemfile.lock",
        "composer.lock",
        "Pipfile.lock",
        "flake.lock",
    }
)

BINARY_OR_ASSET_EXTENSIONS = frozenset(
    {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".ico",
        ".svg",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".otf",
        ".pdf",
        ".zip",
        ".tar",
        ".gz",
        ".bz2",
        ".xz",
        ".7z",
        ".jar",
        ".war",
        ".class",
        ".pyc",
        ".pyo",
        ".so",
        ".dll",
        ".dylib",
        ".exe",
        ".bin",
        ".o",
        ".a",
        ".wasm",
        ".mp3",
        ".mp4",
        ".wav",
        ".mov",
        ".avi",
        ".sqlite",
        ".db",
    }
)

LANGUAGE_BY_EXTENSION: Dict[str, str] = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".hpp": "C++",
    ".hh": "C++",
    ".c": "C",
    ".h": "C/C++",
    ".swift": "Swift",
    ".scala": "Scala",
    ".vue": "Vue",
    ".svelte": "Svelte",
    ".sql": "SQL",
    ".sh": "Shell",
    ".bash": "Shell",
    ".zsh": "Shell",
    ".css": "CSS",
    ".scss": "SCSS",
    ".html": "HTML",
}

GUIDE_EXACT_PATHS = (
    "AGENTS.md",
    "rules/AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    "README.md",
    "CONTRIBUTING.md",
    "ARCHITECTURE.md",
    ".github/copilot-instructions.md",
)

MANIFEST_EXACT_NAMES = (
    "package.json",
    "pnpm-workspace.yaml",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "plugin.json",
    "Makefile",
    "justfile",
)

RUNTIME_PIN_NAMES = (
    ".nvmrc",
    ".node-version",
    "rust-toolchain.toml",
    ".python-version",
    ".tool-versions",
)

FORMATTER_PATTERNS = (
    ".editorconfig",
    ".prettierrc",
    ".prettierrc.*",
    "prettier.config.*",
    "eslint.config.*",
    ".eslintrc",
    ".eslintrc.*",
    "biome.json",
    "biome.jsonc",
    "tsconfig.json",
    "rustfmt.toml",
    ".rustfmt.toml",
    "clippy.toml",
    ".clippy.toml",
    ".golangci.yml",
    ".golangci.yaml",
    "ruff.toml",
    ".ruff.toml",
    ".flake8",
    ".clang-format",
    "checkstyle.xml",
    ".pre-commit-config.yaml",
)

SHARED_CODE_PREFIXES = (
    "shared/",
    "common/",
    "core/",
    "types/",
    "pkg/",
    "lib/",
    "internal/domain/",
    "src/types/",
    "src/shared/",
    "src/core/",
    "packages/shared/",
    "packages/common/",
    "packages/types/",
)

WRAPPER_ROOTS = frozenset(
    {"apps", "packages", "services", "crates", "modules", "cmd", "internal", "libs"}
)

NON_SUBSYSTEM_TOP_DIRS = frozenset(
    {
        ".",
        "test",
        "tests",
        "__tests__",
        "spec",
        "specs",
        "docs",
        "doc",
        "scripts",
        "fixtures",
        "examples",
        ".github",
        ".idea",
    }
)

TEST_DIR_NAMES = frozenset(
    {"test", "tests", "__tests__", "spec", "specs", "e2e", "integration", "fixtures"}
)

DOC_EXTENSIONS = frozenset({".md", ".mdx", ".rst", ".txt", ".adoc"})

BULK_COMMIT_FILE_THRESHOLD = 40

# Why + How: Static symbol skeleton extraction using a compiled regex table
#
# Why:
#   Subsystems frequently import types and helpers from shared/ or core/ modules.
#   Extracting exported symbol signatures in Python lets subsystem workers treat
#   shared modules as black boxes without spawning extra AST tools or reading
#   shared files repeatedly.
#
# How:
#   Each extension maps to a tuple of line-anchored compiled patterns covering
#   exported or top-level public declarations across TS/JS, Python, Go, Rust,
#   Java/Kotlin, PHP, and C/C++.
#
# Example:
#   Input (ts):  "export interface UserProfile {\n  id: string;\n}"
#   Output:      "export interface UserProfile"
SYMBOL_PATTERNS: Dict[str, Tuple[re.Pattern[str], ...]] = {
    "ts_js": (
        re.compile(
            r"^\s*export\s+(?:default\s+)?(?:async\s+)?"
            r"(?:function\*?|class|interface|type|enum|const|let|abstract\s+class)"
            r"\s+[A-Za-z_$][\w$]*"
        ),
        re.compile(r"^\s*export\s*\{[^}]+\}"),
    ),
    "py": (
        re.compile(r"^(?:async\s+)?(?:def|class)\s+(?!_)[A-Za-z_]\w*\s*[\(:]"),
    ),
    "go": (
        re.compile(r"^func\s+(?:\([^)]+\)\s+)?[A-Z]\w*\s*\("),
        re.compile(r"^type\s+[A-Z]\w*\b"),
    ),
    "rs": (
        re.compile(
            r"^\s*pub(?:\(crate\))?\s+(?:async\s+|unsafe\s+)?"
            r"(?:fn|struct|enum|trait|type|mod|const|static)\s+[A-Za-z_]\w*"
        ),
    ),
    "jvm": (
        re.compile(
            r"^\s*(?:public\s+|sealed\s+|data\s+|abstract\s+|final\s+|open\s+)*"
            r"(?:class|interface|record|enum|object)\s+[A-Za-z_]\w*"
        ),
    ),
    "php": (
        re.compile(
            r"^\s*(?:final\s+|abstract\s+|readonly\s+)*"
            r"(?:class|interface|trait|enum|function)\s+[A-Za-z_]\w*"
        ),
    ),
    "c_cpp": (
        re.compile(
            r"^\s*(?:template\s*<[^>]+>\s*)?"
            r"(?:class|struct|enum(?:\s+class)?)\s+[A-Za-z_]\w*"
        ),
    ),
}

SYMBOL_FAMILY_BY_EXTENSION: Dict[str, str] = {
    ".ts": "ts_js",
    ".tsx": "ts_js",
    ".js": "ts_js",
    ".jsx": "ts_js",
    ".mjs": "ts_js",
    ".cjs": "ts_js",
    ".py": "py",
    ".go": "go",
    ".rs": "rs",
    ".java": "jvm",
    ".kt": "jvm",
    ".kts": "jvm",
    ".php": "php",
    ".c": "c_cpp",
    ".h": "c_cpp",
    ".cpp": "c_cpp",
    ".hpp": "c_cpp",
    ".cc": "c_cpp",
    ".hh": "c_cpp",
    ".cxx": "c_cpp",
}


@dataclass
class GitState:
    is_git: bool
    branch: str
    short_sha: str
    status_summary: str


@dataclass
class ReferenceExcerpt:
    path: str
    content: str


@dataclass
class ReferencesBundle:
    guides: List[ReferenceExcerpt] = field(default_factory=list)
    manifests: List[ReferenceExcerpt] = field(default_factory=list)
    lockfiles: List[str] = field(default_factory=list)
    runtime_pins: List[ReferenceExcerpt] = field(default_factory=list)
    ci_commands: List[ReferenceExcerpt] = field(default_factory=list)
    formatters: List[ReferenceExcerpt] = field(default_factory=list)
    workspace_globs: List[str] = field(default_factory=list)


@dataclass
class RecentDiscovery:
    recent_files: List[str] = field(default_factory=list)
    bulk_commits: List[str] = field(default_factory=list)
    gaps: List[str] = field(default_factory=list)


@dataclass
class GitPatterns:
    commit_subjects: List[str] = field(default_factory=list)
    commit_bodies: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    doc_cochange_summary: str = "Not observed"


@dataclass
class SharedSkeleton:
    path: str
    symbols: List[str]


@dataclass
class Partition:
    name: str
    owned_prefixes: List[str]
    assigned_files: List[str]
    rationale: str


@dataclass
class PartitionPlan:
    mode: str
    strategy: str
    reason: str
    total_source_files: int
    total_test_files: int
    total_doc_ci_files: int
    subsystems_detected: Dict[str, int]
    partitions: List[Partition]


@dataclass
class PrescanResult:
    repo_name: str
    repo_root: str
    scope: Optional[str]
    git_state: GitState
    total_inventory_files: int
    languages: Dict[str, int]
    tree_summary: List[str]
    references: ReferencesBundle
    recent: RecentDiscovery
    git_patterns: GitPatterns
    shared_skeletons: List[SharedSkeleton]
    partition_plan: PartitionPlan
    gaps: List[str]


def normalize_rel_path(rel_path: str) -> str:
    norm = rel_path.replace("\\", "/")
    while norm.startswith("./"):
        norm = norm[2:]
    if norm == ".":
        return ""
    return norm


def is_secret_path(rel_path: str) -> bool:
    """Return True if rel_path matches any excluded secret or credential pattern."""
    norm = normalize_rel_path(rel_path).lower()
    if not norm:
        return False

    basename = norm.rsplit("/", 1)[-1]
    if basename in ALLOWED_ENV_TEMPLATES:
        return False

    if basename == ".env" or basename.startswith(".env."):
        return True

    if Path(basename).suffix in SECRET_EXTENSIONS:
        return True

    if basename.startswith(SECRET_KEY_PREFIXES):
        return True

    if basename in SECRET_BASENAMES:
        return True

    if fnmatch.fnmatch(basename, "service-account*.json"):
        return True

    return any(
        norm == suffix or norm.endswith("/" + suffix)
        for suffix in SECRET_PATH_SUFFIXES
    )


def is_noise_path(rel_path: str) -> bool:
    """Return True if rel_path resides in build, cache, dependency, or local IDE noise."""
    norm = normalize_rel_path(rel_path).strip("/")
    if not norm:
        return False

    parts = [part for part in norm.split("/") if part]
    if any(part in NOISE_DIR_NAMES for part in parts[:-1]):
        return True
    if parts[-1] in NOISE_DIR_NAMES:
        return True

    if norm == ".idea/editor.xml" or norm.endswith("/.idea/editor.xml"):
        return True
    if (
            norm == ".idea/shelf"
            or norm.startswith(".idea/shelf/")
            or norm.endswith("/.idea/shelf")
            or "/.idea/shelf/" in norm
    ):
        return True
    if (
            norm == ".agents/sessions"
            or norm.startswith(".agents/sessions/")
            or norm.endswith("/.agents/sessions")
            or "/.agents/sessions/" in norm
    ):
        return True

    return False


def is_lockfile(rel_path: str) -> bool:
    basename = normalize_rel_path(rel_path).rsplit("/", 1)[-1]
    return basename in LOCKFILE_NAMES


def is_binary_or_asset(rel_path: str) -> bool:
    lower = normalize_rel_path(rel_path).lower()
    if lower.endswith((".min.js", ".min.css", ".map")):
        return True
    return Path(lower).suffix in BINARY_OR_ASSET_EXTENSIONS


def is_test_file(rel_path: str) -> bool:
    norm = normalize_rel_path(rel_path).lower()
    parts = norm.split("/")
    if any(part in TEST_DIR_NAMES for part in parts[:-1]):
        return True

    basename = parts[-1]
    if basename.startswith("test_") or ".test." in basename or ".spec." in basename:
        return True

    stem = Path(basename).stem
    if stem.endswith(("_test", "_spec")):
        return True

    orig_base = normalize_rel_path(rel_path).rsplit("/", 1)[-1]
    orig_stem = Path(orig_base).stem
    return orig_stem.endswith(("Test", "Tests", "Spec", "Specs"))


def is_doc_ci_file(rel_path: str) -> bool:
    norm = normalize_rel_path(rel_path)
    lower = norm.lower()
    ext = Path(lower).suffix
    basename = lower.rsplit("/", 1)[-1]

    if ext in DOC_EXTENSIONS:
        return True
    if lower.startswith(("docs/", "doc/", ".github/", "scripts/")):
        return True
    if basename in {".gitlab-ci.yml", "makefile", "justfile", "dockerfile"}:
        return True
    return basename.startswith(("dockerfile.", "docker-compose."))


def is_code_file(rel_path: str) -> bool:
    if is_lockfile(rel_path) or is_binary_or_asset(rel_path):
        return False
    ext = Path(normalize_rel_path(rel_path).lower()).suffix
    return ext in LANGUAGE_BY_EXTENSION


def run_git(repo_path: Path, args: Sequence[str]) -> Tuple[int, str]:
    cmd = ["git", "-C", str(repo_path), "-c", "core.quotepath=false", *args]
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except OSError as exc:
        return 1, str(exc)
    return proc.returncode, proc.stdout


def run_git_bytes(repo_path: Path, args: Sequence[str]) -> Tuple[int, bytes]:
    cmd = ["git", "-C", str(repo_path), "-c", "core.quotepath=false", *args]
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError:
        return 1, b""
    return proc.returncode, proc.stdout


def resolve_repo_root(raw_repo: str) -> Tuple[Path, bool]:
    candidate = Path(raw_repo).resolve()
    if not candidate.is_dir():
        raise ValueError(f"Repository path does not exist or is not a directory: {candidate}")

    code, out = run_git(candidate, ["rev-parse", "--show-toplevel"])
    if code == 0 and out.strip():
        top = Path(out.strip()).resolve()
        if top.is_dir():
            return top, True
    return candidate, False


def validate_out_path(raw_out: Optional[str], repo_root: Path) -> Optional[Path]:
    if not raw_out:
        return None
    out_path = Path(raw_out).resolve()
    try:
        out_path.relative_to(repo_root.resolve())
    except ValueError:
        return out_path
    raise ValueError(f"--out path must be outside the target repository root: {out_path}")


def is_safe_repo_file(repo_root: Path, rel_path: str) -> bool:
    if is_secret_path(rel_path) or is_noise_path(rel_path):
        return False
    full = repo_root / rel_path
    if not full.is_file():
        return False
    try:
        full.resolve().relative_to(repo_root)
    except (OSError, ValueError):
        return False
    return True


def safe_read_text(repo_root: Path, rel_path: str, max_bytes: int = 32768) -> str:
    if not is_safe_repo_file(repo_root, rel_path):
        return ""
    full = repo_root / rel_path
    try:
        with full.open("rb") as handle:
            raw = handle.read(max_bytes)
    except OSError:
        return ""
    if b"\x00" in raw:
        return ""
    return raw.decode("utf-8", errors="replace")


def collect_git_state(repo_root: Path, is_git: bool) -> GitState:
    if not is_git:
        return GitState(
            is_git=False,
            branch="N/A",
            short_sha="N/A",
            status_summary="Not a Git repository",
        )

    code_branch, out_branch = run_git(repo_root, ["rev-parse", "--abbrev-ref", "HEAD"])
    branch = out_branch.strip() if code_branch == 0 and out_branch.strip() else ""
    if not branch:
        code_sym, out_sym = run_git(repo_root, ["symbolic-ref", "--short", "HEAD"])
        branch = out_sym.strip() if code_sym == 0 and out_sym.strip() else "HEAD"

    code_sha, out_sha = run_git(repo_root, ["rev-parse", "--short", "HEAD"])
    short_sha = out_sha.strip() if code_sha == 0 and out_sha.strip() else "no-commits"

    code_st, out_st = run_git(repo_root, ["status", "--porcelain"])
    if code_st != 0:
        status_summary = "unknown"
    elif not out_st.strip():
        status_summary = "clean"
    else:
        staged = 0
        modified = 0
        untracked = 0
        for line in out_st.splitlines():
            if len(line) < 2:
                continue
            x_flag, y_flag = line[0], line[1]
            if x_flag == "?" and y_flag == "?":
                untracked += 1
                continue
            if x_flag not in (" ", "?"):
                staged += 1
            if y_flag not in (" ", "?"):
                modified += 1
        status_summary = f"{staged} staged, {modified} modified, {untracked} untracked"

    return GitState(
        is_git=True,
        branch=branch,
        short_sha=short_sha,
        status_summary=status_summary,
    )


def collect_inventory(repo_root: Path, is_git: bool) -> Tuple[List[str], List[str]]:
    gaps: List[str] = []
    if is_git:
        code, raw = run_git_bytes(repo_root, ["ls-files", "-z"])
        if code == 0:
            paths = []
            for entry in raw.split(b"\x00"):
                if not entry:
                    continue
                rel = normalize_rel_path(entry.decode("utf-8", errors="replace"))
                if is_safe_repo_file(repo_root, rel):
                    paths.append(rel)
            if not paths:
                gaps.append("Git repository contains zero tracked files.")
            return sorted(set(paths)), gaps
        gaps.append("git ls-files failed; fell back to directory walk.")

    paths = []
    for root, dirnames, filenames in os.walk(repo_root, topdown=True, followlinks=False):
        rel_root = Path(root).relative_to(repo_root)
        kept_dirs: List[str] = []
        for dname in sorted(dirnames):
            rel_dir = normalize_rel_path(str(rel_root / dname))
            if not is_noise_path(rel_dir) and not is_secret_path(rel_dir):
                kept_dirs.append(dname)
        dirnames[:] = kept_dirs

        for fname in sorted(filenames):
            rel_file = normalize_rel_path(str(rel_root / fname))
            if is_safe_repo_file(repo_root, rel_file):
                paths.append(rel_file)
    return paths, gaps


def summarize_tree(inventory: Sequence[str], max_lines: int = 35) -> List[str]:
    if not inventory:
        return ["(empty repository)"]

    root_files = 0
    bucket_counts: Counter[str] = Counter()
    for rel in inventory:
        parts = rel.split("/")
        if len(parts) == 1:
            root_files += 1
        elif len(parts) == 2:
            bucket_counts[f"{parts[0]}/"] += 1
        else:
            bucket_counts[f"{parts[0]}/{parts[1]}/"] += 1

    lines: List[str] = []
    if root_files > 0:
        lines.append(f"./ ({root_files} root files)")

    sorted_buckets = sorted(bucket_counts.items(), key=lambda item: (-item[1], item[0]))
    remaining_slots = max(1, max_lines - len(lines))
    if len(sorted_buckets) <= remaining_slots:
        for folder, count in sorted_buckets:
            lines.append(f"{folder} ({count} files)")
    else:
        kept = sorted_buckets[: max(1, remaining_slots - 1)]
        for folder, count in kept:
            lines.append(f"{folder} ({count} files)")
        omitted = len(sorted_buckets) - len(kept)
        lines.append(f"... (+{omitted} more directories)")

    return lines


def detect_languages(inventory: Sequence[str]) -> Dict[str, int]:
    counts: Counter[str] = Counter()
    for rel in inventory:
        if not is_code_file(rel):
            continue
        ext = Path(rel.lower()).suffix
        lang = LANGUAGE_BY_EXTENSION.get(ext)
        if lang:
            counts[lang] += 1
    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def _compact_guide_excerpt(text: str, max_chars: int = 500) -> str:
    kept: List[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("#") or len(kept) < 6:
            kept.append(raw_line.rstrip())
        if sum(len(item) + 1 for item in kept) >= max_chars:
            break
    joined = "\n".join(kept).strip()
    if len(joined) > max_chars:
        return joined[: max_chars - 3].rstrip() + "..."
    return joined


def _extract_package_json(text: str, workspace_globs: List[str]) -> str:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return text[:450].strip()

    if not isinstance(data, dict):
        return text[:450].strip()

    summary: Dict[str, Any] = {}
    for key in ("name", "version", "type", "packageManager", "engines"):
        if key in data:
            summary[key] = data[key]

    workspaces = data.get("workspaces")
    if isinstance(workspaces, list):
        ws_list = [str(w) for w in workspaces if isinstance(w, str)]
        summary["workspaces"] = ws_list
        workspace_globs.extend(ws_list)
    elif isinstance(workspaces, dict) and isinstance(workspaces.get("packages"), list):
        ws_list = [str(w) for w in workspaces["packages"] if isinstance(w, str)]
        summary["workspaces"] = ws_list
        workspace_globs.extend(ws_list)

    scripts = data.get("scripts")
    if isinstance(scripts, dict) and scripts:
        summary["scripts"] = dict(list(scripts.items())[:15])

    rendered = json.dumps(summary, indent=2, ensure_ascii=False)
    if len(rendered) > 500:
        return rendered[:497].rstrip() + "..."
    return rendered


def _extract_pnpm_workspaces(text: str, workspace_globs: List[str]) -> None:
    in_packages = False
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith("packages:"):
            in_packages = True
            continue
        if in_packages:
            if not raw_line.startswith((" ", "\t", "-")):
                break
            if stripped.startswith("-"):
                pattern = stripped[1:].strip().strip("\"'")
                if pattern and not pattern.startswith("!"):
                    workspace_globs.append(pattern)


def _extract_cargo_workspaces(text: str, workspace_globs: List[str]) -> None:
    match = re.search(r"(?ms)^\[workspace\].*?^members\s*=\s*\[(.*?)\]", text)
    if not match:
        return
    for item in re.findall(r'["\']([^"\']+)["\']', match.group(1)):
        workspace_globs.append(item)


def _extract_gradle_workspaces(text: str, workspace_globs: List[str]) -> None:
    for match in re.finditer(r'include\s*\(([^)]+)\)|include\s+([^\n]+)', text):
        raw_items = match.group(1) or match.group(2) or ""
        for item in re.findall(r'["\']:?([^"\']+)["\']', raw_items):
            workspace_globs.append(item.replace(":", "/").strip("/"))


def _extract_makefile_targets(text: str, is_just: bool = False) -> str:
    targets: List[str] = []
    pattern = re.compile(r"^([A-Za-z0-9_.-]+)\s*(?:\([^)]*\))?\s*:")
    for raw_line in text.splitlines():
        if raw_line.startswith((" ", "\t", "#", ".")):
            continue
        match = pattern.match(raw_line)
        if not match:
            continue
        name = match.group(1)
        if not is_just and "=" in raw_line.split(":", 1)[0]:
            continue
        if name not in targets:
            targets.append(name)
        if len(targets) >= 20:
            break
    return "targets: " + ", ".join(targets) if targets else "(no targets parsed)"


def _extract_ci_excerpt(text: str) -> str:
    lines: List[str] = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if re.match(r"^(name|on|jobs|[A-Za-z0-9_-]+):\s*$", stripped) or "run:" in stripped or stripped.startswith(
                "script:"):
            lines.append(raw_line.rstrip())
        if sum(len(x) + 1 for x in lines) >= 400:
            break
    return "\n".join(lines).strip() or _compact_nonempty_lines(text, max_lines=15, max_chars=400)


def _compact_nonempty_lines(text: str, max_lines: int = 25, max_chars: int = 450) -> str:
    kept: List[str] = []
    for raw_line in text.splitlines():
        if not raw_line.strip():
            continue
        kept.append(raw_line.rstrip())
        if len(kept) >= max_lines or sum(len(x) + 1 for x in kept) >= max_chars:
            break
    joined = "\n".join(kept).strip()
    if len(joined) > max_chars:
        return joined[: max_chars - 3].rstrip() + "..."
    return joined


def extract_references(repo_root: Path, inventory: Sequence[str]) -> ReferencesBundle:
    bundle = ReferencesBundle()
    inv_set = set(inventory)

    # 1. Existing guides
    guide_paths: List[str] = [p for p in GUIDE_EXACT_PATHS if p in inv_set]
    for rel in inventory:
        if rel.startswith(".github/PULL_REQUEST_TEMPLATE") and rel not in guide_paths:
            guide_paths.append(rel)

    guide_chars = 0
    for rel in guide_paths:
        if guide_chars >= 2000:
            break
        text = safe_read_text(repo_root, rel)
        if not text:
            continue
        excerpt = _compact_guide_excerpt(text, max_chars=500)
        if not excerpt:
            continue
        bundle.guides.append(ReferenceExcerpt(path=rel, content=excerpt))
        guide_chars += len(excerpt)

    # 2. Manifests, lockfiles, runtime pins, CI
    for rel in inventory:
        if is_lockfile(rel):
            bundle.lockfiles.append(rel)

    manifest_paths = [m for m in MANIFEST_EXACT_NAMES if m in inv_set]
    for rel in manifest_paths:
        text = safe_read_text(repo_root, rel)
        if not text:
            continue
        if rel == "package.json":
            excerpt = _extract_package_json(text, bundle.workspace_globs)
        elif rel == "pnpm-workspace.yaml":
            _extract_pnpm_workspaces(text, bundle.workspace_globs)
            excerpt = _compact_nonempty_lines(text, max_lines=20, max_chars=500)
        elif rel == "Cargo.toml":
            _extract_cargo_workspaces(text, bundle.workspace_globs)
            excerpt = _compact_nonempty_lines(text, max_lines=25, max_chars=500)
        elif rel in ("settings.gradle", "settings.gradle.kts"):
            _extract_gradle_workspaces(text, bundle.workspace_globs)
            excerpt = _compact_nonempty_lines(text, max_lines=25, max_chars=500)
        elif rel in ("Makefile", "justfile"):
            excerpt = _extract_makefile_targets(text, is_just=(rel == "justfile"))
        else:
            excerpt = _compact_nonempty_lines(text, max_lines=25, max_chars=500)
        bundle.manifests.append(ReferenceExcerpt(path=rel, content=excerpt))

    for pin in RUNTIME_PIN_NAMES:
        if pin in inv_set:
            content = safe_read_text(repo_root, pin, max_bytes=1024).strip()[:200]
            if content:
                bundle.runtime_pins.append(ReferenceExcerpt(path=pin, content=content))

    ci_paths = [
        rel
        for rel in inventory
        if rel == ".gitlab-ci.yml"
           or (rel.startswith(".github/workflows/") and rel.endswith((".yml", ".yaml")))
    ]
    ci_chars = 0
    for rel in ci_paths:
        if ci_chars >= 800:
            break
        text = safe_read_text(repo_root, rel)
        if not text:
            continue
        excerpt = _extract_ci_excerpt(text)
        if excerpt:
            bundle.ci_commands.append(ReferenceExcerpt(path=rel, content=excerpt))
            ci_chars += len(excerpt)

    # 3. Formatter and linter configs
    formatter_paths: List[str] = []
    for rel in inventory:
        base = rel.rsplit("/", 1)[-1]
        if any(fnmatch.fnmatch(rel, pat) or fnmatch.fnmatch(base, pat) for pat in FORMATTER_PATTERNS):
            formatter_paths.append(rel)
        elif rel.startswith(".idea/codeStyles/"):
            formatter_paths.append(rel)

    fmt_chars = 0
    for rel in formatter_paths:
        if fmt_chars >= 2000:
            break
        text = safe_read_text(repo_root, rel)
        if not text:
            continue
        excerpt = _compact_nonempty_lines(text, max_lines=25, max_chars=450)
        if excerpt:
            bundle.formatters.append(ReferenceExcerpt(path=rel, content=excerpt))
            fmt_chars += len(excerpt)

    # Deduplicate workspace globs preserving order.
    bundle.workspace_globs = list(dict.fromkeys(bundle.workspace_globs))
    return bundle


def normalize_numstat_path(raw_path: str) -> str:
    """Normalize git --numstat rename formats to the destination path."""
    path = raw_path.strip().strip('"')
    if " => " not in path:
        return normalize_rel_path(path)

    if "{" in path and "}" in path:
        resolved = re.sub(r"\{[^{}]*? => ([^{}]*)\}", r"\1", path)
        resolved = re.sub(r"/+", "/", resolved)
        return normalize_rel_path(resolved.strip("/"))

    return normalize_rel_path(path.split(" => ", 1)[1].strip())


# Why + How: Bulk-commit demotion in recency-ordered file discovery
#
# Why:
#   Large formatting sweeps, license-header updates, or initial import commits
#   touch dozens of files at once and would displace recent feature code from
#   the top sample if ranked purely by latest commit timestamp.
#
# How:
#   Each commit from git log --numstat is bucketed into normal_queue (<= 40
#   files touched) or bulk_queue (> 40 files touched). Final recency ordering
#   emits deduplicated files from normal_queue first, then fills remaining
#   slots from bulk_queue.
def collect_recent_files(
        repo_root: Path,
        inventory: Sequence[str],
        is_git: bool,
        max_recent: int = 60,
) -> RecentDiscovery:
    discovery = RecentDiscovery()
    inv_set = set(inventory)

    if is_git:
        log_args = [
            "log",
            "-n",
            "40",
            "--no-merges",
            "--diff-filter=AMR",
            "--numstat",
            "--pretty=format:__COMMIT__\t%h\t%ad\t%s",
            "--date=short",
        ]
        code, out = run_git(repo_root, log_args)
        if code != 0 or not out.strip():
            fallback_args = [arg for arg in log_args if arg != "--no-merges"]
            code, out = run_git(repo_root, fallback_args)
            if code == 0 and out.strip():
                discovery.gaps.append(
                    "No non-merge commits in recent history; included merge commits for recency discovery."
                )

        if code == 0 and out.strip():
            commits: List[Tuple[str, List[str]]] = []
            current_header = ""
            current_files: List[str] = []

            for raw_line in out.splitlines():
                if raw_line.startswith("__COMMIT__\t"):
                    if current_header:
                        commits.append((current_header, current_files))
                    parts = raw_line.split("\t", 3)
                    sha = parts[1] if len(parts) > 1 else ""
                    date = parts[2] if len(parts) > 2 else ""
                    subj = parts[3] if len(parts) > 3 else ""
                    current_header = f"{sha} ({date}): {subj}"
                    current_files = []
                    continue

                if "\t" not in raw_line:
                    continue
                cols = raw_line.split("\t", 2)
                if len(cols) == 3:
                    current_files.append(normalize_numstat_path(cols[2]))

            if current_header:
                commits.append((current_header, current_files))

            normal_queue: List[str] = []
            bulk_queue: List[str] = []
            for header, files in commits:
                valid_files = [f for f in files if f in inv_set]
                if len(files) > BULK_COMMIT_FILE_THRESHOLD:
                    discovery.bulk_commits.append(f"{header} [{len(files)} files]")
                    bulk_queue.extend(valid_files)
                else:
                    normal_queue.extend(valid_files)

            seen: Set[str] = set()
            for candidate in normal_queue + bulk_queue:
                if candidate in seen:
                    continue
                seen.add(candidate)
                discovery.recent_files.append(candidate)
                if len(discovery.recent_files) >= max_recent:
                    return discovery

            if discovery.recent_files:
                return discovery

    # Non-Git or zero-commit fallback: filesystem mtime descending.
    scored: List[Tuple[float, str]] = []
    for rel in inventory:
        try:
            mtime = (repo_root / rel).stat().st_mtime
        except OSError:
            mtime = 0.0
        scored.append((mtime, rel))

    scored.sort(key=lambda item: (-item[0], item[1]))
    discovery.recent_files = [rel for _, rel in scored[:max_recent]]
    discovery.gaps.append("Used filesystem mtime fallback for recent file discovery.")
    return discovery


def collect_git_patterns(repo_root: Path, is_git: bool) -> GitPatterns:
    patterns = GitPatterns()
    if not is_git:
        patterns.doc_cochange_summary = "Not a Git repository"
        return patterns

    code_subj, out_subj = run_git(
        repo_root,
        ["log", "-n", "20", "--no-merges", "--pretty=format:%h %ad %s", "--date=short"],
    )
    if code_subj != 0 or not out_subj.strip():
        code_subj, out_subj = run_git(
            repo_root,
            ["log", "-n", "20", "--pretty=format:%h %ad %s", "--date=short"],
        )
    if code_subj == 0 and out_subj.strip():
        patterns.commit_subjects = [line.strip() for line in out_subj.splitlines() if line.strip()]

    code_body, out_body = run_git(
        repo_root,
        ["log", "-n", "10", "--no-merges", "--format=__BODY_START__%n%h %s%n%b__BODY_END__"],
    )
    if code_body == 0 and out_body.strip():
        for block in out_body.split("__BODY_START__"):
            if "__BODY_END__" not in block:
                continue
            inner = block.split("__BODY_END__", 1)[0].strip()
            lines = [line.rstrip() for line in inner.splitlines() if line.strip()]
            if len(lines) >= 2:
                header = lines[0]
                body = " | ".join(lines[1:5])
                patterns.commit_bodies.append(f"{header} -> {body}")
            if len(patterns.commit_bodies) >= 5:
                break

    code_tags, out_tags = run_git(repo_root, ["tag", "--sort=-v:refname"])
    if code_tags == 0 and out_tags.strip():
        patterns.tags = [line.strip() for line in out_tags.splitlines() if line.strip()][:10]

    code_doc, out_doc = run_git(
        repo_root,
        ["log", "-n", "15", "--no-merges", "--name-only", "--pretty=format:__C__%h"],
    )
    if code_doc != 0 or not out_doc.strip():
        code_doc, out_doc = run_git(
            repo_root,
            ["log", "-n", "15", "--name-only", "--pretty=format:__C__%h"],
        )
    if code_doc == 0 and out_doc.strip():
        commit_blocks = [b for b in out_doc.split("__C__") if b.strip()]
        doc_hits = 0
        for block in commit_blocks:
            files = [normalize_rel_path(line.strip()) for line in block.splitlines()[1:] if line.strip()]
            if any(
                    f.startswith("docs/")
                    or f.rsplit("/", 1)[-1].upper().startswith(("README", "CHANGELOG", "AGENTS.MD"))
                    for f in files
            ):
                doc_hits += 1
        patterns.doc_cochange_summary = (
            f"{doc_hits} of {len(commit_blocks)} recent commits updated documentation"
        )

    return patterns


def is_shared_module_path(rel_path: str) -> bool:
    norm = normalize_rel_path(rel_path).lower()
    if norm.startswith(SHARED_CODE_PREFIXES):
        return True
    parts = norm.split("/")
    return any(seg in {"shared", "common", "types"} for seg in parts[:-1])


def extract_shared_skeletons(repo_root: Path, inventory: Sequence[str]) -> List[SharedSkeleton]:
    candidates = [
        rel
        for rel in inventory
        if is_shared_module_path(rel) and is_code_file(rel) and not is_test_file(rel)
    ]
    # Prefer canonical prefix paths first.
    candidates.sort(
        key=lambda p: (
            0 if normalize_rel_path(p).lower().startswith(SHARED_CODE_PREFIXES) else 1,
            p,
        )
    )

    skeletons: List[SharedSkeleton] = []
    total_lines = 0
    total_chars = 0

    for rel in candidates:
        if len(skeletons) >= 8 or total_lines >= 60 or total_chars >= 2000:
            break
        ext = Path(rel.lower()).suffix
        family = SYMBOL_FAMILY_BY_EXTENSION.get(ext)
        if not family:
            continue
        patterns = SYMBOL_PATTERNS[family]
        text = safe_read_text(repo_root, rel, max_bytes=24576)
        if not text:
            continue

        matched: List[str] = []
        for raw_line in text.splitlines():
            for pat in patterns:
                if pat.search(raw_line):
                    cleaned = raw_line.strip().rstrip("{").rstrip(":").strip()
                    if len(cleaned) > 100:
                        cleaned = cleaned[:97] + "..."
                    if cleaned and cleaned not in matched:
                        matched.append(cleaned)
                    break
            if len(matched) >= 10:
                break

        if not matched:
            continue

        remaining_lines = 60 - total_lines
        trimmed = matched[:remaining_lines]
        block_chars = sum(len(line) + 1 for line in trimmed) + len(rel) + 4
        if total_chars + block_chars > 2000 and skeletons:
            break

        skeletons.append(SharedSkeleton(path=rel, symbols=trimmed))
        total_lines += len(trimmed)
        total_chars += block_chars

    return skeletons


def _expand_workspace_prefixes(
        workspace_globs: Sequence[str],
        code_files: Sequence[str],
) -> List[str]:
    prefixes: List[str] = []
    for raw_glob in workspace_globs:
        pat = normalize_rel_path(raw_glob).strip("/")
        if not pat:
            continue
        if "*" in pat or "?" in pat:
            pat_parts = pat.split("/")
            depth = len(pat_parts)
            for rel in code_files:
                rel_parts = rel.split("/")
                if len(rel_parts) <= depth:
                    continue
                candidate_dir = "/".join(rel_parts[:depth])
                if fnmatch.fnmatch(candidate_dir, pat):
                    if candidate_dir not in prefixes:
                        prefixes.append(candidate_dir)
        else:
            if any(rel == pat or rel.startswith(pat + "/") for rel in code_files):
                if pat not in prefixes:
                    prefixes.append(pat)

    # Remove parent/child overlaps so workspace prefixes remain disjoint.
    sorted_prefixes = sorted(set(prefixes), key=lambda p: (-len(p), p))
    disjoint: List[str] = []
    for pref in sorted_prefixes:
        if any(other.startswith(pref + "/") for other in disjoint):
            continue
        disjoint.append(pref)
    return sorted(disjoint)


def _derive_subsystem_for_file(rel_path: str, declared_prefixes: Sequence[str]) -> str:
    for pref in declared_prefixes:
        if rel_path == pref or rel_path.startswith(pref + "/"):
            return pref

    parts = rel_path.split("/")
    if len(parts) == 1:
        return "."
    if parts[0] in WRAPPER_ROOTS and len(parts) >= 3:
        return f"{parts[0]}/{parts[1]}"
    return parts[0]


def _pick_disjoint_files(
        candidates: Sequence[str],
        recent_rank: Dict[str, int],
        already_used: Set[str],
        limit: int,
) -> List[str]:
    available = [p for p in candidates if p not in already_used]
    available.sort(key=lambda p: (recent_rank.get(p, 10 ** 9), p))

    prod = [p for p in available if not is_test_file(p)]
    tests = [p for p in available if is_test_file(p)]

    picked: List[str] = []
    if prod and tests:
        prod_cap = max(1, limit - 2)
        picked.extend(prod[:prod_cap])
        test_cap = limit - len(picked)
        picked.extend(tests[:test_cap])
        if len(picked) < limit:
            remaining = [p for p in available if p not in picked]
            picked.extend(remaining[: limit - len(picked)])
    else:
        picked.extend(available[:limit])

    already_used.update(picked)
    return picked


def _matches_scope(rel_path: str, scope_norm: str) -> bool:
    if not scope_norm:
        return False
    lower_path = rel_path.lower()
    lower_scope = scope_norm.lower()
    return (
            rel_path == scope_norm
            or rel_path.startswith(scope_norm + "/")
            or lower_scope in lower_path
    )


def build_partition_plan(
        inventory: Sequence[str],
        recent_files: Sequence[str],
        workspace_globs: Sequence[str],
        scope: Optional[str],
        fanout_threshold: int,
        max_workers: int,
        gaps: List[str],
) -> PartitionPlan:
    source_files: List[str] = []
    test_files: List[str] = []
    doc_ci_files: List[str] = []

    for rel in inventory:
        if is_lockfile(rel) or is_binary_or_asset(rel):
            continue
        if is_test_file(rel):
            test_files.append(rel)
        elif is_code_file(rel):
            source_files.append(rel)
        elif is_doc_ci_file(rel):
            doc_ci_files.append(rel)

    all_code = source_files + test_files
    recent_rank = {path: idx for idx, path in enumerate(recent_files)}
    scope_norm = normalize_rel_path(scope).strip("/") if scope else ""

    active_code = all_code
    active_source = source_files
    active_tests = test_files
    active_docs = doc_ci_files

    if scope_norm:
        scoped_code = [p for p in all_code if _matches_scope(p, scope_norm)]
        if not scoped_code:
            gaps.append(
                f"Scope '{scope_norm}' matched 0 code files; falling back to repository-wide scan."
            )
        elif len(scoped_code) < 60:
            used: Set[str] = set()
            assigned = _pick_disjoint_files(scoped_code, recent_rank, used, limit=8)
            return PartitionPlan(
                mode="single",
                strategy="scoped",
                reason=f"Target scope '{scope_norm}' narrows sampling to {len(scoped_code)} code files (< 60).",
                total_source_files=len(source_files),
                total_test_files=len(test_files),
                total_doc_ci_files=len(doc_ci_files),
                subsystems_detected={scope_norm: len(scoped_code)},
                partitions=[
                    Partition(
                        name="direct",
                        owned_prefixes=[scope_norm],
                        assigned_files=assigned,
                        rationale="Direct single-agent sampling inside target scope.",
                    )
                ],
            )
        else:
            active_code = scoped_code
            active_source = [p for p in source_files if _matches_scope(p, scope_norm)]
            active_tests = [p for p in test_files if _matches_scope(p, scope_norm)]
            active_docs = [p for p in doc_ci_files if _matches_scope(p, scope_norm)]

    declared_prefixes = _expand_workspace_prefixes(workspace_globs, active_code)
    declared_with_source: Set[str] = set()

    subsystem_source_counts: Counter[str] = Counter()
    subsystem_files: Dict[str, List[str]] = defaultdict(list)

    for rel in active_code:
        sub = _derive_subsystem_for_file(rel, declared_prefixes)
        subsystem_files[sub].append(rel)
        if not is_test_file(rel):
            subsystem_source_counts[sub] += 1
            if sub in declared_prefixes:
                declared_with_source.add(sub)

    product_subsystems = {
        sub: count
        for sub, count in subsystem_source_counts.items()
        if sub not in NON_SUBSYSTEM_TOP_DIRS and count > 0
    }
    large_subsystems = [sub for sub, count in product_subsystems.items() if count >= 15]
    total_code_count = len(active_code)

    should_fanout = (
            max_workers >= 2
            and (
                    (len(large_subsystems) >= 2 and total_code_count >= 60)
                    or len(large_subsystems) >= 3
                    or len(declared_with_source) >= 3
                    or total_code_count >= fanout_threshold
            )
    )

    used_files: Set[str] = set()
    worker_cap = max(2, min(max_workers, 4))

    if should_fanout and (len(large_subsystems) >= 2 or len(declared_with_source) >= 3):
        candidate_subs = list(
            dict.fromkeys(
                [sub for sub in large_subsystems]
                + [sub for sub in declared_with_source if sub not in large_subsystems]
            )
        )

        # Rank subsystems by recent activity then source count.
        def sub_score(sub_name: str) -> Tuple[int, int, str]:
            recent_hits = sum(1 for f in subsystem_files[sub_name] if f in recent_rank)
            return (-recent_hits, -product_subsystems.get(sub_name, 0), sub_name)

        candidate_subs.sort(key=sub_score)

        groups: List[Tuple[str, List[str]]] = []
        if len(candidate_subs) <= worker_cap:
            for sub in candidate_subs:
                groups.append((sub.replace("/", "-"), [sub]))
        else:
            for sub in candidate_subs[: worker_cap - 1]:
                groups.append((sub.replace("/", "-"), [sub]))
            overflow_subs = candidate_subs[worker_cap - 1:]
            groups.append(("other-subsystems", overflow_subs))

        partitions: List[Partition] = []
        for group_name, prefixes in groups:
            pool: List[str] = []
            for pref in prefixes:
                pool.extend(subsystem_files[pref])
            assigned = _pick_disjoint_files(pool, recent_rank, used_files, limit=6)
            if assigned:
                partitions.append(
                    Partition(
                        name=group_name,
                        owned_prefixes=prefixes,
                        assigned_files=assigned,
                        rationale=f"Disjoint subsystem sample across {', '.join(prefixes)}.",
                    )
                )

        if len(partitions) >= 2:
            _assert_disjoint_partitions(partitions)
            return PartitionPlan(
                mode="fanout",
                strategy="subsystem",
                reason=(
                    f"Detected {len(candidate_subs)} subsystems ({len(declared_with_source)} declared workspaces, "
                    f"{total_code_count} total code files)."
                ),
                total_source_files=len(source_files),
                total_test_files=len(test_files),
                total_doc_ci_files=len(doc_ci_files),
                subsystems_detected=dict(sorted(product_subsystems.items())),
                partitions=partitions,
            )

    if should_fanout:
        partitions = []
        prod_assigned = _pick_disjoint_files(active_source, recent_rank, used_files, limit=7)
        if prod_assigned:
            partitions.append(
                Partition(
                    name="production-core",
                    owned_prefixes=["<non-test source files>"],
                    assigned_files=prod_assigned,
                    rationale="Recent non-test production source files.",
                )
            )

        if active_tests:
            test_assigned = _pick_disjoint_files(active_tests, recent_rank, used_files, limit=6)
            if test_assigned:
                partitions.append(
                    Partition(
                        name="tests-and-fixtures",
                        owned_prefixes=["<test and fixture files>"],
                        assigned_files=test_assigned,
                        rationale="Recent test files and fixtures.",
                    )
                )
        elif len(active_source) >= 2:
            # No tests exist; split remaining source files into a second batch for parallelism.
            second_batch = _pick_disjoint_files(active_source, recent_rank, used_files, limit=7)
            if second_batch:
                partitions.append(
                    Partition(
                        name="production-secondary",
                        owned_prefixes=["<remaining non-test source files>"],
                        assigned_files=second_batch,
                        rationale="Secondary non-overlapping batch of production files.",
                    )
                )

        non_root_docs = [p for p in active_docs if "/" in p]
        if worker_cap >= 3 and len(non_root_docs) >= 10:
            doc_assigned = _pick_disjoint_files(non_root_docs, recent_rank, used_files, limit=5)
            if doc_assigned:
                partitions.append(
                    Partition(
                        name="docs-ci-and-scripts",
                        owned_prefixes=["docs/", ".github/", "scripts/"],
                        assigned_files=doc_assigned,
                        rationale="Non-root documentation, CI workflows, and helper scripts.",
                    )
                )

        if len(partitions) >= 2:
            _assert_disjoint_partitions(partitions)
            return PartitionPlan(
                mode="fanout",
                strategy="concern",
                reason=(
                    f"Single-package codebase exceeds fan-out threshold "
                    f"({total_code_count} code files >= {fanout_threshold})."
                ),
                total_source_files=len(source_files),
                total_test_files=len(test_files),
                total_doc_ci_files=len(doc_ci_files),
                subsystems_detected=dict(sorted(product_subsystems.items())),
                partitions=partitions,
            )

    # Single-agent baseline
    single_pool = active_code if active_code else list(inventory)
    direct_assigned = _pick_disjoint_files(single_pool, recent_rank, used_files, limit=8)
    partitions = [
        Partition(
            name="direct",
            owned_prefixes=["."],
            assigned_files=direct_assigned,
            rationale="Direct single-agent sampling across recent production and test files.",
        )
    ]
    _assert_disjoint_partitions(partitions)
    return PartitionPlan(
        mode="single",
        strategy="direct",
        reason=(
            f"Codebase has {total_code_count} code files across {len(product_subsystems)} "
            f"product subsystem(s), below fan-out thresholds."
        ),
        total_source_files=len(source_files),
        total_test_files=len(test_files),
        total_doc_ci_files=len(doc_ci_files),
        subsystems_detected=dict(sorted(product_subsystems.items())),
        partitions=partitions,
    )


def _assert_disjoint_partitions(partitions: Sequence[Partition]) -> None:
    assigned_all = [path for part in partitions for path in part.assigned_files]
    if len(assigned_all) != len(set(assigned_all)):
        raise AssertionError("Partition planner produced overlapping assigned files.")


def _truncate_utf8_to_budget(text: str, max_bytes: int) -> str:
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text

    marker = "\n\n[digest truncated to byte budget]"
    marker_bytes = len(marker.encode("utf-8"))
    if max_bytes <= marker_bytes:
        return encoded[:max_bytes].decode("utf-8", errors="ignore")

    budget = max_bytes - marker_bytes
    sliced = encoded[:budget].decode("utf-8", errors="ignore")
    last_newline = sliced.rfind("\n")
    if last_newline > 0:
        sliced = sliced[:last_newline]
    return sliced.rstrip() + marker


def render_digest_markdown(result: PrescanResult, max_digest_bytes: int) -> str:
    lines: List[str] = [
        "## Shared Repo Digest",
        f"- **Repository**: `{result.repo_name}` (`{result.repo_root}`)",
        (
            f"- **Git State**: `{result.git_state.branch}` @ `{result.git_state.short_sha}` "
            f"({result.git_state.status_summary})"
        ),
        f"- **Scope**: `{result.scope or 'Full Onboarding'}`",
        (
            f"- **Inventory**: {result.total_inventory_files} tracked/non-ignored files "
            f"({result.partition_plan.total_source_files} source, "
            f"{result.partition_plan.total_test_files} test, "
            f"{result.partition_plan.total_doc_ci_files} doc/CI)"
        ),
    ]

    if result.languages:
        lang_str = ", ".join(f"{lang} ({count})" for lang, count in result.languages.items())
    else:
        lang_str = "None detected (documentation/config files only)"
    lines.append(f"- **Languages**: {lang_str}")

    if result.references.lockfiles:
        lines.append(f"- **Lockfiles**: {', '.join(f'`{lf}`' for lf in result.references.lockfiles)}")

    lines.append("")
    lines.append("### Directory Tree Summary")
    lines.append("```text")
    lines.extend(result.tree_summary)
    lines.append("```")

    if result.references.guides:
        lines.append("")
        lines.append("### Existing Guides")
        for ref in result.references.guides:
            lines.append(f"#### `{ref.path}`")
            lines.append("```text")
            lines.append(ref.content)
            lines.append("```")

    if result.references.manifests or result.references.runtime_pins or result.references.ci_commands:
        lines.append("")
        lines.append("### Manifests, Runtime Pins, and CI")
        for pin in result.references.runtime_pins:
            lines.append(f"- **`{pin.path}`**: `{pin.content}`")
        for ref in result.references.manifests:
            lines.append(f"#### `{ref.path}`")
            lines.append("```text")
            lines.append(ref.content)
            lines.append("```")
        for ci in result.references.ci_commands:
            lines.append(f"#### `{ci.path}`")
            lines.append("```text")
            lines.append(ci.content)
            lines.append("```")

    if result.references.formatters:
        lines.append("")
        lines.append("### Formatters and Linters")
        for ref in result.references.formatters:
            lines.append(f"#### `{ref.path}`")
            lines.append("```text")
            lines.append(ref.content)
            lines.append("```")

    if result.git_state.is_git:
        lines.append("")
        lines.append("### Git Commit and Release Patterns")
        lines.append(f"- **Doc Co-Change**: {result.git_patterns.doc_cochange_summary}")
        if result.git_patterns.tags:
            lines.append(f"- **Recent Tags**: {', '.join(f'`{t}`' for t in result.git_patterns.tags)}")
        if result.git_patterns.commit_subjects:
            lines.append("- **Recent Subjects**:")
            for subj in result.git_patterns.commit_subjects[:12]:
                lines.append(f"  - `{subj}`")
        if result.git_patterns.commit_bodies:
            lines.append("- **Recent Commit Bodies**:")
            for body in result.git_patterns.commit_bodies:
                lines.append(f"  - `{body}`")
        if result.recent.bulk_commits:
            lines.append("- **Demoted Bulk Commits (>40 files)**:")
            for bulk in result.recent.bulk_commits[:5]:
                lines.append(f"  - `{bulk}`")

    if result.shared_skeletons:
        lines.append("")
        lines.append("### Shared Symbol Index")
        for skel in result.shared_skeletons:
            lines.append(f"- **`{skel.path}`**:")
            for sym in skel.symbols:
                lines.append(f"  - `{sym}`")

    if result.gaps:
        lines.append("")
        lines.append("### Pre-Scan Gaps")
        for gap in result.gaps:
            lines.append(f"- {gap}")

    raw_digest = "\n".join(lines)
    return _truncate_utf8_to_budget(raw_digest, max_digest_bytes)


def render_partition_plan_markdown(plan: PartitionPlan) -> str:
    lines: List[str] = [
        "## Partition Plan",
        f"- **Mode**: `{plan.mode}`",
        f"- **Strategy**: `{plan.strategy}`",
        f"- **Reason**: {plan.reason}",
        f"- **Worker Count**: {len(plan.partitions)}",
    ]

    for idx, part in enumerate(plan.partitions, start=1):
        lines.append("")
        lines.append(f"### Worker {idx}: `{part.name}`")
        lines.append(f"- **Owned Prefixes**: {', '.join(f'`{p}`' for p in part.owned_prefixes)}")
        lines.append(f"- **Rationale**: {part.rationale}")
        lines.append("- **Assigned Files**:")
        for path in part.assigned_files:
            lines.append(f"  - `{path}`")

    return "\n".join(lines)


def render_markdown(result: PrescanResult, max_digest_bytes: int) -> str:
    digest = render_digest_markdown(result, max_digest_bytes)
    plan = render_partition_plan_markdown(result.partition_plan)
    return f"{digest}\n\n{plan}\n"


def run_prescan(
        repo_root: Path,
        is_git: bool,
        scope: Optional[str] = None,
        fanout_threshold: int = 120,
        max_workers: int = 4,
        max_recent: int = 60,
) -> PrescanResult:
    git_state = collect_git_state(repo_root, is_git)
    inventory, inv_gaps = collect_inventory(repo_root, is_git)
    tree_summary = summarize_tree(inventory)
    languages = detect_languages(inventory)
    references = extract_references(repo_root, inventory)
    recent = collect_recent_files(repo_root, inventory, is_git, max_recent=max_recent)
    git_patterns = collect_git_patterns(repo_root, is_git)
    shared_skeletons = extract_shared_skeletons(repo_root, inventory)

    all_gaps = list(inv_gaps) + list(recent.gaps)
    partition_plan = build_partition_plan(
        inventory=inventory,
        recent_files=recent.recent_files,
        workspace_globs=references.workspace_globs,
        scope=scope,
        fanout_threshold=fanout_threshold,
        max_workers=max_workers,
        gaps=all_gaps,
    )

    return PrescanResult(
        repo_name=repo_root.name,
        repo_root=str(repo_root),
        scope=scope,
        git_state=git_state,
        total_inventory_files=len(inventory),
        languages=languages,
        tree_summary=tree_summary,
        references=references,
        recent=recent,
        git_patterns=git_patterns,
        shared_skeletons=shared_skeletons,
        partition_plan=partition_plan,
        gaps=all_gaps,
    )


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Collect shared repository digest and disjoint worker partitions for new::project-scout."
    )
    parser.add_argument("--repo", default=".", help="Path inside the target repository (default: .)")
    parser.add_argument("--scope", default=None, help="Optional subsystem path or query to focus on")
    parser.add_argument("--out", default=None, help="External output path outside the target repository")
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Output format (default: markdown)",
    )
    parser.add_argument(
        "--fanout-threshold",
        type=int,
        default=120,
        help="Minimum code files required to fan out a single-package repository (default: 120)",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=4,
        help="Maximum worker partitions in fan-out mode (default: 4)",
    )
    parser.add_argument(
        "--max-recent",
        type=int,
        default=60,
        help="Maximum recency-ranked files to retain (default: 60)",
    )
    parser.add_argument(
        "--max-digest-bytes",
        type=int,
        default=12000,
        help="UTF-8 byte cap for Shared Repo Digest in markdown mode (default: 12000)",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)

    try:
        repo_root, is_git = resolve_repo_root(args.repo)
        out_path = validate_out_path(args.out, repo_root)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    result = run_prescan(
        repo_root=repo_root,
        is_git=is_git,
        scope=args.scope,
        fanout_threshold=args.fanout_threshold,
        max_workers=args.max_workers,
        max_recent=args.max_recent,
    )

    if args.format == "json":
        payload = asdict(result)
        payload["shared_digest_markdown"] = render_digest_markdown(result, args.max_digest_bytes)
        output_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    else:
        output_text = render_markdown(result, args.max_digest_bytes)

    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output_text, encoding="utf-8")
    else:
        sys.stdout.write(output_text)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
