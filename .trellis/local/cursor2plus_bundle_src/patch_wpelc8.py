"""Trellis: reversible Cursor++ WPeLc8 subagent model map (BYOK). See README.md."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

MARKER = "/*TRELLIS_B2_WPeLc8*/"

KNOWN_SUBAGENT_TYPES = (
    "trellis-research",
    "trellis-implement",
    "trellis-check",
    "generalPurpose",
    "shell",
    "best-of-n-runner",
)


def _repo_root(start: Path) -> Path:
    cur = start.resolve()
    for _ in range(12):
        if (cur / ".trellis").is_dir():
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    return start.resolve()


def _load_json(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"warn: skip {path}: {exc}", file=sys.stderr)
        return {}
    if not isinstance(data, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in data.items():
        if isinstance(k, str) and isinstance(v, str) and v.strip():
            out[k] = v.strip()
    return out


def _merge_maps(*layers: dict[str, str]) -> dict[str, str]:
    merged: dict[str, str] = {}
    for layer in layers:
        merged.update(layer)
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
        "extension.js not found. Copy config.local.json.example → config.local.json "
        "and set extensionJs, or run: python patch_wpelc8.py --bootstrap"
    )


def resolve_model_layers(bundle_dir: Path, config: dict) -> dict[str, str]:
    root = _repo_root(bundle_dir)
    ccursor = _ccursor_home(config)
    user_path = ccursor / "trellis-task-models.json"
    if isinstance(config.get("userModelsJson"), str) and config["userModelsJson"].strip():
        user_path = Path(config["userModelsJson"].strip()).expanduser()
    project_path = root / ".trellis" / "local" / "subagent-models.json"
    if isinstance(config.get("projectModelsJson"), str) and config["projectModelsJson"].strip():
        project_path = Path(config["projectModelsJson"].strip()).expanduser()
    return _merge_maps(_load_json(user_path), _load_json(project_path))


def build_inject_block(model_map: dict[str, str]) -> str:
    if not model_map:
        raise SystemExit("model map is empty — fill ~/.ccursor/trellis-task-models.json or .trellis/local/subagent-models.json")
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


def cmd_bootstrap(bundle_dir: Path) -> None:
    config = _load_config(bundle_dir)
    example = bundle_dir / "config.local.json.example"
    cfg_out = bundle_dir / "config.local.json"
    if cfg_out.is_file():
        print("config.local.json already exists", file=sys.stderr)
        config = _load_config(bundle_dir)
    else:
        config = {}
    try:
        resolve_extension_js(bundle_dir, config)
        print("extension.js auto-detected", file=sys.stderr)
    except SystemExit:
        path = input("Paste full path to cursor2plus/dist/extension.js: ").strip()
        if path:
            config["extensionJs"] = path
    ccursor = _ccursor_home(config)
    user_json = ccursor / "trellis-task-models.json"
    if not user_json.is_file():
        print(f"Create {user_json} with subagentType → model slug keys.", file=sys.stderr)
        print("Known types:", ", ".join(KNOWN_SUBAGENT_TYPES), file=sys.stderr)
        slug = input("Optional: paste one slug to seed trellis-implement (or Enter to skip): ").strip()
        if slug:
            _merge_maps(_load_json(user_json), {"trellis-implement": slug})
            user_json.parent.mkdir(parents=True, exist_ok=True)
            user_json.write_text(
                json.dumps({"trellis-implement": slug}, indent=2) + "\n",
                encoding="utf-8",
            )
    cfg_out.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print("wrote", cfg_out)


def main() -> None:
    ap = argparse.ArgumentParser(description="Trellis Cursor++ WPeLc8 model map")
    ap.add_argument("--revert", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--bootstrap", action="store_true", help="Interactive path + config setup")
    ap.add_argument("--print-map", action="store_true", help="Print merged map and exit")
    args = ap.parse_args()

    bundle_dir = Path(__file__).resolve().parent
    if args.bootstrap:
        cmd_bootstrap(bundle_dir)
        return

    config = _load_config(bundle_dir)
    extension = resolve_extension_js(bundle_dir, config)
    model_map = resolve_model_layers(bundle_dir, config)

    if args.print_map:
        print(json.dumps(model_map, indent=2, sort_keys=True))
        return

    source = extension.read_text(encoding="utf-8", errors="ignore")
    if args.revert:
        new = remove_patch(source)
    else:
        inject = build_inject_block(model_map)
        new = apply_patch(source, inject)

    if args.dry_run:
        print("ok", "revert" if args.revert else "patch", "delta", len(new) - len(source))
        print("extension", extension)
        print("keys", len(model_map))
        return

    extension.write_text(new, encoding="utf-8", newline="\n")
    print("wrote", extension)
    print("mapped types", ", ".join(sorted(model_map.keys())))


if __name__ == "__main__":
    main()