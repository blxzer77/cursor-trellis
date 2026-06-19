#!/usr/bin/env python3
"""
Deterministic codebase retrieval intent router (Python template).

Mirrors packages/cli/src/utils/codebase-retrieval-router.ts for dogfood and
get_context retrieval-pack flows. Does not invoke rg, MCP, or network tools.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROUTER_VERSION = 1

INTENT_EXACT = "exact-symbol-path"
INTENT_POLICY = "policy-document"
INTENT_CALLER = "caller-chain"
INTENT_TRAP = "trap-package-disambiguation"
INTENT_EXTENSION = "extension-shared-symbol"
INTENT_ENV = "env-config-literal"
INTENT_PRESERVE = "protocol-platform-preserve"
INTENT_CONCEPTUAL = "cross-cutting-discovery"

POLICY_PATTERNS = [
    re.compile(r"\bstorage\s+policy\b", re.I),
    re.compile(r"\bsidecar\b", re.I),
    re.compile(r"\bsqlite\s+only\b", re.I),
    re.compile(r"\bpersistence\b", re.I),
    re.compile(r"\bimport\s+boundar", re.I),
    re.compile(r"\btransport[- ]only\b", re.I),
    re.compile(r"\barchitecture\b", re.I),
    re.compile(r"\bconvention(s)?\b", re.I),
    re.compile(r"\bforbidden\b", re.I),
    re.compile(r"\ballowed\b", re.I),
    re.compile(r"规定"),
    re.compile(r"边界"),
    re.compile(r"为什么不能"),
    re.compile(r"\bAGENTS\.md\b", re.I),
    re.compile(r"\bpolicy\b", re.I),
    re.compile(r"\bownership\b", re.I),
    re.compile(r"\bresponsibilit(y|ies)\b", re.I),
    re.compile(r"不能"),
    re.compile(r"规则"),
]

CONCEPTUAL_PATTERNS = [
    re.compile(r"\bhow\s+does\b", re.I),
    re.compile(r"\bacross\s+(packages|modules)\b", re.I),
    re.compile(r"\bwhere\s+is\b.*\b(handled|implemented)\b", re.I),
    re.compile(r"如何"),
    re.compile(r"机制"),
    re.compile(r"跨"),
]

PRESERVE_PATTERNS = [
    re.compile(r"\bapps/(ios|android)\b", re.I),
    re.compile(r"\bgateway-protocol\b", re.I),
    re.compile(r"\bpackages/gateway-protocol\b", re.I),
    re.compile(r"\.swift\b", re.I),
    re.compile(r"\.kt\b", re.I),
    re.compile(r"\bschema\b", re.I),
    re.compile(r"\bcontract\b", re.I),
    re.compile(r"\bprotocol\s+constant\b", re.I),
]

CALLER_PATTERNS = [
    re.compile(r"\bwho\s+calls\b", re.I),
    re.compile(r"\bwhich\s+modules?\s+invoke\b", re.I),
    re.compile(r"\bcall\s*sites?\b", re.I),
    re.compile(r"\bcaller(s)?\b", re.I),
    re.compile(r"\bwired\b", re.I),
    re.compile(r"\bdelegate(s|d)?\b", re.I),
    re.compile(r"\bassembly\b", re.I),
    re.compile(r"谁调用"),
    re.compile(r"调用链"),
]

TRAP_PATTERNS = [
    re.compile(r"\bpackages/[a-z0-9-]+\b", re.I),
    re.compile(r"\bsrc/agents\b", re.I),
    re.compile(r"\btrap\b", re.I),
    re.compile(r"\bdifferent\s+package\b", re.I),
    re.compile(r"\blayer\b", re.I),
    re.compile(r"\boverlay\b", re.I),
    re.compile(r"\bcore\s+library\b", re.I),
]

EXTENSION_PATTERNS = [
    re.compile(r"\bextensions/\b", re.I),
    re.compile(r"\bextension\s+id\b", re.I),
    re.compile(r"\bshared\s+symbol\b", re.I),
    re.compile(r"\bacross\s+extensions\b", re.I),
]

ENV_PATTERNS = [
    re.compile(r"\bOPENCLAW_[A-Z0-9_]+\b"),
    re.compile(r"\be2e\b", re.I),
    re.compile(r"\bbench(mark)?\b", re.I),
    re.compile(r"\benv\s+var", re.I),
    re.compile(r"\benvironment\s+variable\b", re.I),
    re.compile(r"\bstartup\s+script\b", re.I),
]

EXACT_PATTERNS = [
    re.compile(r"\b[A-Z][a-zA-Z0-9]+(?:[A-Z][a-zA-Z0-9]+)+\b"),
    re.compile(r"\b[a-z][a-zA-Z0-9]+(?:[A-Z][a-zA-Z0-9]+)+\b"),
    re.compile(r"`[^`]+`"),
    re.compile(r"\b[\w.-]+\.(ts|tsx|js|jsx|py|rs|go|swift|kt|md|json|yaml|yml)\b", re.I),
    re.compile(r"\b(?:src|packages|extensions)/[\w./-]+", re.I),
]


def _normalize_query(query: str) -> str:
    return " ".join(query.split())


def _match_any(patterns: list[re.Pattern[str]], text: str) -> list[str]:
    hits: list[str] = []
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            hits.append(match.group(0))
    return hits


def _confidence(hit_count: int, strong: bool) -> str:
    if strong and hit_count >= 2:
        return "high"
    if hit_count >= 2:
        return "medium"
    if hit_count == 1:
        return "medium" if strong else "low"
    return "low"


def _intent(
    intent_id: str,
    label: str,
    signals: list[str],
    confidence: str,
    preserve_exact_primary: bool,
) -> dict[str, object]:
    unique_signals = list(dict.fromkeys(signals))[:12]
    return {
        "id": intent_id,
        "label": label,
        "confidence": confidence,
        "signals": unique_signals,
        "preserveExactPrimary": preserve_exact_primary,
    }


def _classify_intents(query: str) -> list[dict[str, object]]:
    intents: list[dict[str, object]] = []

    preserve_hits = _match_any(PRESERVE_PATTERNS, query)
    if preserve_hits:
        intents.append(
            _intent(
                INTENT_PRESERVE,
                "Protocol / platform preserve (F/G)",
                preserve_hits,
                _confidence(len(preserve_hits), True),
                True,
            )
        )

    exact_hits = _match_any(EXACT_PATTERNS, query)
    if exact_hits:
        intents.append(
            _intent(
                INTENT_EXACT,
                "Exact symbol or path",
                exact_hits,
                _confidence(len(exact_hits), True),
                True,
            )
        )

    policy_hits = _match_any(POLICY_PATTERNS, query)
    if policy_hits:
        intents.append(
            _intent(
                INTENT_POLICY,
                "Policy and document-first (C-class)",
                policy_hits,
                _confidence(len(policy_hits), False),
                False,
            )
        )

    caller_hits = _match_any(CALLER_PATTERNS, query)
    if caller_hits:
        intents.append(
            _intent(
                INTENT_CALLER,
                "Caller and assembly chain (B-class)",
                caller_hits,
                _confidence(len(caller_hits), False),
                False,
            )
        )

    trap_hits = _match_any(TRAP_PATTERNS, query)
    if trap_hits:
        intents.append(
            _intent(
                INTENT_TRAP,
                "Trap demotion and package boundary (E-class)",
                trap_hits,
                _confidence(len(trap_hits), False),
                False,
            )
        )

    extension_hits = _match_any(EXTENSION_PATTERNS, query)
    if extension_hits:
        intents.append(
            _intent(
                INTENT_EXTENSION,
                "Extension shared-symbol disambiguation (A-class)",
                extension_hits,
                _confidence(len(extension_hits), False),
                False,
            )
        )

    env_hits = _match_any(ENV_PATTERNS, query)
    if env_hits:
        intents.append(
            _intent(
                INTENT_ENV,
                "Environment and config literals (D-class)",
                env_hits,
                _confidence(len(env_hits), False),
                False,
            )
        )

    if not exact_hits and not preserve_hits:
        conceptual_hits = _match_any(CONCEPTUAL_PATTERNS, query)
        if conceptual_hits:
            intents.append(
                _intent(
                    INTENT_CONCEPTUAL,
                    "Conceptual / cross-cutting discovery",
                    conceptual_hits,
                    _confidence(len(conceptual_hits), False),
                    False,
                )
            )

    if not intents:
        intents.append(
            _intent(
                INTENT_EXACT,
                "General codebase (exact baseline)",
                ["default-exact-baseline"],
                "low",
                True,
            )
        )

    seen: set[str] = set()
    deduped: list[dict[str, object]] = []
    for item in intents:
        intent_id = str(item["id"])
        if intent_id in seen:
            continue
        seen.add(intent_id)
        deduped.append(item)
    return deduped


def _base_verification() -> list[dict[str, object]]:
    return [
        {
            "id": "source-read",
            "requirement": "Read current source around candidate file ranges before final claims.",
            "appliesToRoles": ["exact", "ast", "lsp", "semantic"],
        },
        {
            "id": "git-scope",
            "requirement": "Inspect relevant Git diff/log evidence when behavior or impact is claimed.",
            "appliesToRoles": ["verification"],
        },
        {
            "id": "focused-tests",
            "requirement": "Run task-appropriate validation when tests define the claim boundary.",
            "appliesToRoles": ["verification"],
        },
    ]


def _verification_for_intents(intents: list[dict[str, object]]) -> list[dict[str, object]]:
    ids = {str(item["id"]) for item in intents}
    if INTENT_POLICY in ids:
        return [
            {
                "id": "policy-doc-top1",
                "requirement": (
                    "For policy/document intents, confirm Top-1 policy evidence from "
                    "AGENTS.md or .trellis/spec before ranking implementation modules first."
                ),
                "appliesToRoles": ["exact", "semantic"],
            },
            *_base_verification(),
        ]
    if INTENT_CALLER in ids:
        return [
            {
                "id": "caller-sites",
                "requirement": (
                    "Collect concrete call sites before treating a helper/loader file as sufficient Top-1."
                ),
                "appliesToRoles": ["exact", "ast"],
            },
            *_base_verification(),
        ]
    return _base_verification()


def _ordered_routes(
    intents: list[dict[str, object]],
    include_optional_adapters: bool,
) -> list[dict[str, object]]:
    ids = {str(item["id"]) for item in intents}
    active = list(ids)
    preserve = INTENT_PRESERVE in ids
    policy = INTENT_POLICY in ids
    caller = INTENT_CALLER in ids
    trap = INTENT_TRAP in ids
    extension = INTENT_EXTENSION in ids
    env = INTENT_ENV in ids
    exact = INTENT_EXACT in ids
    conceptual = INTENT_CONCEPTUAL in ids
    exact_primary_first = preserve or exact
    conceptual_primary = conceptual and not preserve and not exact_primary_first
    semantic_promoted = False

    routes: list[dict[str, object]] = []

    def append(route: dict[str, object]) -> None:
        routes.append({**route, "order": len(routes) + 1, "intentIds": active})

    if conceptual_primary:
        if policy:
            append(
                {
                    "id": "policy-docs-rg",
                    "role": "exact",
                    "sourceFamily": "policy-docs",
                    "commands": [
                        'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" '
                        "README.md CONTRIBUTING.md .trellis/spec"
                    ],
                    "rationale": "Policy/document intent: search instruction and spec docs first.",
                }
            )
        semantic_rationale = (
            "Policy plus conceptual intent: semantic recall after policy docs, before exact rg follow-up."
            if policy
            else "Conceptual query without exact signals; semantic recall before exact rg narrowing."
        )
        append(
            {
                "id": "semantic-fast-context",
                "role": "semantic",
                "sourceFamily": "fast-context",
                "commands": ["fast_context_search query=<question> project_path=<root>"],
                "rationale": semantic_rationale,
            }
        )
        semantic_promoted = True
        append(
            {
                "id": "exact-rg-primary",
                "role": "exact",
                "sourceFamily": "rg",
                "commands": ["rg <pattern> <path>"],
                "rationale": (
                    "Exact rg follow-up after semantic recall (or policy docs) "
                    "narrows candidate files and symbols."
                ),
            }
        )
    elif policy and not preserve and not exact_primary_first:
        append(
            {
                "id": "policy-docs-rg",
                "role": "exact",
                "sourceFamily": "policy-docs",
                "commands": [
                    'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" '
                    "README.md CONTRIBUTING.md .trellis/spec"
                ],
                "rationale": "Policy/document intent: search instruction and spec docs first.",
            }
        )
        append(
            {
                "id": "exact-rg-primary",
                "role": "exact",
                "sourceFamily": "rg",
                "commands": ["rg <pattern> <path>"],
                "rationale": "Exact rg after policy doc pass when no symbol/path intent is present.",
            }
        )
    elif exact_primary_first:
        append(
            {
                "id": "exact-rg-primary",
                "role": "exact",
                "sourceFamily": "rg",
                "commands": ["rg <pattern> <path>"],
                "rationale": "Exact identifiers and paths stay primary.",
            }
        )
        if policy and not preserve:
            append(
                {
                    "id": "policy-docs-rg",
                    "role": "exact",
                    "sourceFamily": "policy-docs",
                    "commands": [
                        'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" '
                        "README.md CONTRIBUTING.md .trellis/spec"
                    ],
                    "rationale": "Policy/document branch after exact-primary when both intents match.",
                }
            )

    if env and not preserve:
        append(
            {
                "id": "env-scripts-rg",
                "role": "exact",
                "sourceFamily": "rg",
                "commands": ["rg <env-prefix> scripts test e2e bench"],
                "rationale": "Env/config literals: scripts and test trees before src/ modules.",
            }
        )
    if extension and not preserve:
        append(
            {
                "id": "extension-rg",
                "role": "exact",
                "sourceFamily": "rg",
                "commands": ["rg <symbol> extensions/"],
                "rationale": "Extension disambiguation before global semantic explore.",
            }
        )
    if trap and not preserve:
        append(
            {
                "id": "trap-demote-rg",
                "role": "exact",
                "sourceFamily": "rg",
                "commands": ["rg <symbol> packages/<name>/", "rg <symbol> src/"],
                "rationale": "Trap demotion across package boundaries.",
            }
        )
    if caller:
        append(
            {
                "id": "caller-chain-ast",
                "role": "ast",
                "sourceFamily": "codegraph",
                "commands": [
                    "codegraph callers <symbol> --path <path> --json",
                    "rg <symbol> --glob '*.ts'",
                ],
                "rationale": "Caller-chain: concrete call sites over facade definitions.",
            }
        )

    if not any(str(item.get("id")) == "exact-rg-primary" for item in routes):
        append(
            {
                "id": "exact-rg-primary",
                "role": "exact",
                "sourceFamily": "rg",
                "commands": ["rg <pattern> <path>"],
                "rationale": "Baseline exact search.",
            }
        )

    if include_optional_adapters:
        append(
            {
                "id": "ast-codegraph",
                "role": "ast",
                "sourceFamily": "codegraph",
                "commands": [
                    "codegraph query <symbol-or-search> --path <path> --json",
                    "codegraph callers <symbol> --path <path> --json",
                ],
                "rationale": "Structural expansion after exact candidates.",
            }
        )
        append(
            {
                "id": "lsp-navigation",
                "role": "lsp",
                "sourceFamily": "language-server",
                "commands": ["definition", "references", "hover"],
                "rationale": "LSP after candidate symbols exist.",
            }
        )
        if not semantic_promoted:
            append(
                {
                    "id": "semantic-fast-context",
                    "role": "semantic",
                    "sourceFamily": "fast-context",
                    "commands": ["fast_context_search query=<question> project_path=<root>"],
                    "rationale": "Semantic recall last; convert to exact rg follow-ups.",
                }
            )

    append(
        {
            "id": "verification-source-git-tests",
            "role": "verification",
            "sourceFamily": "source-git-tests",
            "commands": ["git diff -- <path>", "Get-Content <file>"],
            "rationale": "Required proof layer for verified claims.",
        }
    )

    return [{**route, "order": index + 1} for index, route in enumerate(routes)]


def _fallback_hints(
    intents: list[dict[str, object]],
    include_optional_adapters: bool,
    routes: list[dict[str, object]],
) -> list[dict[str, object]]:
    hints: list[dict[str, object]] = [
        {
            "when": "rg missing on PATH",
            "action": "Codebase retrieval readiness fails; install or expose rg.",
        }
    ]
    if not include_optional_adapters:
        hints.append(
            {
                "when": "codebase-retrieval not selected",
                "action": "Skip optional AST/LSP/semantic routes; use exact search and verification.",
                "replacesRole": "semantic",
            }
        )
    if any(str(item["id"]) == INTENT_POLICY for item in intents):
        hints.append(
            {
                "when": "semantic Top-1 is implementation-only for policy query",
                "action": "Fall back to policy-doc rg and AGENTS.md/.trellis/spec reads.",
                "replacesRole": "semantic",
            }
        )
    semantic_route = next(
        (r for r in routes if str(r.get("id")) == "semantic-fast-context"),
        None,
    )
    ids = {str(item["id"]) for item in intents}
    has_conceptual = INTENT_CONCEPTUAL in ids
    exact_primary = any(
        str(item["id"]) == INTENT_EXACT and bool(item.get("preserveExactPrimary"))
        for item in intents
    )
    if include_optional_adapters and semantic_route and (
        has_conceptual or int(semantic_route.get("order", 99)) >= 3 or exact_primary
    ):
        hints.append(
            {
                "when": (
                    "exact rg returns no corroborated file/range candidates "
                    "(or only trap hits) before final Top-1"
                ),
                "action": (
                    "Invoke fast_context_search per semantic-fast-context route, then narrow "
                    "with rg on returned keywords and paths; semantic output remains recall-only "
                    "until source reads confirm."
                ),
                "replacesRole": "semantic",
            }
        )
    return hints


def _warnings(intents: list[dict[str, object]]) -> list[str]:
    warnings: list[str] = []
    low = [str(item["id"]) for item in intents if item.get("confidence") == "low"]
    if low:
        warnings.append(f"Low-confidence intent classification for: {', '.join(low)}.")
    ids = {str(item["id"]) for item in intents}
    if INTENT_POLICY in ids and INTENT_PRESERVE in ids:
        warnings.append(
            "Both policy-document and protocol-platform-preserve detected; preserve keeps exact-symbol primary."
        )
    if (
        INTENT_CONCEPTUAL in ids
        and INTENT_EXACT not in ids
        and INTENT_PRESERVE not in ids
    ):
        warnings.append(
            "Conceptual intent without exact signals; semantic-fast-context route promoted in plan. "
            "Convert semantic hits to exact rg follow-ups before final claims."
        )
    return warnings


def route_codebase_retrieval(
    query: str,
    *,
    codebase_retrieval_selected: bool = True,
) -> dict[str, object]:
    """Return the shared evidence envelope with router-owned fields populated."""
    normalized = _normalize_query(query)
    include_optional = codebase_retrieval_selected

    if not normalized:
        intents = [
            _intent(INTENT_EXACT, "General codebase (exact baseline)", ["empty-query"], "low", True)
        ]
        empty_routes = _ordered_routes(intents, include_optional)
        return {
            "version": ROUTER_VERSION,
            "query": normalized,
            "intents": intents,
            "routes": empty_routes,
            "adapterState": [],
            "freshness": [],
            "fallback": _fallback_hints(intents, include_optional, empty_routes),
            "warnings": ["Empty query; only baseline exact route is emitted."],
            "verification": _base_verification(),
        }

    intents = _classify_intents(normalized)
    routes = _ordered_routes(intents, include_optional)
    return {
        "version": ROUTER_VERSION,
        "query": normalized,
        "intents": intents,
        "routes": routes,
        "adapterState": [],
        "freshness": [],
        "fallback": _fallback_hints(intents, include_optional, routes),
        "warnings": _warnings(intents),
        "verification": _verification_for_intents(intents),
    }


def codebase_retrieval_selected_from_capabilities(
    capabilities: dict[str, Any] | None,
) -> bool:
    if not capabilities:
        return True
    selected = capabilities.get("selected")
    if not isinstance(selected, list):
        return True
    return "codebase-retrieval" in selected


def load_capabilities_json(repo_root: Path | None) -> dict[str, Any] | None:
    if repo_root is None:
        return None
    path = repo_root / ".trellis" / "capabilities.json"
    if not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            parsed = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def resolve_router_envelope(
    repo_root: Path | None,
    *,
    explicit_router: dict[str, Any] | None = None,
    query: str | None = None,
) -> dict[str, object] | None:
    """Prefer explicit routerEnvelope; otherwise route from query when present."""
    if explicit_router:
        return explicit_router
    normalized = " ".join((query or "").split())
    if not normalized:
        return None
    caps = load_capabilities_json(repo_root)
    selected = codebase_retrieval_selected_from_capabilities(caps)
    return route_codebase_retrieval(normalized, codebase_retrieval_selected=selected)