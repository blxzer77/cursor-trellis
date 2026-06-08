# `trellis update --migrate` 相关三个已定位 bug

> 用户反馈来自 2026-04-22 群聊（0.5.0-beta.9 发版当天）。用户跑 migrate 流程时踩到 3 个坑，已经和 codex 一起做完 root cause 分析，本任务负责收敛 + 修复。

## 背景

用户在某个项目上跑 `trellis update --migrate`（目标可能是 beta.8 或 beta.9），出现：

1. 生成的 `04-22-migrate-to-0.5.0-beta.8` task 模板"看起来有问题，里面很多内容还是之前的"
2. `init-context` 自动生成的 `check.jsonl` 指向 `.claude/commands/trellis/check.md`，但该项目是 Codex 技能布局（无 `.claude/` 或 Codex 专属路径）
3. 就算平台正确识别为 codex，生成的路径仍是 `.agents/skills/check/SKILL.md`，但仓库实际目录是 `.agents/skills/trellis-check/SKILL.md`（0.5.0-beta.0 加的 `trellis-` 前缀没被本函数跟进）

`task.py validate` 脚本在"任务路径 vs 任务名"参数处理上也被用户说不一致，作为附带项一起核查。

---

## Bug A — `get_trellis_command_path` codex/kiro 分支漏 `trellis-` 前缀

### 定位

`packages/cli/src/templates/trellis/scripts/common/cli_adapter.py:214-251`

```python
def get_trellis_command_path(self, name: str) -> str:
    ...
    elif self.platform == "codex":
        return f".agents/skills/{name}/SKILL.md"       # ❌ 应为 trellis-{name}
    elif self.platform == "kiro":
        return f".kiro/skills/{name}/SKILL.md"         # ❌ 应为 trellis-{name}
    ...
```

### 为什么错

0.5.0-beta.0 做了一次 skill 目录改名（manifest 里有 60+ `rename` 条目把 `skills/<name>/` 搬到 `skills/trellis-<name>/`），但这个方法没被跟进。结果 codex / kiro 项目跑 `init-context` 时 check.jsonl 永远写坏路径。

### 验证证据

```
packages/cli/src/migrations/manifests/0.5.0-beta.0.json
  "from": ".kiro/skills/check/SKILL.md"
  "to":   ".kiro/skills/trellis-check/SKILL.md"        ← 当时加的 trellis- 前缀
  "from": ".agents/skills/check/SKILL.md"
  "to":   ".agents/skills/trellis-check/SKILL.md"      ← 共享层也加了
```

### 修复

两行改动：

```python
elif self.platform == "codex":
    return f".agents/skills/trellis-{name}/SKILL.md"
elif self.platform == "kiro":
    return f".kiro/skills/trellis-{name}/SKILL.md"
```

### 测试

- 在一个只有 `.agents/skills/trellis-check/SKILL.md`、`.agents/skills/trellis-finish-work/SKILL.md` 的 fixture 下跑 `task.py init-context <dir> backend`，断言生成的 `check.jsonl` 两行 `file` 字段都带 `trellis-` 前缀。
- kiro 同款 fixture。
- 旧的 unit test（如果有的话）预期会失败，需要同步更新断言。

---

## Bug B — Codex-only 项目被探测成 claude

### 定位

`packages/cli/src/templates/trellis/scripts/common/cli_adapter.py:detect_platform`（约 line 680-740）

### 现象

用户描述："task_context.py 会根据当前平台自动挑'检查'入口，但现在它选成了 Claude 的命令路径，而这个仓库实际是 Codex 技能布局"

### 推测的 root cause

`detect_platform` 探测 codex 的判据（line 693）要求 `.codex/` 目录存在：

```python
if (project_root / ".codex").is_dir() and not _has_other_platform_dir(...):
    return "codex"
```

但用户的真实场景可能是：
- 只走了 `.agents/skills/` 共享层（没生成 `.codex/` 目录）
- 或 `.codex/` 存在但同时 `.claude/` 也存在 → `_has_other_platform_dir` 判 false 落到 claude 默认

需要复现后决定：
1. 放宽判据：只要有 `.agents/skills/trellis-*` 就算 codex？（风险：共享层规范多平台通用，误判）
2. 让 `init-context` 支持 `--platform` 参数，用户显式指定
3. 探测多平台时让 AI 选，不默认 claude

### 修复（待 brainstorm）

需要先在干净 fixture 上复现用户环境（只 init 过 `--codex`），看 `detect_platform` 实际走哪条分支，再拍板。

### 测试

- fixture：只跑过 `trellis init --codex` 的项目，`init-context` 应生成 codex 路径的 check.jsonl
- fixture：既 `--claude` 又 `--codex` 的项目 → 如何派发？（设计决策）

---

## Bug C — `trellis update --migrate` 生成的 task PRD 内容 stale

### 定位

`packages/cli/src/commands/update.ts:1971-2050` 生成 migration task 的逻辑，配合 `packages/cli/src/migrations/index.ts:getMigrationMetadata`

### 现象

用户跑 migrate 后生成的 `04-22-migrate-to-0.5.0-beta.X` task，PRD 里"很多内容还是之前的"。

### 为什么

`getMigrationMetadata` 会枚举从 `fromVersion` 到 `toVersion` 之间所有带 `manifest.migrationGuide` 字段的 manifest，拼成 PRD。当前只有 4 个历史 manifest 有这个字段：

```
0.3.0-beta.0.json
0.3.0-beta.7.json
0.3.0.json
0.4.0-beta.1.json
```

而 `0.5.0-beta.0`（真正的大 breaking release，206 条 migration 条目）**没有** `migrationGuide` 或 `aiInstructions` 字段。所以：

- 从 0.3.x 或 0.4.x migrate 到 0.5.x 时，PRD 里拼出来的全是 0.3/0.4 时代的指引
- 看起来"内容还是之前的"——因为字面上就是之前的

### 修复方向

两条路线，brainstorm 时选：

**A. 给 0.5.0-beta.0 manifest 补 migrationGuide + aiInstructions**（向后补内容）

- 手写 0.5.0-beta.0 真正的迁移要点（skill 改名、配置切分、multi-agent 移除、record-session 合并等）
- PRO：用户从 0.3/0.4 跨版本 migrate 能看到 0.5 的关键提示
- CON：补旧 manifest 字段算"篡改已发布 manifest"，存在性 vs 正确性权衡

**B. 改 update.ts 生成逻辑：只对"本次实际跨越的最新 breaking version"生成 task**

- 从 fromVersion 到 toVersion 之间的 guide 如果是 N 年前的，大概率对当前用户无意义
- 加一个"时间窗口"或"major-version-recent-only"过滤
- PRO：不改已发布 manifest，代码侧修复
- CON：老版本有真实有用的 migration guide 也会被过滤掉

**C. 两者结合**：先给 0.5.0-beta.0 补 guide + aiInstructions（"一次性补档"），以后新 manifest 默认带这两个字段（在 `/trellis:create-manifest` 流程里增加 Step 检查 breaking=true 时必须提供 migrationGuide）

推荐 **C**。

### 测试

- fixture：`trellis update --migrate` 从 0.5.0-beta.0 到 0.5.0-beta.9 → 生成的 task PRD 应包含 0.5 系列 breaking 改动的 migration guide
- 从 0.4.0 → 0.5.0-beta.9 → 应包含 0.4→0.5 的跨版本 guide

---

## 附带项 — `task.py validate` 参数处理不一致

用户顺带提到这一条：

> `validate` 这个脚本对"任务路径"和"任务名"的参数处理有点不一致

具体点还没定位。作为这个 task 的收尾 checklist 项一起核查：

- 读 `common/task_context.py::cmd_validate` 和 `resolve_task_dir`
- 看它和 `init-context` / `add-context` 的参数处理是否对齐
- 如果不一致，统一成一种（建议：全部走 `resolve_task_dir`，支持 path 和 name 两种）

---

## 开放问题

1. **是 1 个 task 还是拆 3 个**：我现在把 3 个 bug 塞在一个 task 里，因为它们都从同一条用户反馈通路来。如果修起来分歧大，execute 时可以拆成 3 个 child task。
2. **Bug C 的路线选哪个**：A / B / C 三条，待 brainstorm 拍板
3. **Bug B 的复现条件**：需要用户提供具体仓库状态（`.agents/skills/` 下有什么、`.codex/` 是否存在、有无其他平台目录）
4. **是否属于 beta.9 hotfix**：这三个 bug 都是 `trellis update` 的核心体验问题。如果用户碰上这些直接放弃 migrate 了，就需要紧急 hotfix 成 beta.10。或者延到下一个正常 beta。

---

## 优先级

🔴 **P0** —— `trellis update --migrate` 是每个老用户都要走的路径，三个 bug 叠加导致 migrate 产物不可用。

## 关联

- 用户反馈出处：2026-04-22 群聊截图（taosu image-cache 目录）
- 代码文件：
  - `packages/cli/src/templates/trellis/scripts/common/cli_adapter.py`（Bug A + B）
  - `packages/cli/src/commands/update.ts:1971-2050`（Bug C）
  - `packages/cli/src/migrations/index.ts:getMigrationMetadata`（Bug C）
  - `packages/cli/src/migrations/manifests/0.5.0-beta.0.json`（Bug C 补档对象）
  - `packages/cli/src/templates/trellis/scripts/common/task_context.py`（附带项：validate）
- 相关 PR / 历史：
  - 0.5.0-beta.0 skill 改名的 60+ rename 条目（Bug A 的上下文）
  - `/trellis:create-manifest` 命令文档（Bug C 路线 C 的更新对象）

## 下一步

`/trellis:start 04-22-migrate-flow-bugs` → brainstorm：
- Bug A 直接实现（一行/两行修复 + 测试）
- Bug B 先让用户贴复现步骤
- Bug C 决策 A/B/C 路线
- 附带项 validate 核查
