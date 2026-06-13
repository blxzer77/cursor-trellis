#!/usr/bin/env python3
"""
Search durable Trellis markdown artifacts.

This module is intentionally dependency-free because it is generated into user
projects as part of the Trellis Python runtime.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from .paths import DIR_TASKS, DIR_WORKFLOW, DIR_WORKSPACE, get_repo_root


MAX_SNIPPETS = 3
VALID_CATEGORIES = {"spec", "task", "workspace"}
VALID_KINDS = {
    "spec",
    "task_prd",
    "task_design",
    "task_implement",
    "task_research",
    "task_verify",
    "task_handoff",
    "task_artifact",
    "workspace",
}


@dataclass
class Artifact:
    path: Path
    rel_path: str
    kind: str
    category: str
    frontmatter: dict[str, object]
    body: str
    body_start_line: int
    title: str | None
    headings: list[tuple[int, str, str]]


@dataclass
class FilterSpec:
    raw: str
    key: str
    op: str
    values: list[str]


@dataclass
class Snippet:
    line: int
    text: str
    anchor: str | None = None

    def to_json(self) -> dict[str, object]:
        data: dict[str, object] = {"line": self.line, "text": self.text}
        if self.anchor:
            data["anchor"] = self.anchor
        return data


@dataclass
class SearchResult:
    artifact: Artifact
    score: int
    matched_fields: set[str] = field(default_factory=set)
    snippets: list[Snippet] = field(default_factory=list)

    def to_json(self) -> dict[str, object]:
        return {
            "path": self.artifact.rel_path,
            "kind": self.artifact.kind,
            "category": self.artifact.category,
            "title": self.artifact.title,
            "frontmatter": self.artifact.frontmatter,
            "matched_fields": sorted(self.matched_fields),
            "snippets": [snippet.to_json() for snippet in self.snippets],
            "score": self.score,
        }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search local .trellis markdown artifacts.",
    )
    parser.add_argument(
        "--query",
        "-q",
        default="",
        help="Whitespace-token AND query over path, title, headings, frontmatter, and body.",
    )
    parser.add_argument(
        "--filter",
        action="append",
        default=[],
        help="Frontmatter filter: key=value or key~=substring. Use a|b for OR values.",
    )
    parser.add_argument(
        "--kind",
        action="append",
        choices=sorted(VALID_KINDS),
        default=[],
        help="Restrict to an artifact kind. May be repeated.",
    )
    parser.add_argument(
        "--category",
        action="append",
        choices=sorted(VALID_CATEGORIES),
        default=[],
        help="Restrict to an artifact category. May be repeated.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Maximum results to return. Use 0 for no limit.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit stable JSON for agents and tests.",
    )
    parser.add_argument(
        "--root",
        help="Repository root. Defaults to nearest parent containing .trellis/.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        filters = [parse_filter(raw) for raw in args.filter]
    except ValueError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    if args.limit < 0:
        print("Error: --limit must be >= 0", file=sys.stderr)
        return 2

    repo_root = Path(args.root).resolve() if args.root else get_repo_root()
    results = search_artifacts(
        repo_root=repo_root,
        query=args.query,
        filters=filters,
        kinds=set(args.kind),
        categories=set(args.category),
        limit=args.limit,
    )

    payload = {
        "query": args.query,
        "filters": args.filter,
        "kinds": args.kind,
        "categories": args.category,
        "total": len(results),
        "results": [result.to_json() for result in results],
    }

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print_human(payload)

    return 0


def search_artifacts(
    repo_root: Path,
    query: str,
    filters: list[FilterSpec],
    kinds: set[str],
    categories: set[str],
    limit: int,
) -> list[SearchResult]:
    tokens = tokenize(query)
    results: list[SearchResult] = []

    for path in iter_artifact_paths(repo_root):
        artifact = load_artifact(path, repo_root)
        if artifact is None:
            continue
        if kinds and artifact.kind not in kinds:
            continue
        if categories and artifact.category not in categories:
            continue

        filter_fields = matched_filter_fields(artifact, filters)
        if filter_fields is None:
            continue

        result = score_artifact(artifact, tokens)
        if result is None:
            continue

        result.matched_fields.update(filter_fields)
        if filter_fields and not tokens:
            result.score += len(filter_fields)
        if not result.snippets:
            result.snippets = fallback_snippets(artifact)
        results.append(result)

    results.sort(key=lambda item: (-item.score, item.artifact.rel_path))
    if limit:
        return results[:limit]
    return results


def iter_artifact_paths(repo_root: Path) -> Iterable[Path]:
    roots = [
        repo_root / DIR_WORKFLOW / "spec",
        repo_root / DIR_WORKFLOW / DIR_TASKS,
        repo_root / DIR_WORKFLOW / DIR_WORKSPACE,
    ]
    seen: set[Path] = set()
    for root in roots:
        if not root.is_dir():
            continue
        for path in sorted(root.rglob("*.md"), key=lambda item: item.as_posix()):
            if not path.is_file():
                continue
            resolved = path.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            yield path


def load_artifact(path: Path, repo_root: Path) -> Artifact | None:
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None

    rel_path = to_repo_path(path, repo_root)
    kind = classify_kind(rel_path)
    if kind is None:
        return None

    frontmatter, body, body_start_line = split_frontmatter(content)
    headings = extract_headings(body, body_start_line)
    title = discover_title(frontmatter, headings)
    category = category_for_kind(kind)
    return Artifact(
        path=path,
        rel_path=rel_path,
        kind=kind,
        category=category,
        frontmatter=frontmatter,
        body=body,
        body_start_line=body_start_line,
        title=title,
        headings=headings,
    )


def to_repo_path(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def classify_kind(rel_path: str) -> str | None:
    normalized = rel_path.replace("\\", "/")
    if normalized.startswith(f"{DIR_WORKFLOW}/spec/"):
        return "spec"
    if normalized.startswith(f"{DIR_WORKFLOW}/{DIR_WORKSPACE}/"):
        return "workspace"
    if not normalized.startswith(f"{DIR_WORKFLOW}/{DIR_TASKS}/"):
        return None

    name = normalized.rsplit("/", 1)[-1]
    if "/research/" in normalized:
        return "task_research"
    if name == "prd.md":
        return "task_prd"
    if name == "design.md":
        return "task_design"
    if name == "implement.md":
        return "task_implement"
    if name == "verify.md":
        return "task_verify"
    if name == "handoff.md":
        return "task_handoff"
    return "task_artifact"


def category_for_kind(kind: str) -> str:
    if kind == "spec":
        return "spec"
    if kind == "workspace":
        return "workspace"
    return "task"


def split_frontmatter(content: str) -> tuple[dict[str, object], str, int]:
    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, content, 1

    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            frontmatter_lines = lines[1:idx]
            body_lines = lines[idx + 1 :]
            frontmatter = parse_frontmatter(frontmatter_lines)
            return frontmatter, "\n".join(body_lines), idx + 2

    return {}, content, 1


def parse_frontmatter(lines: list[str]) -> dict[str, object]:
    data: dict[str, object] = {}
    current_list_key: str | None = None

    for raw_line in lines:
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        stripped = raw_line.strip()
        if stripped.startswith("- "):
            if current_list_key is None:
                continue
            value = unquote(stripped[2:].strip())
            items = data.setdefault(current_list_key, [])
            if isinstance(items, list):
                items.append(value)
            continue

        if ":" not in stripped:
            current_list_key = None
            continue

        key, value = stripped.split(":", 1)
        key = key.strip()
        value = strip_inline_comment(value).strip()
        if not key:
            current_list_key = None
            continue
        if value:
            data[key] = unquote(value)
            current_list_key = None
        else:
            data[key] = []
            current_list_key = key

    return data


def strip_inline_comment(value: str) -> str:
    in_quote: str | None = None
    for idx, char in enumerate(value):
        if in_quote:
            if char == in_quote:
                in_quote = None
            continue
        if char in ("'", '"'):
            in_quote = char
            continue
        if char == "#" and (idx == 0 or value[idx - 1].isspace()):
            return value[:idx]
    return value


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


def extract_headings(body: str, body_start_line: int) -> list[tuple[int, str, str]]:
    headings: list[tuple[int, str, str]] = []
    for offset, line in enumerate(body.splitlines()):
        match = re.match(r"^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$", line)
        if not match:
            continue
        text = normalize_space(match.group(1))
        headings.append((body_start_line + offset, text, slugify_heading(text)))
    return headings


def discover_title(
    frontmatter: dict[str, object],
    headings: list[tuple[int, str, str]],
) -> str | None:
    raw_title = frontmatter.get("title")
    if isinstance(raw_title, str) and raw_title.strip():
        return raw_title.strip()
    for _, heading, _ in headings:
        return heading
    return None


def parse_filter(raw: str) -> FilterSpec:
    op = "~=" if "~=" in raw else "="
    if op not in raw:
        raise ValueError(f"invalid filter {raw!r}; expected key=value or key~=value")
    key, value = raw.split(op, 1)
    key = key.strip()
    values = [item.strip() for item in value.split("|") if item.strip()]
    if not key or not values:
        raise ValueError(f"invalid filter {raw!r}; expected key=value or key~=value")
    return FilterSpec(raw=raw, key=key, op=op, values=values)


def matched_filter_fields(
    artifact: Artifact,
    filters: list[FilterSpec],
) -> set[str] | None:
    matched: set[str] = set()
    for item in filters:
        raw_value = artifact.frontmatter.get(item.key)
        values = normalized_values(raw_value)
        if not values:
            return None
        if item.op == "=":
            ok = any(value == candidate for value in values for candidate in lower_all(item.values))
        else:
            ok = any(candidate in value for value in values for candidate in lower_all(item.values))
        if not ok:
            return None
        matched.add(f"frontmatter.{item.key}")
    return matched


def score_artifact(artifact: Artifact, tokens: list[str]) -> SearchResult | None:
    if not tokens:
        return SearchResult(artifact=artifact, score=0)

    field_values = searchable_fields(artifact)
    combined = "\n".join(value for _, value in field_values).lower()
    if any(token not in combined for token in tokens):
        return None

    result = SearchResult(artifact=artifact, score=0)
    for token in tokens:
        if token in artifact.rel_path.lower():
            result.score += 8
            result.matched_fields.add("path")
        if artifact.title and token in artifact.title.lower():
            result.score += 7
            result.matched_fields.add("title")
        for key, value in artifact.frontmatter.items():
            if any(token in item for item in normalized_values(value)):
                result.score += 6
                result.matched_fields.add(f"frontmatter.{key}")
        if any(token in heading.lower() for _, heading, _ in artifact.headings):
            result.score += 4
            result.matched_fields.add("headings")
        if token in artifact.body.lower():
            result.score += 2
            result.matched_fields.add("body")

    result.snippets = query_snippets(artifact, tokens)
    return result


def searchable_fields(artifact: Artifact) -> list[tuple[str, str]]:
    frontmatter = " ".join(flatten_frontmatter_values(artifact.frontmatter))
    headings = " ".join(heading for _, heading, _ in artifact.headings)
    return [
        ("path", artifact.rel_path),
        ("title", artifact.title or ""),
        ("frontmatter", frontmatter),
        ("headings", headings),
        ("body", artifact.body),
    ]


def query_snippets(artifact: Artifact, tokens: list[str]) -> list[Snippet]:
    snippets: list[Snippet] = []
    seen_lines: set[int] = set()
    current_anchor: str | None = None
    heading_by_line = {line: anchor for line, _, anchor in artifact.headings}

    for offset, raw_line in enumerate(artifact.body.splitlines()):
        line_number = artifact.body_start_line + offset
        if line_number in heading_by_line:
            current_anchor = heading_by_line[line_number]
        line = normalize_space(raw_line)
        if not line:
            continue
        lower = line.lower()
        if not any(token in lower for token in tokens):
            continue
        if line_number in seen_lines:
            continue
        snippets.append(Snippet(line=line_number, text=line, anchor=current_anchor))
        seen_lines.add(line_number)
        if len(snippets) >= MAX_SNIPPETS:
            break

    return snippets


def fallback_snippets(artifact: Artifact) -> list[Snippet]:
    current_anchor: str | None = None
    heading_by_line = {line: anchor for line, _, anchor in artifact.headings}
    for offset, raw_line in enumerate(artifact.body.splitlines()):
        line_number = artifact.body_start_line + offset
        if line_number in heading_by_line:
            current_anchor = heading_by_line[line_number]
        text = normalize_space(raw_line)
        if text:
            return [Snippet(line=line_number, text=text, anchor=current_anchor)]
    return []


def tokenize(query: str) -> list[str]:
    return [token.lower() for token in re.findall(r"\S+", query) if token.strip()]


def lower_all(values: Iterable[str]) -> list[str]:
    return [value.lower() for value in values]


def normalized_values(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).lower() for item in value]
    if value is None:
        return []
    return [str(value).lower()]


def flatten_frontmatter_values(frontmatter: dict[str, object]) -> list[str]:
    values: list[str] = []
    for key, value in frontmatter.items():
        values.append(key)
        if isinstance(value, list):
            values.extend(str(item) for item in value)
        elif value is not None:
            values.append(str(value))
    return values


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def slugify_heading(value: str) -> str:
    slug = re.sub(r"[^a-z0-9\s-]", "", value.lower())
    return re.sub(r"[\s-]+", "-", slug).strip("-")


def print_human(payload: dict[str, object]) -> None:
    total = int(payload["total"])
    noun = "artifact" if total == 1 else "artifacts"
    print(f"Found {total} {noun}")
    print()

    results = payload["results"]
    if not isinstance(results, list):
        return

    for idx, result in enumerate(results, start=1):
        if not isinstance(result, dict):
            continue
        print(
            f"{idx}. {result['path']} [{result['kind']}] "
            f"score={result['score']}"
        )
        title = result.get("title")
        if title:
            print(f"   title: {title}")
        matched = result.get("matched_fields")
        if isinstance(matched, list) and matched:
            print(f"   matched: {', '.join(str(item) for item in matched)}")
        snippets = result.get("snippets")
        if isinstance(snippets, list):
            for snippet in snippets:
                if not isinstance(snippet, dict):
                    continue
                print(f"   L{snippet.get('line')}: {snippet.get('text')}")


if __name__ == "__main__":
    sys.exit(main())

