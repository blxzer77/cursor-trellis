# 维护者手册（内部）

> **读者**：在 `D:\MyHarness` 中维护本 fork 的维护者与 Agent。  
> **不面向**公开 npm 用户或普通应用开发者。公开文档见 [README](../README.md)、[docs/](.) 双语页面。

## Harness 布局

| 路径 | Git | 用途 |
| --- | --- | --- |
| `D:\MyHarness` | 非 git 仓库 | 工作区级 `.trellis/`（tasks、workflow、spec） |
| `D:\MyHarness\Trellis` | **本仓库** | CLI + core 源码；在此运行 `git`、`pnpm`、测试 |
| `D:\MyHarness\smartsearch-private` | 独立项目 | smart-search 上游开发（与 vendor 同步相关） |
| `D:\MyHarness\riverfjs-skills` | 独立项目 | 可复用 skill 资产 |

工作区说明：`D:\MyHarness\AGENTS.md`。Trellis 源码说明：`Trellis/AGENTS.md`（含更细的代码库导览）。

## Git 与 remote 策略（本地）

| 项 | 策略 |
| --- | --- |
| 默认分支 | `main` |
| 唯一 push remote | `private` → `git@github.com:blxzer77/cursor-trellis.git` |
| 禁止 | 添加或 push 到 `origin` / `mindfold-ai/Trellis` |
| 日常命令目录 | `D:\MyHarness\Trellis` |

```bash
cd D:\MyHarness\Trellis
git status
git push private main    # 或 git push（若 default remote 为 private）
```

上游参考（文档/fork 身份）：https://github.com/mindfold-ai/Trellis

## 关键源码与调用关系

### 包边界

- `@blxzer/cursor-trellis-core`：`packages/core/src/` — task/channel/mem 等领域导出。
- `@blxzer/cursor-trellis`：`packages/cli/src/` — Commander、commands、configurators、templates。

构建顺序：**core → cli**（`pnpm build`）。

### Cursor 路径（公开文档主线）

```text
packages/cli/src/cli/index.ts          # --cursor 等 flags
packages/cli/src/commands/init.ts      # 调用 configurePlatform("cursor")
packages/cli/src/configurators/cursor.ts
packages/cli/src/templates/cursor/
packages/cli/src/types/ai-tools.ts     # AI_TOOLS 注册表
```

`update.ts` / `uninstall.ts` 通过 template hashes 与 `AI_TOOLS` 管理各平台路径。

### 模板与哈希

- 构建：`packages/cli/scripts/copy-templates.js` → `dist/templates/`
- 用户项目：`.trellis/template-hashes.json`（由 init 初始化，update 比对）

### smart-search vendor

- 路径：`packages/cli/vendor/smart-search/`
- 同步：`pnpm run sync:smart-search`（在 `packages/cli`）
- 检查：`pnpm run check:smart-search`
- 对外 bin：`packages/cli/bin/smart-search.js`

## 本地验证（源码变更时）

在 `Trellis/`：

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

### Router copy sync guard (REC-09 / R-CR-012)

After changing `packages/cli/src/utils/codebase-retrieval-router.ts` or template Python under `packages/cli/src/templates/trellis/scripts/`:

1. Sync dogfood copies: `Trellis/.trellis/scripts/common/codebase_retrieval_router.py`, `common/project_file_stats.py`, `common/retrieval_tool_classification.py`, `common/git_context.py`, `route_codebase_retrieval.py`, and `aggregate_retrieval_telemetry.py` from the CLI template (or run `trellis update` in `Trellis/`).
2. Harness MyHarness: keep the same paths under `.trellis/scripts/` aligned with the template (REC-03 adds telemetry JSONL aggregation; REC-10 adds `project_file_stats.py` for `--project-file-count auto`).

```bash
cd D:\MyHarness\Trellis\packages\cli
pnpm run check:router-copy-sync:hash   # fast: byte hashes only (CI / pre-test)
pnpm build
pnpm run check:router-copy-sync        # full: hashes + O1/O2/O3 golden + TS/PY parity
```

Optional harness check from Trellis repo root:

```bash
python scripts/check_router_copy_sync.py --hash-only --extra-workspace-root D:\MyHarness
```

仅文档任务可只做 Markdown/链接检查；见任务 `verify.md`。

## 文档维护

| 类型 | 位置 |
| --- | --- |
| 公开英文默认 | `README.md`, `docs/*.md`, `packages/cli/README.md` |
| 公开中文 | `*.zh-CN.md` 同名结构 |
| 内部维护 | 本文 `docs/maintainers.md` |
| Release/publish 详细流程 | `docs/release-publish-internal.md`（**已 gitignore**，不提交） |

公开文档**不得**写入 release/publish 步骤；**不得**在公开主线展开 `mem` / `channel` CLI。

修改 Cursor 模板后：跑 CLI 测试 + 在狗食项目 `trellis update` 验证 diff 行为。

## Release / publish（索引）

完整步骤、脚本顺序、npm 双包发布见 **gitignored** 文件：

`docs/release-publish-internal.md`

公开 README 仅可链接到本文“维护者”段落，**不要**链接到 gitignored 文件。

## 与本任务相关的 Trellis 工件

工作区级任务目录：`D:\MyHarness\.trellis\tasks\06-21-trellis-full-docs/`（PRD、design、implement、verify）。

在 harness 根运行 `task.py` 时设置会话 id（若 CLI 要求），例如 `TRELLIS_CONTEXT_ID=...`。