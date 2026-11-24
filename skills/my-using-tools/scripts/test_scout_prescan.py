#!/usr/bin/env python3
"""Unit tests for scout_prescan.py covering invariants, modes, and fallbacks."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import scout_prescan


def _git(repo: Path, *args: str) -> str:
    proc = subprocess.run(
        ["git", "-C", str(repo), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True,
    )
    return proc.stdout


def _init_git_repo(repo: Path) -> None:
    _git(repo, "init")
    _git(repo, "config", "user.name", "Test Author")
    _git(repo, "config", "user.email", "test@example.com")


def _write_files(repo: Path, files: dict[str, str]) -> None:
    for rel, content in files.items():
        target = repo / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


class ScoutPrescanTests(unittest.TestCase):
    def test_secret_exclusion_keeps_templates_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "secret-repo"
            repo.mkdir()
            _init_git_repo(repo)
            _write_files(
                repo,
                {
                    "README.md": "# Secret Repo\n",
                    ".env.example": "PORT=3000\n",
                    ".env": "SECRET=do-not-leak\n",
                    ".env.local": "SECRET=local-leak\n",
                    "certs/tls.pem": "PRIVATE KEY DATA\n",
                    "keys/id_rsa": "RSA PRIVATE KEY\n",
                    ".npmrc": "//registry.npmjs.org/:_authToken=secret\n",
                    "config/service-account-prod.json": '{"private_key": "secret"}\n',
                    ".aws/credentials": "[default]\naws_secret_access_key=secret\n",
                    "src/app.py": "def run() -> int:\n    return 1\n",
                },
            )
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "feat: add sample files")

            result = scout_prescan.run_prescan(repo, is_git=True)
            digest = scout_prescan.render_digest_markdown(result, 12000)

            inventory, _ = scout_prescan.collect_inventory(repo, is_git=True)
            self.assertIn(".env.example", inventory)
            self.assertIn("src/app.py", inventory)

            excluded = (
                ".env",
                ".env.local",
                "certs/tls.pem",
                "keys/id_rsa",
                ".npmrc",
                "config/service-account-prod.json",
                ".aws/credentials",
            )
            assigned_all = [
                f for part in result.partition_plan.partitions for f in part.assigned_files
            ]
            for secret_path in excluded:
                self.assertNotIn(secret_path, inventory)
                self.assertNotIn(secret_path, assigned_all)
                self.assertNotIn(secret_path, digest)
            self.assertNotIn("do-not-leak", digest)
            self.assertNotIn("aws_secret_access_key", digest)

    def test_out_guard_rejects_in_repo_and_allows_external(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            repo = base / "repo"
            external_dir = base / "external"
            repo.mkdir()
            external_dir.mkdir()
            _init_git_repo(repo)
            _write_files(repo, {"src/main.py": "print('ok')\n"})
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "init")

            in_repo_out = repo / "scout-out.md"
            proc_fail = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIR / "scout_prescan.py"),
                    "--repo",
                    str(repo),
                    "--out",
                    str(in_repo_out),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
            self.assertNotEqual(proc_fail.returncode, 0)
            self.assertFalse(in_repo_out.exists())

            ext_out = external_dir / "prescan.md"
            proc_ok = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIR / "scout_prescan.py"),
                    "--repo",
                    str(repo),
                    "--out",
                    str(ext_out),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
            self.assertEqual(proc_ok.returncode, 0, proc_ok.stderr)
            self.assertTrue(ext_out.is_file())
            self.assertIn("## Shared Repo Digest", ext_out.read_text(encoding="utf-8"))

    def test_small_repo_selects_single_mode(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "small-repo"
            repo.mkdir()
            _init_git_repo(repo)
            files = {
                "README.md": "# Small Repo\n\nSimple service.\n",
                "pyproject.toml": '[project]\nname = "small-repo"\nversion = "0.1.0"\n',
                "tests/test_core.py": "def test_ok():\n    assert True\n",
            }
            for idx in range(7):
                files[f"src/mod_{idx}.py"] = f"def fn_{idx}() -> int:\n    return {idx}\n"
            _write_files(repo, files)
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "feat: initialize small repo")

            result = scout_prescan.run_prescan(repo, is_git=True)
            self.assertEqual(result.partition_plan.mode, "single")
            self.assertEqual(result.partition_plan.strategy, "direct")
            self.assertEqual(len(result.partition_plan.partitions), 1)
            self.assertTrue(result.git_state.is_git)
            self.assertTrue(result.git_patterns.commit_subjects)
            self.assertIn("feat: initialize small repo", result.git_patterns.commit_subjects[0])

    def test_monorepo_selects_subsystem_fanout_with_shared_skeletons_and_no_overlap(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "mono"
            repo.mkdir()
            _init_git_repo(repo)

            files = {
                "package.json": json.dumps(
                    {
                        "name": "mono",
                        "private": True,
                        "workspaces": ["apps/*", "services/*", "packages/*"],
                        "scripts": {"test": "pnpm -r test"},
                    }
                ),
            }
            for idx in range(18):
                files[f"apps/web/src/page_{idx}.ts"] = f"export function page{idx}() {{ return {idx}; }}\n"
                files[f"services/api/src/route_{idx}.ts"] = f"export function route{idx}() {{ return {idx}; }}\n"
                files[f"packages/shared/src/model_{idx}.ts"] = (
                    f"export interface SharedModel{idx} {{\n  id: string;\n}}\n"
                    f"export function buildModel{idx}(id: string) {{ return {{ id }}; }}\n"
                )
            files["apps/web/src/page_0.test.ts"] = "test('page0', () => {});\n"
            files["services/api/src/route_0.test.ts"] = "test('route0', () => {});\n"
            _write_files(repo, files)
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "chore: scaffold monorepo")

            result = scout_prescan.run_prescan(repo, is_git=True)
            plan = result.partition_plan
            self.assertEqual(plan.mode, "fanout")
            self.assertEqual(plan.strategy, "subsystem")
            self.assertGreaterEqual(len(plan.partitions), 3)

            # Verify shared symbol skeletons extracted from packages/shared.
            skeleton_paths = [s.path for s in result.shared_skeletons]
            self.assertTrue(any(p.startswith("packages/shared/") for p in skeleton_paths))
            digest = scout_prescan.render_digest_markdown(result, 12000)
            self.assertIn("### Shared Symbol Index", digest)
            self.assertIn("export interface SharedModel", digest)

            # Verify pairwise disjoint assigned files and owned prefixes.
            seen_files: set[str] = set()
            seen_prefixes: set[str] = set()
            for part in plan.partitions:
                for path in part.assigned_files:
                    self.assertNotIn(path, seen_files)
                    seen_files.add(path)
                for pref in part.owned_prefixes:
                    self.assertNotIn(pref, seen_prefixes)
                    seen_prefixes.add(pref)

    def test_large_single_package_selects_concern_fanout_without_overlap(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "single-pkg"
            repo.mkdir()
            _init_git_repo(repo)
            files = {"package.json": '{"name": "single-pkg", "version": "1.0.0"}'}
            for idx in range(95):
                files[f"src/module_{idx:03d}.ts"] = f"export const val{idx} = {idx};\n"
            for idx in range(35):
                files[f"tests/module_{idx:03d}.test.ts"] = f"test('m{idx}', () => {{}});\n"
            _write_files(repo, files)
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "feat: add core modules and tests")

            result = scout_prescan.run_prescan(repo, is_git=True)
            plan = result.partition_plan
            self.assertEqual(plan.mode, "fanout")
            self.assertEqual(plan.strategy, "concern")

            by_name = {part.name: set(part.assigned_files) for part in plan.partitions}
            self.assertIn("production-core", by_name)
            self.assertIn("tests-and-fixtures", by_name)
            self.assertEqual(by_name["production-core"] & by_name["tests-and-fixtures"], set())
            self.assertTrue(all(p.startswith("src/") for p in by_name["production-core"]))
            self.assertTrue(all(p.startswith("tests/") for p in by_name["tests-and-fixtures"]))

    def test_scope_narrowing_switches_monorepo_to_single_mode(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "scoped-mono"
            repo.mkdir()
            _init_git_repo(repo)
            files = {"package.json": '{"workspaces": ["apps/*", "services/*", "packages/*"]}'}
            for idx in range(20):
                files[f"apps/web/src/view_{idx}.ts"] = f"export const view{idx} = {idx};\n"
                files[f"services/api/src/svc_{idx}.ts"] = f"export const svc{idx} = {idx};\n"
                files[f"packages/shared/src/lib_{idx}.ts"] = f"export const lib{idx} = {idx};\n"
            _write_files(repo, files)
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "feat: add workspaces")

            result = scout_prescan.run_prescan(repo, is_git=True, scope="apps/web")
            plan = result.partition_plan
            self.assertEqual(plan.mode, "single")
            self.assertEqual(plan.strategy, "scoped")
            assigned = plan.partitions[0].assigned_files
            self.assertTrue(assigned)
            self.assertTrue(all(p.startswith("apps/web/") for p in assigned))

    def test_bulk_commit_demotion_ranks_feature_commits_first(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "bulk-repo"
            repo.mkdir()
            _init_git_repo(repo)

            # Older normal feature commit touching 2 files.
            _write_files(
                repo,
                {
                    "src/feature_a.py": "def a() -> int:\n    return 1\n",
                    "src/feature_b.py": "def b() -> int:\n    return 2\n",
                },
            )
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "feat: implement core feature")

            # Newer bulk formatting commit touching 45 files.
            bulk_files = {
                f"src/bulk_{idx:02d}.py": f"VAL_{idx} = {idx}\n" for idx in range(45)
            }
            _write_files(repo, bulk_files)
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "style: bulk reformat 45 files")

            result = scout_prescan.run_prescan(repo, is_git=True, max_recent=60)
            self.assertEqual(result.recent.recent_files[:2], ["src/feature_a.py", "src/feature_b.py"])
            self.assertTrue(result.recent.bulk_commits)
            self.assertIn("bulk reformat 45 files", result.recent.bulk_commits[0])

    def test_non_git_directory_uses_mtime_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "plain-dir"
            repo.mkdir()
            _write_files(
                repo,
                {
                    "src/old.py": "x = 1\n",
                    "src/newer.py": "x = 2\n",
                    "src/newest.py": "x = 3\n",
                },
            )
            os.utime(repo / "src/old.py", (1000, 1000))
            os.utime(repo / "src/newer.py", (2000, 2000))
            os.utime(repo / "src/newest.py", (3000, 3000))

            resolved_root, is_git = scout_prescan.resolve_repo_root(str(repo))
            self.assertFalse(is_git)
            result = scout_prescan.run_prescan(resolved_root, is_git=is_git)
            self.assertFalse(result.git_state.is_git)
            self.assertEqual(result.git_state.status_summary, "Not a Git repository")
            self.assertEqual(
                result.recent.recent_files,
                ["src/newest.py", "src/newer.py", "src/old.py"],
            )
            self.assertTrue(any("mtime fallback" in g for g in result.gaps))

    def test_digest_byte_budget_caps_markdown_digest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "budget-repo"
            repo.mkdir()
            _init_git_repo(repo)
            _write_files(
                repo,
                {
                    "README.md": "\n".join(f"# Heading {i}\nDetail paragraph {i}." for i in range(40)),
                    "AGENTS.md": "\n".join(f"# Rule {i}\nMandatory rule {i}." for i in range(40)),
                    "CONTRIBUTING.md": "\n".join(f"# Contrib {i}\nStep {i}." for i in range(40)),
                    "ARCHITECTURE.md": "\n".join(f"# Arch {i}\nLayer {i}." for i in range(40)),
                    "package.json": json.dumps(
                        {
                            "name": "budget-repo",
                            "version": "1.0.0",
                            "scripts": {f"task-{i}": f"echo running task {i}" for i in range(20)},
                        }
                    ),
                    ".editorconfig": "\n".join(f"key_{i} = value_{i}" for i in range(30)),
                    "src/main.py": "def main():\n    pass\n",
                },
            )
            _git(repo, "add", ".")
            _git(repo, "commit", "-m", "docs: add large guides and configs")
            for idx in range(10):
                _write_files(repo, {f"src/mod_{idx}.py": f"VALUE = {idx}\n"})
                _git(repo, "add", ".")
                _git(repo, "commit", "-m", f"feat: add module {idx} with detailed commit subject")

            proc = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIR / "scout_prescan.py"),
                    "--repo",
                    str(repo),
                    "--max-digest-bytes",
                    "1500",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
            self.assertEqual(proc.returncode, 0, proc.stderr)
            digest_section, _, partition_section = proc.stdout.partition("\n\n## Partition Plan")
            self.assertTrue(partition_section)
            self.assertLessEqual(len(digest_section.encode("utf-8")), 1500)
            self.assertIn("[digest truncated to byte budget]", digest_section)


if __name__ == "__main__":
    unittest.main()
