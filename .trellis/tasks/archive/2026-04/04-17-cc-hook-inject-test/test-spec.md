# Test Spec File (for hook injection canary)

This file is referenced from `implement.jsonl`. If Trellis's inject-subagent-context.py is working on Claude Code, the full contents of this file will be injected into the sub-agent's prompt.

## Canary string (SPEC)

SPEC_CANARY = **`SPEC_ZEBRA_COMET_48D7E5`**

## Fake development rule

> All functions whose name begins with `test_` must have a 3-word acronym in the docstring. This rule is unique to this file and deliberately absurd — the sub-agent has no way to know it except via injected content.

FAKE_RULE_TAG = **`RULE_PINEAPPLE_EIGHT`**
