# marketplace mem-recall: add --phase brainstorm + sync user local skill

## Goal

两件事：

1. `marketplace/skills/mem-recall/SKILL.md` 更新到匹配 0.6.0-beta.3 — 加入 `tl mem extract --phase brainstorm` 用法（讨论阶段独立提取，跨多 task session）
2. 把用户本地 `~/.claude/skills/chat-history-recall/`（基于 0.5.x 时期的 TS POC `scripts/chat-history.ts`）替换成 marketplace mem-recall 的 symlink，并删除老 skill 残留

## What I already know

- Local: `~/.claude/skills/chat-history-recall/` 含 SKILL.md + scripts/chat-history.ts (TS POC) + references/，248 行 SKILL.md，调 `tsx scripts/chat-history.ts` 而非 `trellis mem`
- Marketplace: `marketplace/skills/mem-recall/SKILL.md`（214 行）已经全用 `trellis mem` 命令，但写于 0.6.0-beta.0 时期，没提 `--phase`
- 0.6.0-beta.3 加的 `--phase brainstorm` 是 recall 的强力扩展点：用户问"我们之前讨论过 X"时，brainstorm 段比 implement 段信号密度高得多
- Trellis CLI 0.6.0-beta.3 已在 npm 上

## Decisions (locked from brainstorm)

- **Sync 机制**：symlink `~/.claude/skills/mem-recall` → `marketplace/skills/mem-recall`（绝对路径）。仓库一改本地跟着改；移仓库会断（接受）
- **老 skill**：直接删 `~/.claude/skills/chat-history-recall/`（含 scripts/ + references/）。`trellis mem` 完全覆盖，没保留必要

## Requirements

- `marketplace/skills/mem-recall/SKILL.md`:
  - Prereq 升到 0.6.0-beta.3
  - 新加 `### \`trellis mem extract --phase brainstorm\` — slice the discussion portion` 子节
  - 触发短语扩展：加"我们当时怎么决定 X 的？" / "之前讨论过的 trade-off" 等 brainstorm-flavored phrases
  - 用法示例覆盖：单 session brainstorm、多 task session 拼接、`--grep` 在 brainstorm 范围内过滤、`--json` 拿 windows[] 元数据
  - 简要说明 `--phase implement` 和 `--phase all` 是 sibling
  - Claude / Codex 支持，OpenCode degrade 提一句
- 用户本地 fs 操作（task 完成后手动跑或 implementer 跑）：
  - `rm -rf ~/.claude/skills/chat-history-recall/`
  - `ln -s <abs-marketplace-path> ~/.claude/skills/mem-recall`

## Acceptance Criteria

- [ ] `marketplace/skills/mem-recall/SKILL.md` 含 `--phase brainstorm` 子节 + prereq 更新
- [ ] 触发语清单加 brainstorm-flavored phrases
- [ ] `~/.claude/skills/chat-history-recall/` 不存在
- [ ] `~/.claude/skills/mem-recall` 是 symlink 指向 marketplace 目录，`SKILL.md` 内容能读到
- [ ] `pnpm lint` 不受影响（marketplace 在 lint scope 之外，应当 noop）
- [ ] dogfood：`Skill mem-recall` 能被 Claude Code 触发（description 里关键词在）
- [ ] 不动 `trellis mem` 代码、`commands-mem.md` spec、其他 skills

## Definition of Done

- 1 个 commit（marketplace SKILL.md 改动）
- 用户本地 fs 操作不入 commit（外部）
- Skill description 总长度还在 Claude Code 的合理范围（不要无限堆触发关键词）

## Out of Scope

- 把 `--phase` 用法做成独立 skill (`brainstorm-recall`)
- marketplace mem-recall 中文版镜像
- `docs-site/skills-market/mem-recall.mdx` 同步（这是 marketplace 用户文档站；改 SKILL.md 后续再 sync）—— **若 implement 顺手能改就改**
- 自动化 sync 工具（"marketplace → ~/.claude/skills" 一键命令）

## Technical Notes

- Marketplace 路径：`/Users/taosu/workspace/company/mindfold/product/share-public/Trellis/marketplace/skills/mem-recall/`
- 用户本地路径：`~/.claude/skills/`
- 0.6.0-beta.3 changelog 已写 `--phase` 用法 — 可以参考 `docs-site/changelog/v0.6.0-beta.3.mdx` 的措辞
- `commands-mem.md` 里有完整 `## Phase slicing (--phase)` 节 — 可参考但不照抄（spec vs skill 受众不同）
