# Trellis v0.4.0-beta.1: Monorepo Init + 单仓向前兼容

## Goal

让 `trellis init` / `trellis update` 以及生成的全部模板（命令、Hook、Python 脚本）同时支持 **单仓模式**（现状）和 **Monorepo 模式**，用户无需手动改文件即可在 monorepo 中使用 Trellis。

## Background

- Trellis 主仓库自身已是 monorepo（`packages/cli` + `docs-site` submodule）
- 项目 dotfiles（`.claude/`、`.trellis/scripts/`）已部分适配 monorepo（路径替换 + 动态发现）
- **CLI 模板源码**（`packages/cli/src/templates/`，即用户 `trellis init` 后得到的文件）**零 monorepo 逻辑**
- 已有两份详细 PRD 作为参考：
  - `archive/2026-03/03-09-monorepo-spec-adapt/prd.md` — 10 Part 完整蓝图
  - `03-10-monorepo-compat/prd.md` — 6 Phase CLI 产品侧计划

## 核心设计

### 模式判定

```
config.yaml 有 packages: 字段 → Monorepo 模式
config.yaml 无 packages: 字段 → 单仓模式（默认，完全向后兼容）
```

### 向后兼容保证

1. 单仓用户零感知：不触碰 `packages:` → 一切行为不变
2. 命令过渡期：旧 type-specific 命令保留至少 1 个 minor 版本
3. config.yaml 无破坏：新字段默认注释掉
4. task.json 兼容：`package` 字段可选，不存在时走旧路径
5. Python 脚本兼容：所有新函数都有 fallback

---

## 子任务总览

| Sprint | Task | 内容 | 优先级 | 交付物 |
|--------|------|------|--------|--------|
| **S1** | `s1-infra` | Monorepo 检测 + config/paths 基础设施 + init 适配 | P1 | 用户可 `trellis init` 出 monorepo 结构 |
| **S2** | `s2-commands` | 命令合并 + Hook/Start 动态化 | P1 | 命令和 hook 在 monorepo 下正常工作 |
| **S3** | `s3-task-update` | Task package 字段 + Update 兼容 | P2 | task 系统感知 package，update 安全 |
| **S4** | `s4-worktree` | Worktree submodule + PR 感知 | P3 | parallel agent 在 monorepo 下正常 |

### 依赖关系

```
S1 (infra) ──→ S2 (commands)  ──→ S4 (worktree)
     └──────→ S3 (task+update) ─┘
```

S1 是所有后续的前置条件。S2 和 S3 可并行。S4 依赖 S2+S3。

---

## Acceptance Criteria（总体）

- [ ] `trellis init` 在 pnpm/npm/yarn workspace 项目中自动检测并询问 monorepo 模式
- [ ] Monorepo 模式下 `config.yaml` 自动生成 `packages:` 字段
- [ ] Monorepo 模式下 spec 目录按 `spec/<package>/<layer>/` 创建
- [ ] 所有命令和 Hook 动态发现 spec 路径，不再硬编码
- [ ] Task 系统支持 `--package` 参数
- [ ] 单仓项目行为完全不变
- [ ] `trellis update` 安全兼容 monorepo spec 目录
- [ ] Worktree 自动初始化 submodule
- [ ] 所有改动有对应单测覆盖

## Out of Scope

- 跨 package 依赖管理（Trellis 不管构建系统）
- Per-package 独立 `.trellis/`（始终一个 `.trellis/` 在 repo root）
- 在子 package 目录运行 `trellis init`（要求 repo root）
- GUI / Electron app 的 monorepo 支持

## 参考文档

- `archive/2026-03/03-09-monorepo-spec-adapt/prd.md` — 完整 10 Part 蓝图
- `03-10-monorepo-compat/prd.md` — 6 Phase CLI 产品计划（原始详细设计）
