"""Stage 5 Topology + typed graph + On-demand (Python projection).

Kernel extras remain authoritative. This module renders and validates the
same contract; it does not schedule workers or write a second graph.
"""

from __future__ import annotations

from typing import Any

STAGE5_SOURCE = "stage5-ondemand-topology"
STAGE5_SCHEMA_VERSION = 1

STAGE5_ONDEMAND_MODULES = (
    "candidate-pool",
    "define-extended",
    "worker-orchestration",
    "parent-child",
    "debug-recovery",
    "integration-handoff",
    "session-transfer",
    "spec-learning",
    "vcs-integration",
    "personal-memory",
    "retention-storage",
)

ONDEMAND_OWNERS = {
    "integration-handoff": "parent-child",
    "session-transfer": "session-transfer",
}

LITE_DORMANT_ONDEMAND = (
    "parent-child",
    "vcs-integration",
    "personal-memory",
    "retention-storage",
)


class TopologyError(RuntimeError):
    """Topology / On-demand contract rejected a request."""


def capture_candidate(summary: str) -> dict[str, Any]:
    return {
        "kind": "candidate",
        "summary": (summary or "").strip(),
        "task_created": False,
    }


def propose_decompose(parent_id: str, slices: list[str]) -> dict[str, Any]:
    return {
        "parent_id": parent_id,
        "slices": _unique(slices),
        "confirmed": False,
        "children_created": [],
    }


def confirm_decompose(proposal: dict[str, Any]) -> dict[str, Any]:
    slices = _unique(proposal.get("slices") or [])
    return {
        **proposal,
        "confirmed": True,
        "children_created": slices,
    }


def apply_retention(outcome: str) -> str:
    return outcome


def assign_parent(topology: dict[str, Any], parent_id: str) -> dict[str, Any]:
    current = topology.get("parent_id")
    next_parent = (parent_id or "").strip()
    if not next_parent:
        raise TopologyError("parent_id must be a non-empty string")
    if current and current != next_parent:
        raise TopologyError(
            f"single-parent tree: second parent rejected ({current} vs {next_parent})"
        )
    return {
        "schema_version": STAGE5_SCHEMA_VERSION,
        "kind": "parent-child",
        "parent_id": next_parent,
        "children": list(topology.get("children") or []),
    }


def assert_integration_authority(actor_role: str) -> None:
    if actor_role == "parent":
        return
    raise TopologyError(
        "Integration authority stays with Parent; Child cannot integrate-child"
    )


def expand_depends_on_to_requires(
    graph: dict[str, Any],
    from_id: str,
    depends_on: list[str],
) -> dict[str, Any]:
    edges = list(graph.get("edges") or [])
    for dep in _unique(depends_on):
        if any(
            edge.get("from") == from_id
            and edge.get("to") == dep
            and edge.get("type") == "requires"
            for edge in edges
            if isinstance(edge, dict)
        ):
            continue
        edges.append({"from": from_id, "to": dep, "type": "requires"})
    return {"schema_version": STAGE5_SCHEMA_VERSION, "edges": edges}


def unmet_requires(
    graph: dict[str, Any],
    satisfied: list[str],
    from_id: str | None = None,
) -> list[str]:
    done = set(satisfied)
    missing: list[str] = []
    for edge in graph.get("edges") or []:
        if not isinstance(edge, dict) or edge.get("type") != "requires":
            continue
        if from_id and edge.get("from") != from_id:
            continue
        target = edge.get("to")
        if isinstance(target, str) and target not in done and target not in missing:
            missing.append(target)
    return missing


def project_task_map_graph(
    topology: dict[str, Any],
    graph: dict[str, Any],
) -> dict[str, Any]:
    children = []
    for child_id in topology.get("children") or []:
        if not isinstance(child_id, str):
            continue
        depends = [
            edge.get("to")
            for edge in graph.get("edges") or []
            if isinstance(edge, dict)
            and edge.get("type") == "requires"
            and edge.get("from") == child_id
        ]
        children.append({"id": child_id, "depends_on": depends})
    return {
        "graph_authority": "kernel-extras",
        "topology_kind": topology.get("kind") or "single",
        "parent_id": topology.get("parent_id"),
        "children": children,
    }


def apply_kernel_graph_projection(data: dict[str, Any], extras: dict[str, Any]) -> None:
    """Stamp Parent task-map frontmatter from Kernel extras. Projection only."""
    topology = extras.get("topology")
    graph = extras.get("dependency_graph")
    if not isinstance(topology, dict) and not isinstance(graph, dict):
        return
    projection = project_task_map_graph(
        topology if isinstance(topology, dict) else {},
        graph if isinstance(graph, dict) else {"edges": []},
    )
    data["graph_authority"] = "kernel-extras"
    data["topology_kind"] = projection["topology_kind"]
    if projection.get("parent_id"):
        data["parent_id"] = projection["parent_id"]
    existing = {
        child.get("id"): child
        for child in data.get("children") or []
        if isinstance(child, dict)
    }
    children = data.setdefault("children", [])
    if not isinstance(children, list):
        data["children"] = []
        children = data["children"]
    for child in projection["children"]:
        current = existing.get(child["id"])
        if current is None:
            current = {"id": child["id"], "state": "open", "depends_on": []}
            children.append(current)
            existing[child["id"]] = current
        current["depends_on"] = child["depends_on"]


def resident_on_demand_modules(extras: dict[str, Any]) -> list[str]:
    modules = extras.get("ondemand_modules")
    if not isinstance(modules, dict):
        return []
    active = modules.get("active") or []
    return [name for name in active if isinstance(name, str)]


def _unique(values: list[Any]) -> list[str]:
    out: list[str] = []
    for value in values:
        if not isinstance(value, str):
            continue
        item = value.strip()
        if item and item not in out:
            out.append(item)
    return out
