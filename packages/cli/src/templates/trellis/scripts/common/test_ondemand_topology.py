#!/usr/bin/env python3
"""Stage 5 Topology / On-demand Python projection."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from common.ondemand_topology import (
    ONDEMAND_OWNERS,
    STAGE5_ONDEMAND_MODULES,
    TopologyError,
    apply_kernel_graph_projection,
    apply_retention,
    assert_integration_authority,
    assign_parent,
    capture_candidate,
    confirm_decompose,
    default_topology,
    expand_depends_on_to_requires,
    project_task_map_graph,
    propose_decompose,
    resident_on_demand_modules,
    unmet_requires,
)
from common.task_map import ensure_task_map


def test_capture_and_decompose_do_not_create() -> None:
    candidate = capture_candidate("later")
    assert candidate["task_created"] is False
    proposal = propose_decompose("parent-a", ["child-a"])
    assert proposal["confirmed"] is False
    assert proposal["children_created"] == []
    confirmed = confirm_decompose(proposal)
    assert confirmed["confirmed"] is True
    assert confirmed["children_created"] == ["child-a"]


def test_default_topology_parent_id_alone_is_single() -> None:
    linked = default_topology(parent="parent-a", children=[])
    assert linked["kind"] == "single"
    assert linked["parent_id"] == "parent-a"
    controller = default_topology(parent=None, children=["child-a"])
    assert controller["kind"] == "parent-child"


def test_assign_parent_keeps_ordinary_child_single() -> None:
    linked = assign_parent({"parent_id": None, "children": []}, "parent-a")
    assert linked["kind"] == "single"
    assert linked["parent_id"] == "parent-a"
    nested = assign_parent({"parent_id": None, "children": ["child-a"]}, "grand")
    assert nested["kind"] == "parent-child"
    assert nested["children"] == ["child-a"]


def test_second_parent_and_child_integrate_rejected() -> None:
    topology = {"parent_id": "parent-a", "children": []}
    with pytest.raises(TopologyError, match="second parent"):
        assign_parent(topology, "parent-b")
    with pytest.raises(TopologyError, match="Integration authority"):
        assert_integration_authority("child")
    assert_integration_authority("parent")


def test_requires_blocks_advisory_does_not() -> None:
    graph = expand_depends_on_to_requires(
        {"edges": [{"from": "here", "to": "hint", "type": "advisory"}]},
        "here",
        ["upstream"],
    )
    assert unmet_requires(graph, [], from_id="here") == ["upstream"]
    assert unmet_requires(graph, ["upstream"], from_id="here") == []
    assert unmet_requires(graph, [], from_id="other") == []


def test_task_map_is_kernel_graph_projection(tmp_path: Path) -> None:
    parent_dir = tmp_path / "parent"
    parent_dir.mkdir()
    extras = {
        "topology": {
            "kind": "parent-child",
            "parent_id": "parent-a",
            "children": ["child-a"],
        },
        "dependency_graph": {
            "edges": [{"from": "child-a", "to": "upstream", "type": "requires"}],
        },
    }
    projection = project_task_map_graph(extras["topology"], extras["dependency_graph"])
    assert projection["graph_authority"] == "kernel-extras"
    assert projection["children"] == [{"id": "child-a", "depends_on": ["upstream"]}]

    data = ensure_task_map(
        parent_dir,
        {"id": "parent-a", **extras},
        ["child-a"],
    )
    assert data["graph_authority"] == "kernel-extras"
    assert data["topology_kind"] == "parent-child"
    child = next(item for item in data["children"] if item["id"] == "child-a")
    assert child["depends_on"] == ["upstream"]
    apply_kernel_graph_projection(data, extras)
    assert data["graph_authority"] == "kernel-extras"


def test_ondemand_defaults_and_retention_outcome() -> None:
    extras = {
        "ondemand_modules": {
            "registered": list(STAGE5_ONDEMAND_MODULES),
            "active": [],
            "owners": dict(ONDEMAND_OWNERS),
        }
    }
    assert resident_on_demand_modules(extras) == []
    assert ONDEMAND_OWNERS["integration-handoff"] == "parent-child"
    assert ONDEMAND_OWNERS["session-transfer"] == "session-transfer"
    assert apply_retention("completed") == "completed"
