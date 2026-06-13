#!/usr/bin/env python3
"""
Search Trellis workspace session memory.

This module parses `.trellis/workspace/<developer>/journal-*.md` files written
by add_session.py and returns compact, explainable memory results.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from .paths import DIR_WORKFLOW, DIR_WORKSPACE, FILE_JOURNAL_PREFIX, get_developer, get_repo_root


SECTION_NAMES = {"summary", "main changes", "git commits", "testing", "status", "next steps"}
FIELD_WEIGHTS = {
    "title": 8,
    "task": 8,
    "summary": 6,
    "next steps": 6,
    "main changes": 4,
    "commits": 3,
    "package": 3,
    "branch": 3,
    "path": 3,
}


@dataclass
class SessionEntry:
    developer: str
    session_number: int
    title: str
    date: str
    task: str
    package: str
    branch: str
    commits: list[str]
    sections: dict[str, str]
    path: Path
    rel_path: str
    line: int


@dataclass
class MemoryResult:
    entry: SessionEntry
    score: int
    matched_sections: set[str] = field(default_factory=set)
    matched_fields: set[str] = field(default_factory=set)
    reason_parts: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, object]:
        return {
            "version": 1,
            "source": "session-memory",
            "developer": self.entry.developer,
            "session": self.entry.session_number,
            "title": self.entry.title,
            "date": self.entry.date,
            "task": self.entry.task,
            "package": self.entry.package,
            "branch": self.entry.branch,
            "commits": self.entry.commits,
            "summary": normalize_space(self.entry.sections.get("summary", "")),
            "matchedSections": sorted(self.matched_sections),
            "matchedFields": sorted(self.matched_fields),
            "path": self.entry.rel_path,
            "line": self.entry.line,
            "score": self.score,
            "reason": "; ".join(self.reason_parts),
        }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search Trellis session memory journals.")
    parser.add_argument("--query", "-q", default="", help="Whitespace-token OR query.")
    parser.add_argument(
        "--developer",
        action="append",
        default=[],
        help="Developer workspace to search. Defaults to current developer, then all.",
    )
    parser.add_argument("--task", help="Filter by task/title substring.")
    parser.add_argument("--package", help="Filter by package substring.")
    parser.add_argument("--branch", help="Filter by branch substring.")
    parser.add_argument("--since", help="Filter sessions on or after YYYY-MM-DD.")
    parser.add_argument("--until", help="Filter sessions on or before YYYY-MM-DD.")
    parser.add_argument("--limit", type=int, default=10, help="Maximum results. Use 0 for no limit.")
    parser.add_argument("--json", action="store_true", help="Emit stable JSON.")
    parser.add_argument("--root", help="Repository root. Defaults to nearest parent with .trellis/.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.limit < 0:
        print("Error: --limit must be >= 0", file=sys.stderr)
        return 2

    repo_root = Path(args.root).resolve() if args.root else get_repo_root()
    results = search_memory(
        repo_root=repo_root,
        query=args.query,
        developers=args.developer,
        task_filter=args.task or "",
        package_filter=args.package or "",
        branch_filter=args.branch or "",
        since=args.since or "",
        until=args.until or "",
        limit=args.limit,
    )
    payload = {
        "query": args.query,
        "developers": args.developer,
        "filters": {
            "task": args.task or "",
            "package": args.package or "",
            "branch": args.branch or "",
            "since": args.since or "",
            "until": args.until or "",
        },
        "total": len(results),
        "results": [result.to_json() for result in results],
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print_human(payload)
    return 0


def search_memory(
    repo_root: Path,
    query: str,
    developers: list[str],
    task_filter: str,
    package_filter: str,
    branch_filter: str,
    since: str,
    until: str,
    limit: int,
) -> list[MemoryResult]:
    tokens = tokenize(query)
    results: list[MemoryResult] = []
    for entry in iter_session_entries(repo_root, developers):
        if task_filter and task_filter.lower() not in entry.task.lower() and task_filter.lower() not in entry.title.lower():
            continue
        if package_filter and package_filter.lower() not in entry.package.lower():
            continue
        if branch_filter and branch_filter.lower() not in entry.branch.lower():
            continue
        if since and entry.date and entry.date < since:
            continue
        if until and entry.date and entry.date > until:
            continue
        result = score_entry(entry, tokens)
        if result is not None:
            results.append(result)

    results.sort(key=lambda item: (-item.score, -item.entry.session_number, item.entry.rel_path, item.entry.line))
    if limit:
        return results[:limit]
    return results


def iter_session_entries(repo_root: Path, developers: list[str]) -> Iterable[SessionEntry]:
    workspace_root = repo_root / DIR_WORKFLOW / DIR_WORKSPACE
    if not workspace_root.is_dir():
        return

    selected_developers = developers or ([get_developer(repo_root)] if get_developer(repo_root) else [])
    developer_dirs: list[Path]
    if selected_developers:
        developer_dirs = [workspace_root / developer for developer in selected_developers if developer]
    else:
        developer_dirs = [path for path in sorted(workspace_root.iterdir()) if path.is_dir()]

    for developer_dir in developer_dirs:
        if not developer_dir.is_dir():
            continue
        developer = developer_dir.name
        for journal in sorted(developer_dir.glob(f"{FILE_JOURNAL_PREFIX}*.md"), key=journal_sort_key):
            yield from parse_journal(journal, repo_root, developer)


def journal_sort_key(path: Path) -> tuple[int, str]:
    match = re.search(r"(\d+)$", path.stem)
    return (int(match.group(1)) if match else 0, path.name)


def parse_journal(path: Path, repo_root: Path, developer: str) -> list[SessionEntry]:
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    entries: list[SessionEntry] = []
    current_start = 0
    current_header = ""
    current_lines: list[str] = []
    for index, line in enumerate(lines, start=1):
        if re.match(r"^## Session \d+:", line):
            if current_header:
                entries.append(build_entry(path, repo_root, developer, current_start, current_header, current_lines))
            current_start = index
            current_header = line
            current_lines = []
        elif current_header:
            current_lines.append(line)
    if current_header:
        entries.append(build_entry(path, repo_root, developer, current_start, current_header, current_lines))
    return entries


def build_entry(
    path: Path,
    repo_root: Path,
    developer: str,
    line: int,
    header: str,
    lines: list[str],
) -> SessionEntry:
    match = re.match(r"^## Session (\d+):\s*(.+?)\s*$", header)
    session_number = int(match.group(1)) if match else 0
    title = match.group(2).strip() if match else header.strip("# ")
    fields = extract_fields(lines)
    sections = extract_sections(lines)
    commits = extract_commits(sections.get("git commits", ""))
    return SessionEntry(
        developer=developer,
        session_number=session_number,
        title=title,
        date=fields.get("date", ""),
        task=fields.get("task", title),
        package=fields.get("package", ""),
        branch=fields.get("branch", ""),
        commits=commits,
        sections=sections,
        path=path,
        rel_path=to_repo_path(path, repo_root),
        line=line,
    )


def extract_fields(lines: list[str]) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in lines:
        match = re.match(r"^\*\*(Date|Task|Package|Branch)\*\*:\s*(.+?)\s*$", line)
        if not match:
            continue
        key = match.group(1).lower()
        value = match.group(2).strip()
        if key == "branch":
            value = value.strip("`")
        fields[key] = value
    return fields


def extract_sections(lines: list[str]) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in lines:
        heading = re.match(r"^###\s+(.+?)\s*$", line)
        if heading:
            name = heading.group(1).strip().lower()
            current = name if name in SECTION_NAMES else name
            sections.setdefault(current, [])
            continue
        if current:
            sections[current].append(line)
    return {key: "\n".join(value).strip() for key, value in sections.items()}


def extract_commits(content: str) -> list[str]:
    return sorted(set(re.findall(r"`?([a-f0-9]{7,40})`?", content, flags=re.IGNORECASE)))


def score_entry(entry: SessionEntry, tokens: list[str]) -> MemoryResult | None:
    result = MemoryResult(entry=entry, score=min(entry.session_number, 5))
    fields = searchable_fields(entry)
    if not tokens:
        result.reason_parts.append("recent session memory")
        return result

    matched_any = False
    for token in tokens:
        token_matched = False
        for field, value in fields:
            if token not in value.lower():
                continue
            token_matched = True
            matched_any = True
            result.score += FIELD_WEIGHTS.get(field, 2)
            if field in SECTION_NAMES:
                result.matched_sections.add(display_section_name(field))
            else:
                result.matched_fields.add(field)
        if token_matched:
            result.reason_parts.append(f"matched '{token}'")

    if not matched_any:
        return None
    if not result.reason_parts:
        result.reason_parts.append("matched session memory")
    return result


def searchable_fields(entry: SessionEntry) -> list[tuple[str, str]]:
    fields = [
        ("title", entry.title),
        ("task", entry.task),
        ("package", entry.package),
        ("branch", entry.branch),
        ("commits", " ".join(entry.commits)),
        ("path", entry.rel_path),
    ]
    for section, content in entry.sections.items():
        fields.append((section, content))
    return fields


def display_section_name(name: str) -> str:
    return " ".join(part.capitalize() for part in name.split())


def tokenize(query: str) -> list[str]:
    return [token.lower() for token in re.findall(r"\S+", query) if token.strip()]


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def to_repo_path(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return str(path)


def print_human(payload: dict[str, object]) -> None:
    results = payload["results"]
    if not isinstance(results, list) or not results:
        print("No session memory results.")
        return
    for index, raw in enumerate(results, start=1):
        if not isinstance(raw, dict):
            continue
        print(f"{index}. {raw.get('title')} ({raw.get('date') or 'unknown date'})")
        print(f"   Path: {raw.get('path')}:{raw.get('line')}")
        print(f"   Score: {raw.get('score')} - {raw.get('reason')}")
        summary = raw.get("summary")
        if summary:
            print(f"   Summary: {summary}")
