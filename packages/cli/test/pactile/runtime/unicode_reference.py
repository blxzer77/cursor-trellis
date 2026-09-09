"""Unicode 15 oracle / table generator. Writes stdout only; never edits runtime.

Reproduce the pinned NFC table with Python 3.12:
  py -3.12 test/pactile/runtime/unicode_reference.py --tables
The implementer installs identical JSON in TS and the standalone Python template.
"""
import hashlib
import json
import sys
import unicodedata as ucd

if ucd.unidata_version != "15.0.0":
    raise RuntimeError("The independent oracle requires Unicode 15.0.0 (Python 3.12)")


def tables():
    decomposition = []
    combining = []
    composition = []
    for code in range(0x110000):
        character = chr(code)
        if ucd.combining(character):
            combining.append([code, ucd.combining(character)])
        raw = ucd.decomposition(character)
        if raw and not raw.startswith("<"):
            parts = [int(value, 16) for value in raw.split()]
            decomposition.append([code, parts])
            if len(parts) == 2 and ucd.normalize("NFC", "".join(map(chr, parts))) == character:
                composition.append([parts[0] * 0x110000 + parts[1], code])
    return {"version": ucd.unidata_version, "decomposition": decomposition, "combining": combining, "composition": composition}


def scalar_digest():
    digest = hashlib.sha256()
    for code in range(0x110000):
        if 0xD800 <= code <= 0xDFFF:
            continue
        normalized = ucd.normalize("NFC", chr(code))
        # U+0000 separators frame every scalar (even literal zero is unambiguous
        # for this ordered, complete scalar corpus); both runtimes hash UTF-8.
        digest.update((normalized + "\0" + normalized.casefold() + "\0").encode("utf-8"))
    return {"version": ucd.unidata_version, "sha256": digest.hexdigest(), "scalars": 0x110000 - 0x800}


if __name__ == "__main__":
    if "--tables" in sys.argv:
        output = tables()
    elif "--scalar-digest" in sys.argv:
        output = scalar_digest()
    else:
        output = [
            {"normalized": ucd.normalize("NFC", value), "folded": ucd.normalize("NFC", value).casefold()}
            for value in json.load(sys.stdin)
        ]
    print(json.dumps(output, ensure_ascii=True, separators=(",", ":")))
