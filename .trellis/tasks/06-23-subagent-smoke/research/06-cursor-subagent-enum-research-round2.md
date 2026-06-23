# Research Round 2: smart-search 深度搜索（最终版）

- **Query**: Cursor 自定义 subagent 进 Task 工具 enum 的 definitive 方式
- **Scope**: 外部（smart-search multi-provider + exa + deep research）
- **Date**: 2026-06-23
- **检索方式**: smart-search（research / exa-search / zhipu-search）+ WebSearch + WebFetch

---

## 本轮新增决定性发现

### 发现 A（来自本机文件系统检查）：你早就把 trellis-* 放到 user 级了

```
C:\Users\blaze\.cursor\agents\
├── trellis-check.md      6152B  2026-06-16 19:44
├── trellis-implement.md  4358B  2026-06-16 19:44
└── trellis-research.md   4832B  2026-06-16 19:44

D:\MyHarness\.cursor\agents\（harness 层，workspace root）
├── trellis-check.md      6141B  2026-06-23 21:36
├── trellis-implement.md  4368B  2026-06-23 21:36
└── trellis-research.md   4820B  2026-06-23 21:36
```

**重大事实**：
- `~/.cursor/agents/`（user 级）你**早就放了** trellis-*，6/16 就在那
- 两个位置 frontmatter 都正确（name/description/tools 齐全）
- harness 层比 user 层新 7 天，但都是同一套定义
- **即便两处都放了，enum 仍然不识别 trellis-*** —— 这推翻了之前研究文件「路 2：放 user 级」的假设

### 发现 B（来自 `~/.cursor/skills-cursor/` 检查）：Cursor 内置 subagent 在这里

```
C:\Users\blaze\.cursor\skills-cursor\
├── automate/         ├── review/
├── babysit/          ├── review-bugbot/      ← enum 里的 bugbot
├── canvas/           ├── review-security/    ← enum 里的 security-review
├── create-hook/      ├── sdk/
├── create-rule/      ├── shell/              ← enum 里的 shell
├── create-skill/     ├── split-to-prs/
├── create-subagent/  ├── statusline/
├── loop/             ├── update-cli-config/
├── migrate-to-skills/└── update-cursor-settings/
```

这些是 Cursor 官方 skills（每个是一个目录，含 SKILL.md），其中 `babysit / review-bugbot / review-security / shell` 对应 enum 里的 `bugbot / security-review / shell`。**它们通过 `~/.cursor/skills-cursor/` 加载，不走 `.cursor/agents/` 机制**。

`.sync-manifest.json` 显示这些 skill 是 Cursor 云端同步下来的（`lastSyncedAt: 1782229063375`）。

### 发现 C（来自 forum https://forum.cursor.com/t/cursor-agent-cli-does-not-register-skills-from-plugins-ide-does-parity-gap/158947）

这个 4 月 24 日的帖子揭示了 Cursor 的 skill/agent 加载有 **4 个 well-known 路径**：

```
/.claude/skills/
/.cursor/skills/
~/.cursor/skills/
~/.cursor/skills-cursor/   ← 内置 subagent 走这条
```

**Plugin 的 skills 即便 plugin loader 日志显示加载成功，agent 也"不知道"它们存在**。用户报告 workaround 是 symlink 到 `~/.cursor/skills/`：

```bash
ln -s ~/.claude/plugins/cache/<marketplace>/<plugin>/<sha>/skills/<skill> \
      ~/.cursor/skills/bridge--<plugin>--<skill>
```

这对你的启示：**plugin 路径不一定可靠**（CLI 有 parity gap，IDE 稍好但仍可能漏），最可靠的是直接放到 well-known 路径。

---

## 综合证据链

把两轮搜索 + 本机检查结合起来，得出**完整因果链**：

1. ✅ Cursor 官方支持 `.cursor/agents/*.md` 和 `~/.cursor/agents/*.md` 自定义 subagent（官方文档明文）
2. ✅ 你的 trellis-* 文件 frontmatter 正确，且**同时放在了 harness 层和 user 层**
3. ❌ 但 enum 仍不识别 trellis-*

**enum 里的 8 个值的来源**（已查清）：

| enum 值 | 来源 |
|---|---|
| `generalPurpose` / `explore` / `best-of-n-runner` / `cursor-guide` | Cursor 内置（硬编码） |
| `shell` | `~/.cursor/skills-cursor/shell/` |
| `bugbot` | `~/.cursor/skills-cursor/review-bugbot/` |
| `security-review` | `~/.cursor/skills-cursor/review-security/` |
| `ci-investigator` | 类似内置 skill（未在本机检查到，可能是 Cursor 版本差异或 cloud 同步项） |

**关键观察**：enum 里除 4 个硬编码外，其他都来自 `~/.cursor/skills-cursor/`，**没有一个是来自 `.cursor/agents/` 或 `~/.cursor/agents/`**。

---

## 最关键的新假设（待验证）

`.cursor/agents/` 和 `~/.cursor/agents/` 里的自定义 subagent **可能根本不进 Task 工具 enum**。它们是给 Cursor chat 的 @mention / `/agent-name` slash 命令用的，而 Task 工具 enum 是另一套机制 —— 只认硬编码 + `~/.cursor/skills-cursor/` 下的内置 skill。

这个假设跟官方文档「Agent includes all custom subagents in its available tools」看似矛盾，但**官方文档可能指的是"agent 能通过 /name slash 调用"，不是"能通过 Task(subagent_type=name) 调用"**。forum 里有大量用户报告同样问题，且从未被彻底解决（只有"重启 Cursor"这一个偶发有效的 workaround）。

---

## 发现 D（4 月 5 日新 forum 帖，Task 工具 model 参数 bug）

https://forum.cursor.com/t/task-tool-model-parameter-only-accepts-fast-cannot-specify-model-ids-for-subagents/156736

用户在 Cursor CLI 2026.03.30 + IDE 2.6.22 上测试，发现 Task 工具的 `model` 参数 schema 硬编码 `enum: ["fast"]`：

```json
"model": {
  "description": "Optional model to use for this agent...",
  "enum": ["fast"],
  "type": "string"
}
```

跟 subagent frontmatter 文档说支持 `inherit / fast / 具体 model ID` 矛盾。说明 **Task 工具的 schema 跟 subagent 文档规范严重脱节**，Cursor 在这块的实现一直不稳定。

---

## 修正后的路径推荐（基于新证据）

### 路 1（仍最先试）：重启 Cursor + Settings > Agents UI 验证

- forum 唯一被验证有效的 workaround
- 你的 trellis-* 文件 6/16 就在 `~/.cursor/agents/` 了，如果从没重启过 Cursor，可能就是卡在这
- **5 分钟见分晓**，值得先试

### 路 2（新：symlink 到 `~/.cursor/skills-cursor/`）

基于发现 C 的 workaround 思路：

```powershell
# 在 PowerShell 管理员模式
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.cursor\skills-cursor\trellis-research" -Target "$env:USERPROFILE\.cursor\agents\trellis-research.md"
# 但这是单文件不是目录，需要换方式：
# 把 trellis-*.md 包装成 SKILL.md 格式的目录
mkdir "$env:USERPROFILE\.cursor\skills-cursor\trellis-research"
Copy-Item "$env:USERPROFILE\.cursor\agents\trellis-research.md" "$env:USERPROFILE\.cursor\skills-cursor\trellis-research\SKILL.md"
# 重启 Cursor
```

这是基于"enum 里的值都来自 `~/.cursor/skills-cursor/`"的观察推断。**不确定 skill 格式能否当 subagent 用**，但值得一试。

### 路 3：等 Cursor 修复 / 升级到最新 nightly

- 发现 D 显示 2026 年 4 月 Task 工具 schema 仍有 bug
- forum 显示 Cursor 团队多次说"修复中"但问题反复
- 升级到最新 stable / nightly 可能命中已修复版本

### 路 4（兜底，确定可用）：改 hook 支持 generalPurpose + `[trellis:<role>]` 标记

即 `byok-road-b-plan.md` 方案。**在新证据下，这条路从"BYOK 备选"升级为"最确定可行"**，因为：
- 已确认 enum 永远接受 `generalPurpose`
- 已确认你的 hook 链路工作正常（selected_task 持久化成功）
- 已确认 `.cursor/agents/` 路径不可靠

### 路 5（绕开 Task 工具）：Cursor chat @mention 或 /agents 会话

之前已验证可用，但不算"自动派发"。

---

## 相关来源

**Forum（按时间倒序）**:
- [Task tool `model` parameter only accepts "fast"](https://forum.cursor.com/t/task-tool-model-parameter-only-accepts-fast-cannot-specify-model-ids-for-subagents/156736) (2026-04-05, 2.6.22)
- [Cursor-agent CLI does not register skills from plugins](https://forum.cursor.com/t/cursor-agent-cli-does-not-register-skills-from-plugins-ide-does-parity-gap/158947) (2026-04-24)
- [Subagent configured model not honored](https://forum.cursor.com/t/subagent-configured-model-not-honored/151456) (2026-02-10)
- [Task tool not available when subagent_delegation_context injected](https://forum.cursor.com/t/task-tool-not-available-to-agent-when-subagent-delegation-context-is-injected-2-5-17-windows/152174) (2026-02-18, 2.5.17)
- ["not a valid subagent_type" - restart fixed](https://forum.cursor.com/t/message-not-a-valid-subagent-type-when-creating-a-custom-agent/159054)（forum 最早关于此问题的帖）
- [Task Tool Missing for Custom Agents](https://forum.cursor.com/t/task-tool-missing-for-custom-agents-in-cursor-agents-documentation-pages-return-errors/149771) (2026-01-23, 2.4.21)

**官方文档**:
- [Subagents | Cursor Docs](https://cursor.com/docs/subagents) — 文档说支持但实现有 gap
- [Plugins | Cursor Docs](https://cursor.com/docs/plugins)
- [Plugins Reference](https://cursor.com/docs/reference/plugins)

**本机证据**:
- `~/.cursor/agents/` 已有 trellis-*（6/16 放入，frontmatter 正确）
- `~/.cursor/skills-cursor/` 含 18 个 Cursor 官方 skill（含 bugbot/security-review/shell 对应 enum 值）
- enum 里没有任何值来自 `.cursor/agents/` 或 `~/.cursor/agents/`

## Caveats

- 「`.cursor/agents/` 不进 enum」是从 enum 8 个值的来源反推的假设，没有 Cursor 官方明文确认。可能是 bug，也可能是设计。forum 5 个月的帖子都没彻底解决，说明 Cursor 团队自己也未必理清。
- symlink 到 `~/.cursor/skills-cursor/` 的路 2 是基于假设的实验，不确定 skill 目录格式能否被 Task 工具当 subagent 用。
- 你的 Cursor 版本未知，无法判断是否命中某个已修复版本。建议跑 `Cursor --version` 确认。
- smart-search 的 deep research 模式耗时但 evidence 质量高，已存到 `sm-research-round2.json` / `sm-research-final.json` 等文件，可后续翻看完整 evidence。
