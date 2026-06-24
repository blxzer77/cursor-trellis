#!/usr/bin/env python3
"""
Resolve how to invoke the smart-search CLI (argv prefix for subprocess).

No writes under .trellis/.runtime/. Optional per-machine override:
TRELLIS_SMART_SEARCH_COMMAND or smart_search.command in config.yaml.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from .config import get_smart_search_command_config
from .paths import get_repo_root


def _windows_candidates(stem: str) -> list[str]:
    if not sys.platform.startswith("win"):
        return [stem]
    return [f"{stem}.cmd", f"{stem}.bat", stem]


def _which_executable(name: str) -> str | None:
    for candidate in _windows_candidates(name):
        found = shutil.which(candidate)
        if found:
            return found
    return None


def _resolve_config_or_env(repo_root: Path) -> list[str] | None:
    env_cmd = os.environ.get("TRELLIS_SMART_SEARCH_COMMAND", "").strip()
    if env_cmd:
        if Path(env_cmd).is_file():
            return [env_cmd]
        found = _which_executable(env_cmd)
        if found:
            return [found]

    config_cmd = get_smart_search_command_config(repo_root)
    if config_cmd:
        if Path(config_cmd).is_file():
            return [config_cmd]
        found = _which_executable(config_cmd)
        if found:
            return [found]
    return None


def _node_script_argv(script: Path) -> list[str] | None:
    if not script.is_file():
        return None
    node = shutil.which("node") or shutil.which("node.exe")
    if not node:
        return None
    return [node, str(script.resolve())]


def _npm_local_wrappers(repo_root: Path) -> list[list[str]]:
    """Project-local npm installs (no global PATH)."""
    candidates: list[Path] = [
        repo_root / "node_modules" / ".bin" / "smart-search.js",
        repo_root
        / "node_modules"
        / "@blxzer"
        / "cursor-trellis"
        / "bin"
        / "smart-search.js",
        repo_root
        / "node_modules"
        / "@konbakuyomu"
        / "smart-search"
        / "npm"
        / "bin"
        / "smart-search.js",
    ]
    out: list[list[str]] = []
    for script in candidates:
        argv = _node_script_argv(script)
        if argv:
            out.append(argv)
    for stem in _windows_candidates("smart-search"):
        bin_path = repo_root / "node_modules" / ".bin" / stem
        if bin_path.is_file():
            out.append([str(bin_path.resolve())])
    return out


def _optional_repo_wrappers(repo_root: Path) -> list[list[str]]:
    """
    Optional repo-local layouts when PATH and node_modules resolution fail.

    Order is intentional: published npm co-install, standalone smart-search package,
    then maintainer polyrepo sibling checkouts (names vary by fork/upstream).
    """
    candidates: list[Path] = [
        repo_root
        / "node_modules"
        / "@blxzer"
        / "cursor-trellis"
        / "bin"
        / "smart-search.js",
        repo_root
        / "node_modules"
        / "@konbakuyomu"
        / "smart-search"
        / "npm"
        / "bin"
        / "smart-search.js",
        repo_root / "cursor-trellis" / "packages" / "cli" / "bin" / "smart-search.js",
        repo_root / "Trellis" / "packages" / "cli" / "bin" / "smart-search.js",
        repo_root / "smartsearch-private" / "npm" / "bin" / "smart-search.js",
    ]
    out: list[list[str]] = []
    for script in candidates:
        argv = _node_script_argv(script)
        if argv:
            out.append(argv)
    return out


def resolve_smart_search_argv(repo_root: Path | None = None) -> list[str] | None:
    """
    argv prefix to run smart-search, e.g. ``['smart-search.cmd']`` or
    ``['node', '.../smart-search.js']``. None if nothing resolvable.
    """
    root = repo_root or get_repo_root()

    from_env = _resolve_config_or_env(root)
    if from_env:
        return from_env

    found = _which_executable("smart-search")
    if found:
        return [found]

    for argv in _npm_local_wrappers(root):
        return argv

    for argv in _optional_repo_wrappers(root):
        return argv

    return None


def default_smart_search_argv(repo_root: Path | None = None) -> list[str]:
    return resolve_smart_search_argv(repo_root) or ["smart-search"]