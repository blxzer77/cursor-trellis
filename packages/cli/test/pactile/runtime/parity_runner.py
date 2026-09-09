"""Exercise the shipped Python mirror, not a test reimplementation."""
import importlib.util
import hashlib
import json
from pathlib import Path
import sys
from typing import Protocol, cast
import unittest


class _ReconfigurableTextIO(Protocol):
    def reconfigure(self, *, encoding: str) -> None: ...


sys.dont_write_bytecode = True
if hasattr(sys.stdout, "reconfigure"):
    cast(_ReconfigurableTextIO, sys.stdout).reconfigure(encoding="utf-8")

source = Path(__file__).resolve().parents[3] / "src/templates/trellis/scripts/common/paths.py"
spec = importlib.util.spec_from_file_location("runtime_paths", source)
assert spec is not None and spec.loader is not None
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class GoldenTest(unittest.TestCase):
    def test_shared_pure_corpus(self):
        corpus = json.loads(Path(__file__).with_name("path-golden.json").read_text(encoding="utf-8"))
        for case in corpus:
            with self.subTest(case=case["name"]):
                self.assertEqual(runtime.handle_runtime_path_request(case["input"]), case["expected"])


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        unittest.main(argv=[sys.argv[0]])
    elif "--scalar-digest" in sys.argv:
        digest = hashlib.sha256()
        for code in range(0x110000):
            if 0xD800 <= code <= 0xDFFF:
                continue
            character = chr(code)
            digest.update((runtime.normalize_nfc_15(character) + "\0" + runtime.case_fold_component(character) + "\0").encode("utf-8"))
        print(json.dumps({"sha256": digest.hexdigest(), "scalars": 0x110000 - 0x800}))
    else:
        requests = json.load(sys.stdin)
        print(json.dumps([runtime.handle_runtime_path_request(item) for item in requests], ensure_ascii=True))
