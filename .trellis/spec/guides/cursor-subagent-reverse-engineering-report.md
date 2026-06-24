# Cursor Subagent Model Routing — Reverse Engineering Report

> **Date:** 2026-06-18
> **Cursor version:** 0.50.x (workbench.desktop.main.js ~58.4 MB minified)
> **Environment:** Cursor++ BYOK (ccursor by cometix v0.0.11+)
> **Status:** A1/A2 test confirmed frontmatter `model:` does not switch models for custom Task subagents under BYOK

---

## Executive summary

Under Cursor++ BYOK, **only Explore-type subagents** can be dispatched with an independent model. Custom Task subagents (`trellis-research`, `trellis-implement`, `trellis-check`) always inherit the parent session's model regardless of frontmatter `model:` value. This is a three-layer architecture limitation, not a single bug.

---

## Architecture (three layers)

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Cursor Client (Frontend JS)                   │
│  - w5_ = ["explore"] ← HARDCODED                       │
│  - q6x() iterates only w5_ to build overrides           │
│  - CustomSubagent.model sent to server but ignored       │
│  - Storage key: cursor/subagentModelOverrides            │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Cursor Server (Cloud)                          │
│  - Receives CustomSubagent.model in protobuf             │
│  - Does not route BYOK models (doesn't know them)        │
│  - SubagentModelOverride only processed for "explore"    │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Cursor++ Proxy (BYOK routing)                  │
│  - Intercepts RunSSE gRPC stream at 127.0.0.1:39831     │
│  - Routes BYOK models for Explore-type requests           │
│  - Custom Task subagents NOT in routing table             │
└─────────────────────────────────────────────────────────┘
```

---

## Key code findings

### 1. w5_ hardcoded subagent type list

**File:** `workbench.desktop.main.js` (offset ~21036496)

```js
w5_ = ["explore"]
```

Only `"explore"` is in the array that `q6x()` iterates to build `SubagentModelOverride[]`. Custom subagent types (`"custom"`) are excluded.

### 2. q6x — getSubagentModelOverrides()

**File:** `workbench.desktop.main.js` (offset ~37370948)

```js
function q6x(n) {
  const { overrides: e, resolveModelParametersForSubmission: t } = n, i = [];
  for (const r of w5_) {                    // Only iterates w5_ = ["explore"]
    const s = e?.[r];
    if (s) switch (s.mode) {
      case "default": continue;
      case "disabled":
      case "inherit":
        i.push(new YNs({ subagentType: r, selection: { case: s.mode, value: !0 } }));
        continue;
      case "model": {
        const o = J6x({ config: s.modelConfig, resolveModelParametersForSubmission: t });
        if (!o) continue;
        i.push(new YNs({ subagentType: r, selection: { case: "model", value: o } }));
        continue;
      }
    }
  }
  return i;
}
```

**Implication:** Even if storage has overrides for custom subagent types, `q6x()` will never read them because the loop only visits `w5_`.

### 3. J6x — builds RequestedModel from UI config

```js
function J6x(n) {
  const { config: e, resolveModelParametersForSubmission: t } = n;
  if (!e) return;
  const i = e.selectedModels?.[0];
  if (!i || i.modelId === "default") return;
  const r = e.maxMode === !0,
        s = t(i.modelId, i.parameters, r);
  return new H8({
    modelId: i.modelId,
    maxMode: r,
    parameters: s.map(o => new nX({ id: o.id, value: o.value }))
  });
}
```

### 4. Protobuf definitions (reverse-engineered)

#### SubagentModelOverride

```protobuf
message SubagentModelOverride {
  string subagent_type = 1;
  oneof selection {
    RequestedModel model = 2;
    bool inherit = 3;
    bool disabled = 4;
  }
}
```

#### CustomSubagent

```protobuf
message CustomSubagent {
  string full_path = 1;
  string name = 2;
  string description = 3;
  repeated string tools = 4;
  string model = 5;            // from frontmatter model: value
  string prompt = 6;
  CustomSubagentPermissionMode permission_mode = 7;
  bool is_background = 8;
  bool forceDefaultModel = 9;
}
```

#### SubagentType (oneof)

```protobuf
message SubagentType {
  oneof type {
    SubagentTypeUnspecified unspecified = 1;
    SubagentTypeComputerUse computer_use = 2;
    SubagentTypeCustom custom = 3;
    SubagentTypeExplore explore = 4;
    SubagentTypeMediaReview media_review = 5;
  }
}
```

#### AgentRunRequest (complete field map)

```protobuf
message AgentRunRequest {
  conversation_state = 1;
  action = 2;
  model_details = 3;
  mcp_tools = 4;
  conversation_id = 5;
  mcp_file_system_options = 6;
  skill_options = 7;
  custom_system_prompt = 8;
  requested_model = 9;
  suggest_next_prompt = 10;
  subagent_type_name = 11;
  exclude_workspace_context = 12;
  harness = 13;
  selected_subagent_models = 14;
  selected_subagent_model_details = 15;
  conversation_group_id = 16;
  pre_fetched_blobs = 17;
  dev_raw_model_slug = 18;
  client_supports_inline_images = 19;
  subagent_model_overrides = 20;
  can_create_cloud_subagents = 21;
  suppress_subagent_progress_update_tool = 22;
  client_supports_send_to_user = 23;
}
```

### 5. Storage mechanism

- **Key:** `cursor/subagentModelOverrides` in Zustand `globalStorage/state.vscdb` (SQLite)
- **Path:** `%APPDATA%\Cursor\User\globalStorage\state.vscdb`
- **Schema:** `{ [subagentType: string]: { mode: "default"|"inherit"|"disabled"|"model", modelConfig?: { selectedModels: [{ modelId: string }] } } }`
- **Population:** Only Explore subagent gets a UI panel to set overrides. Custom subagents have no UI.

---

## Attempted solutions and outcomes

### Plan A — Frontmatter `model:` (original mechanism)

| Step | Result |
|---|---|
| Set `model: qwen3.7-max` in `trellis-research.md` | Dispatched with GLM-5.1 (parent model) |
| Set `model: grok-composer-2.5-fast` in `trellis-implement.md` | Dispatched with GLM-5.1 (parent model) |

**Verdict:** Does not work under BYOK. `CustomSubagent.model` field is sent to server but ignored for model routing.

### Plan B — Cursor++ feature request

| Aspect | Status |
|---|---|
| Open source? | No — Cursor++ is closed source |
| Can we patch it? | No — binary, no plugin API |
| Can we file a request? | Yes — cometix could add custom subagent BYOK routing |

**Verdict:** Long-term best solution but not under our control.

### Plan C — Patch Cursor frontend `q6x()` + storage injection

| Step | Result |
|---|---|
| Patch `w5_` iteration to include all override keys | Code patched ✅ |
| Write overrides for custom types to storage | Written ✅ |
| Update product.json checksum | Updated ✅ |
| **Runtime test** | ❌ Model still inherits parent |

**Root cause:** Even if client sends `SubagentModelOverride` for custom types, two downstream layers must cooperate:
1. **Cursor server** must route the override (may not support custom types)
2. **Cursor++ proxy** must intercept and route BYOK model for custom subagent requests

Both layers currently only handle Explore-type. Patching Layer 1 alone is insufficient.

### Plan D — Native API key (non-BYOK) + frontmatter `model:`

| Aspect | Assessment |
|---|---|
| Does `CustomSubagent.model` work with native Cursor API? | Likely yes — server-side model routing works for official model catalog |
| Trade-off | Requires Cursor subscription with API access; cannot use BYOK providers |

**Verdict:** Viable but requires switching away from BYOK for subagent dispatch.

---

## A1/A2 test evidence

| Test | Agent file | `model:` set | dispatched as | Actual model |
|---|---|---|---|---|
| A1 | `trellis-research.md` | `qwen3.7-max` | Task (custom) | GLM-5.1 |
| A2 | `trellis-implement.md` | `grok-composer-2.5-fast` | Task (custom) | GLM-5.1 |

Both subagents ran successfully but used the parent session model (GLM-5.1) regardless of frontmatter directive.

---

## Implications for Trellis workflow

### What works

- **Explore subagent** with independent model selection (Cursor++ v0.0.11+ supported)
- **Parent session model switch** — manually change model in Cursor UI before dispatch
- **Subagent spawn itself** — all three Trellis agents spawn and run correctly
- **Hook injection** — `inject-subagent-context.py` fires when conditions are met
- **Write access** — `trellis-implement` can edit files (fixed in Cursor++ v0.0.11)

### What doesn't work under BYOK

- **Ephemeral model overlay** — frontmatter `model:` does not affect custom Task subagent model routing
- **SubagentModelOverride for custom types** — not processed at any of the three layers
- **Automatic model selection per subagent** — no programmatic way to route a different BYOK model to a custom subagent

### Practical workaround

For custom Task subagents that need a different model:
1. **User manually opens a new Cursor chat** with the desired model selected
2. **Main session provides the dispatch prompt** (full text, including task path, context, and agent instructions)
3. **User pastes the prompt** into the new session and runs it
4. **User copies results back** to the main session

This is a manual "copy-paste dispatch" pattern that bypasses the subagent model routing limitation entirely.

---

## Glossary

| Term | Meaning |
|---|---|
| BYOK | Bring Your Own Key — using third-party API providers via Cursor++ proxy |
| Explore subagent | Built-in Cursor subagent type (`SubagentTypeExplore`) for codebase exploration |
| Custom / Task subagent | User-defined subagent from `.cursor/agents/*.md` (`SubagentTypeCustom`) |
| Ephemeral model overlay | Temporarily writing `model:` to agent markdown frontmatter before dispatch |
| w5_ | Minified variable name for the hardcoded `["explore"]` array in Cursor frontend |
| q6x | Minified function name for `getSubagentModelOverrides()` |
| YNs | Minified class for `SubagentModelOverride` protobuf message |
| H8 | Minified class for `RequestedModel` protobuf message |
