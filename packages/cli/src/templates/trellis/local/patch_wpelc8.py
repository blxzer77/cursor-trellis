"""Trellis: reversible Cursor++ WPeLc8 subagent model map (BYOK). See README.md."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from trellis_task_models_config import (
    KNOWN_SUBAGENT_TYPES,
    SUBAGENT_TYPE_HELP,
    extract_raw_slots,
    load_providers_catalog,
    load_task_models_document,
    resolve_slots_to_slugs,
)

MARKER = "/*TRELLIS_B2_WPeLc8*/"


def _repo_root(start: Path) -> Path:
    cur = start.resolve()
    for _ in range(12):
        if (cur / ".trellis").is_dir():
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    return start.resolve()


def _merge_slot_maps(*layers: dict[str, list[str]]) -> dict[str, list[str]]:
    merged: dict[str, list[str]] = {}
    for layer in layers:
        for k, v in layer.items():
            merged[k] = list(v)
    return merged


def _ccursor_home(config: dict) -> Path:
    for key in ("ccursorHome", "ccursor_home"):
        if isinstance(config.get(key), str) and config[key].strip():
            return Path(config[key].strip()).expanduser()
    env = os.environ.get("TRELLIS_CCURSOR_HOME", "").strip()
    if env:
        return Path(env).expanduser()
    return Path.home() / ".ccursor"


def _load_config(bundle_dir: Path) -> dict:
    cfg_path = bundle_dir / "config.local.json"
    if not cfg_path.is_file():
        return {}
    try:
        data = json.loads(cfg_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def resolve_providers_json(config: dict) -> Path:
    for key in ("providersJson", "providers_json"):
        if isinstance(config.get(key), str) and config[key].strip():
            return Path(config[key].strip()).expanduser()
    env = os.environ.get("TRELLIS_CCURSOR_PROVIDERS", "").strip()
    if env:
        return Path(env).expanduser()
    return _ccursor_home(config) / "providers.json"


def _first_existing(*paths: Path) -> Path | None:
    for p in paths:
        if p.is_file():
            return p
    return None


def resolve_user_models_path(config: dict) -> Path:
    ccursor = _ccursor_home(config)
    if isinstance(config.get("userModelsJson"), str) and config["userModelsJson"].strip():
        return Path(config["userModelsJson"].strip()).expanduser()
    found = _first_existing(
        ccursor / "trellis-task-models.json5",
        ccursor / "trellis-task-models.json",
    )
    return found or (ccursor / "trellis-task-models.json5")


def resolve_project_models_path(bundle_dir: Path, config: dict) -> Path | None:
    root = _repo_root(bundle_dir)
    if isinstance(config.get("projectModelsJson"), str) and config["projectModelsJson"].strip():
        p = Path(config["projectModelsJson"].strip()).expanduser()
        return p if p.is_file() else None
    return _first_existing(
        root / ".trellis" / "local" / "subagent-models.json5",
        root / ".trellis" / "local" / "subagent-models.json",
    )


def resolve_model_layers(bundle_dir: Path, config: dict, providers_path: Path) -> tuple[dict[str, str], list[str]]:
    user_path = resolve_user_models_path(config)
    project_path = resolve_project_models_path(bundle_dir, config)
    user_slots = extract_raw_slots(load_task_models_document(user_path))
    project_slots = (
        extract_raw_slots(load_task_models_document(project_path))
        if project_path
        else {}
    )
    merged = _merge_slot_maps(user_slots, project_slots)
    return resolve_slots_to_slugs(merged, providers_path)


def resolve_extension_js(bundle_dir: Path, config: dict) -> Path:
    for key in ("extensionJs", "extension_js"):
        if isinstance(config.get(key), str) and config[key].strip():
            return Path(config[key].strip()).expanduser()
    env = os.environ.get("TRELLIS_CURSOR2PLUS_EXTENSION", "").strip()
    if env:
        return Path(env).expanduser()
    if sys.platform == "win32":
        local = os.environ.get("LOCALAPPDATA", "")
        candidates = [
            Path(local) / "Programs" / "cursor" / "resources" / "app" / "extensions" / "cursor2plus" / "dist" / "extension.js",
            Path(r"D:\cursor\resources\app\extensions\cursor2plus\dist\extension.js"),
        ]
    elif sys.platform == "darwin":
        candidates = [
            Path("/Applications/Cursor.app/Contents/Resources/app/extensions/cursor2plus/dist/extension.js"),
        ]
    else:
        candidates = [
            Path.home() / ".local" / "share" / "cursor" / "resources" / "app" / "extensions" / "cursor2plus" / "dist" / "extension.js",
        ]
    for c in candidates:
        if c.is_file():
            return c
    raise SystemExit(
        "extension.js not found. Set extensionJs in config.local.json or run --bootstrap"
    )


def build_inject_block(model_map: dict[str, str]) -> str:
    if not model_map:
        raise SystemExit(
            "model map empty — use skill trellis-cursor2plus-setup or write "
            "~/.ccursor/trellis-task-models.json5 (see .trellis/local/trellis-task-models.json5.example)"
        )
    pairs = ",".join(f'"{k}":"{v}"' for k, v in sorted(model_map.items()))
    return (
        f"{MARKER}{{const __T={{{pairs}}};const __m=__T[fQ4YPip];"
        "if(__m&&(!UbAQWn||UbAQWn[Vyazt1(gvQ2P56[0x24a3])][Vyazt1(gvQ2P56[0x204e])]"
        "===Vyazt1(gvQ2P56[0x2cda])))return __m;}"
    )


def find_wpelc8_body(source: str) -> tuple[int, int]:
    start = source.find("function WPeLc8(")
    if start < 0:
        raise SystemExit("WPeLc8 not found — Cursor++/extension version mismatch?")
    end = source.find("async function*o4ZNpa", start)
    if end < 0:
        raise SystemExit("WPeLc8 end anchor not found")
    return start, end


def apply_patch(source: str, inject: str) -> str:
    start, end = find_wpelc8_body(source)
    fn = source[start:end]
    if MARKER in fn:
        fn = remove_patch_from_fn(fn)
    needle = "});return!UbAQWn||"
    if needle not in fn:
        raise SystemExit(f"inject anchor missing: {needle!r}")
    fn_new = fn.replace(needle, f"}});{inject}return!UbAQWn||", 1)
    return source[:start] + fn_new + source[end:]


def remove_patch_from_fn(fn: str) -> str:
    import re

    return re.sub(
        re.escape(MARKER) + r"\{const __T=\{[^}]+\};const __m=__T\[fQ4YPip\];"
        r"if\(__m&&\(!UbAQWn\|\|UbAQWn\[Vyazt1\(gvQ2P56\[0x24a3\]\)\]\[Vyazt1\(gvQ2P56\[0x204e\]\)\]"
        r"===Vyazt1\(gvQ2P56\[0x2cda\]\)\)\)return __m;\}",
        "",
        fn,
        count=1,
    )


def remove_patch(source: str) -> str:
    if MARKER not in source:
        raise SystemExit("marker not found — not patched?")
    start, end = find_wpelc8_body(source)
    fn = remove_patch_from_fn(source[start:end])
    return source[:start] + fn + source[end:]


def cmd_explain() -> None:
    print("trellis-task-models.json5 — Agent 协助填写；用户只选模型名")
    print("每项: { primary, fallback } — 首选不可用则自动备选 (WARN)")
    print()
    for key in KNOWN_SUBAGENT_TYPES:
        print(f"  {key}")
        print(f"    → {SUBAGENT_TYPE_HELP.get(key, '')}")
    print()
    print("Skill: trellis-cursor2plus-setup (init 后与大模型交互完成配置)")


def cmd_list_models(providers_path: Path) -> None:
    by_slug, _ = load_providers_catalog(providers_path)
    if not by_slug:
        raise SystemExit(f"no models in {providers_path}")
    print(f"# {providers_path}")
    print("# 给用户选 primary/fallback 时引用 apiModel 或 displayName")
    print()
    rows = sorted(by_slug.values(), key=lambda r: (str(r.get("provider")), str(r.get("displayName"))))
    for r in rows:
        print(
            f"  {r.get('displayName')!r:28} apiModel={r.get('apiModel')!r:32} "
            f"slug={r.get('slug')}  provider={r.get('provider')}"
        )


def cmd_bootstrap(bundle_dir: Path) -> None:
    config = _load_config(bundle_dir)
    cfg_out = bundle_dir / "config.local.json"
    if not cfg_out.is_file():
        config = {}
    try:
        resolve_extension_js(bundle_dir, config)
        print("extension.js auto-detected", file=sys.stderr)
    except SystemExit:
        path = input("Paste full path to cursor2plus/dist/extension.js: ").strip()
        if path:
            config["extensionJs"] = path
    cfg_out.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print("wrote", cfg_out)
    print("Next: in Cursor Agent, run skill trellis-cursor2plus-setup", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser(description="Trellis Cursor++ WPeLc8 model map")
    ap.add_argument("--revert", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--bootstrap", action="store_true")
    ap.add_argument("--explain", action="store_true")
    ap.add_argument("--list-models", action="store_true")
    ap.add_argument("--print-map", action="store_true")
    args = ap.parse_args()

    bundle_dir = Path(__file__).resolve().parent
    if args.explain:
        cmd_explain()
        return
    if args.bootstrap:
        cmd_bootstrap(bundle_dir)
        return

    config = _load_config(bundle_dir)
    providers_path = resolve_providers_json(config)

    if args.list_models:
        cmd_list_models(providers_path)
        return

    model_map, notes = resolve_model_layers(bundle_dir, config, providers_path)
    if notes:
        print("resolve:", file=sys.stderr)
        for line in notes:
            print(line, file=sys.stderr)
    if any("ERROR" in line for line in notes):
        raise SystemExit(1)

    if args.print_map:
        print(json.dumps(model_map, indent=2, sort_keys=True))
        return

    extension = resolve_extension_js(bundle_dir, config)
    source = extension.read_text(encoding="utf-8", errors="ignore")
    if args.revert:
        new = remove_patch(source)
    else:
        inject = build_inject_block(model_map)
        new = apply_patch(source, inject)

    if args.dry_run:
        print("ok", "revert" if args.revert else "patch", "delta", len(new) - len(source))
        return

    extension.write_text(new, encoding="utf-8", newline="\n")
    print("wrote", extension)


if __name__ == "__main__":
    main()