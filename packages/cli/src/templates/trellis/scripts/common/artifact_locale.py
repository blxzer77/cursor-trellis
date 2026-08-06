#!/usr/bin/env python3
"""Human-reviewed artifact locale resolution and PRD seed templates."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from .config import CONFIG_FILE
from .io import read_json, write_json
from .paths import DIR_TASKS, DIR_WORKFLOW, FILE_TASK_JSON, get_repo_root

VALID_LOCALES = ("zh", "en")
DEFAULT_LOCALE = "zh"

_ARTIFACT_LOCALE_KEY = "artifact_locale"
_ARTIFACT_LOCALE_LINE_RE = re.compile(
    r"^(\s*)artifact_locale\s*:\s*.*$",
    re.MULTILINE,
)


def normalize_locale(raw: object) -> str | None:
    """Return a supported locale code or None for invalid input."""
    if raw is None:
        return None
    value = str(raw).strip().lower()
    if value in VALID_LOCALES:
        return value
    return None


def _warn_invalid_locale(raw: object, *, context: str) -> None:
    print(
        f"[WARN] invalid artifact_locale {raw!r} in {context}; falling back",
        file=sys.stderr,
    )


def _read_workspace_locale_raw(repo_root: Path) -> str | None:
    from .config import _load_config

    config = _load_config(repo_root)
    return normalize_locale(config.get(_ARTIFACT_LOCALE_KEY))


def get_workspace_artifact_locale(repo_root: Path | None = None) -> str:
    """Return workspace-level artifact locale (default zh)."""
    root = repo_root or get_repo_root()
    return _read_workspace_locale_raw(root) or DEFAULT_LOCALE


def get_task_artifact_locale(task_dir: Path, repo_root: Path | None = None) -> str | None:
    """Return task.json meta override when valid."""
    _ = repo_root
    task_json = task_dir / FILE_TASK_JSON
    if not task_json.is_file():
        return None
    data = read_json(task_json)
    if not isinstance(data, dict):
        return None
    meta = data.get("meta")
    if not isinstance(meta, dict):
        return None
    raw = meta.get(_ARTIFACT_LOCALE_KEY)
    locale = normalize_locale(raw)
    if raw is not None and locale is None:
        _warn_invalid_locale(raw, context=str(task_json))
    return locale


def resolve_artifact_locale(task_dir: Path | None, repo_root: Path | None = None) -> str:
    """Resolve locale: task meta override, then workspace, then default zh."""
    root = repo_root or get_repo_root()
    if task_dir is not None:
        task_locale = get_task_artifact_locale(task_dir, root)
        if task_locale:
            return task_locale
    return get_workspace_artifact_locale(root)


def locale_template_dir(locale: str, repo_root: Path | None = None) -> Path:
    """Directory containing bundled PRD seed templates for a locale."""
    root = repo_root or get_repo_root()
    normalized = normalize_locale(locale) or DEFAULT_LOCALE
    return root / DIR_WORKFLOW / DIR_TASKS / "locale" / normalized


def _builtin_prd_template(locale: str) -> str:
    if locale == "zh":
        return """# {title}

## 目标

{goal}

## 需求

- 待补充

## 验收标准

- [ ] 待补充

## 备注

- `prd.md` 聚焦需求、约束与验收标准。
- 轻量任务可仅保留 PRD。
- 复杂任务在 `task.py start-execution --check` 前补充 `design.md` 与 `implement.md`。
"""
    return """# {title}

## Goal

{goal}

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start-execution --check`.
"""


def default_prd_content(
    title: str,
    description: str | None = None,
    locale: str | None = None,
    repo_root: Path | None = None,
) -> str:
    """Return the default PRD skeleton for task create."""
    root = repo_root or get_repo_root()
    resolved = normalize_locale(locale) or resolve_artifact_locale(None, root)
    template_path = locale_template_dir(resolved, root) / "default-prd.md"
    if template_path.is_file():
        template = template_path.read_text(encoding="utf-8")
    else:
        template = _builtin_prd_template(resolved)

    if resolved == "zh":
        goal = (description or "").strip() or "待补充。"
        heading = title.strip() or "未命名任务"
    else:
        goal = (description or "").strip() or "TBD."
        heading = title.strip() or "Untitled task"

    return template.replace("{title}", heading).replace("{goal}", goal)


def artifact_locale_summary(repo_root: Path | None = None, task_dir: Path | None = None) -> str:
    """One-line summary for session context."""
    root = repo_root or get_repo_root()
    locale = resolve_artifact_locale(task_dir, root)
    return (
        f"Artifact locale: {locale} — human-reviewed artifacts "
        f"(prd/design/implement/verify/handoff) use this language."
    )


def set_workspace_artifact_locale(locale: str, repo_root: Path | None = None) -> None:
    """Patch .cstl/config.yaml with artifact_locale (non-destructive)."""
    normalized = normalize_locale(locale)
    if not normalized:
        raise ValueError(f"artifact_locale must be one of: {', '.join(VALID_LOCALES)}")

    root = repo_root or get_repo_root()
    config_path = root / DIR_WORKFLOW / CONFIG_FILE
    replacement = f"artifact_locale: {normalized}"

    if config_path.is_file():
        content = config_path.read_text(encoding="utf-8")
        if _ARTIFACT_LOCALE_LINE_RE.search(content):
            content = _ARTIFACT_LOCALE_LINE_RE.sub(replacement, content, count=1)
        else:
            section = (
                "\n#-------------------------------------------------------------------------------\n"
                "# Human-reviewed artifact locale (zh | en)\n"
                "#-------------------------------------------------------------------------------\n"
                "# Language for prd/design/implement/verify/handoff and task create seeds.\n"
                "# Does NOT translate CLI UI or existing archived tasks.\n"
                f"\n{replacement}\n"
            )
            content = content.rstrip() + section
        config_path.write_text(content if content.endswith("\n") else content + "\n", encoding="utf-8")
        return

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(
        "# Trellis Configuration\n"
        f"{replacement}\n",
        encoding="utf-8",
    )


def set_task_artifact_locale(task_dir: Path, locale: str, repo_root: Path | None = None) -> None:
    """Write task.json meta.artifact_locale."""
    _ = repo_root
    normalized = normalize_locale(locale)
    if not normalized:
        raise ValueError(f"artifact_locale must be one of: {', '.join(VALID_LOCALES)}")

    task_json = task_dir / FILE_TASK_JSON
    if not task_json.is_file():
        raise FileNotFoundError(f"task.json not found: {task_json}")

    data = read_json(task_json)
    if not isinstance(data, dict):
        raise ValueError(f"invalid task.json: {task_json}")

    meta = data.get("meta")
    if not isinstance(meta, dict):
        meta = {}
    meta[_ARTIFACT_LOCALE_KEY] = normalized
    data["meta"] = meta
    write_json(task_json, data)
