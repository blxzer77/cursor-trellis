# Polyrepo 检测与手动配置

## 背景

**用户反馈（2026-04-21，trellis 用户 -js）**：

> 我试了下，一个目录下放 N 个 git 仓库，init 时强制 `--monorepo` 会报错
> 然后看了眼你的源码，发现只认特定的几个场景
> 比如前后端在不同仓库，但是想扔一起管，毕竟有些逻辑需要一起改

当前 `detectMonorepo()` (`packages/cli/src/utils/project-detector.ts:555`) 只识别 6 种 workspace marker：

| 检测源 | 文件 |
|---|---|
| Git submodule | `.gitmodules` |
| pnpm | `pnpm-workspace.yaml` |
| npm/yarn/bun | `package.json` 的 `workspaces` |
| Rust | `Cargo.toml` 的 `[workspace]` |
| Go | `go.work` |
| Python uv | `pyproject.toml` 的 `[tool.uv.workspace]` |

**Polyrepo 场景**（多个独立 `.git/` 放在同一目录，无 workspace 配置）完全不在检测范围内：
- 不是 submodule（没 `.gitmodules`）
- 不是 workspace（没配置文件）
- 但用户在概念上确实想"一起管"

`init.ts:732` 的分支：
```ts
if (options.monorepo === true && !detected) {
  console.log("Error: --monorepo specified but no monorepo configuration found.");
  process.exit(1);
}
```

→ 直接报错，没有可用的逃生舱。

---

## 任务目标

让 Trellis 能覆盖 polyrepo / meta-repo / 非标准多 package 布局，同时给出显式的手动配置入口。

---

## 设计

### 方案 A：自动扫描 `.git`（兜底 detector）

在 `detectMonorepo()` 的 parser 链**末尾**追加 `parsePolyrepo`，前面 6 个都 miss 才走它：

```ts
function parsePolyrepo(cwd: string): string[] | null {
  const children = fs.readdirSync(cwd, { withFileTypes: true });
  const dirs = children
    .filter(d => d.isDirectory())
    .filter(d => !d.name.startsWith(".") && d.name !== "node_modules")
    .filter(d => fs.existsSync(path.join(cwd, d.name, ".git")))
    .map(d => d.name);
  return dirs.length >= 2 ? dirs : null;
}
```

**约束：**
- 深度只扫**一层**（深扫会吸到 `node_modules/.pnpm/.../.git`）
- 至少 **2 个 `.git`** 才触发（单个可能是用户误 clone）
- 过滤 `.*`、`node_modules`、`target`、`dist`、`build` 等噪声目录
- `.git` 可能是**文件**（worktree / submodule gitlink）—— 用 `existsSync`，不加 `isDirectory()` 判断
- 只在其他 parser 全 miss 时才跑（否则 pnpm workspace 里某个 package 恰好是独立 clone 也会双重命中）

**新增 package type：** 在 `DetectedPackage` 里加一个 `isGitRepo: boolean` 或 `source: "workspace" | "submodule" | "polyrepo"` 字段，运行时 `packages_context.py` 能区分展示。

### 方案 B：手动配置（逃生舱）

#### B1. CLI flag

```bash
trellis init --packages frontend,backend
trellis init --packages "apps/*"  # glob 支持
```

语义：
- 传了 `--packages` → 完全绕过 auto-detect，直接用传入列表
- 可以和 `--monorepo` 共存（隐式开启 monorepo 模式）
- 空字符串 / 解析失败 → 报错，不 fallback

#### B2. config.yaml 手写

`.trellis/config.yaml`：

```yaml
packages:
  - name: frontend
    path: ./frontend
  - name: backend
    path: ./backend
```

init 时先读 config.yaml 的 `packages`，有就用它覆盖一切检测。

### 方案 A + B 的优先级

```
手动配置（config.yaml / --packages）
    ↓ 未配置
workspace parser（pnpm / npm / cargo / go / uv）
    ↓ 全 miss
.gitmodules submodule
    ↓ 也没有
parsePolyrepo（sibling .git 扫描）
    ↓ <2 个
null → 单 repo 模式
```

### 错误信息改进

`--monorepo` 未检测到时，当前只说"no monorepo configuration found"。改成：

```
Error: --monorepo specified but no multi-package layout detected.

Checked:
  ✗ pnpm-workspace.yaml
  ✗ package.json workspaces
  ✗ Cargo.toml [workspace]
  ✗ go.work
  ✗ pyproject.toml [tool.uv.workspace]
  ✗ .gitmodules
  ✗ sibling .git directories (found 0, need ≥ 2)

To force multi-package mode anyway, specify packages manually:
  trellis init --packages frontend,backend
```

---

## 子任务（FP 后修订版）

### Change A：`parsePolyrepo` 接入现有 parser 链

- [ ] `project-detector.ts` 加 `parsePolyrepo(cwd)`：扫 sibling 一层，过滤 `.*` / `node_modules` / `target` / `dist` / `build`，用 `existsSync` 不加 `isDirectory` 判断（兼容 worktree gitlink 文件），≥2 个才返回
- [ ] 接入 `detectMonorepo()` 的 parser 链**末尾**（其他 6 个全 miss 才跑）
- [ ] 跳过已经在 `submodulePaths` 集合的路径（避免双重计数）

### Change B：CLI ↔ Runtime schema 桥接

- [ ] `DetectedPackage` 加 `isGitRepo: boolean` 字段（与运行时 `git: true` 对齐，**不引入 enum**）
- [ ] `parsePolyrepo` 产出的 package `isGitRepo: true`，其他 parser 默认 `false`
- [ ] `writeMonorepoConfig` 检测到 `pkg.isGitRepo` 时，输出 `git: true` 行（与现有 `type: submodule` 同位）
- [ ] config.yaml 模板注释补 `git: true` 示例（`packages/cli/src/templates/trellis/config.yaml`）

### Change C：`--monorepo` 失败信息改进

- [ ] `init.ts:734` 失败分支重写：打印 checklist（已检查的 7 个 marker）+ 手写 config.yaml 示例 + 不 exit 1（保留交互式 fallback？或仍 exit 但打印完整指引后退出）

### 测试

- [ ] `parsePolyrepo` 单测：2 个 sibling `.git` 触发、1 个不触发、`node_modules/.git` 过滤、`.git` 是文件（worktree）也触发、submodule 路径不双重计数
- [ ] `writeMonorepoConfig` 单测：`isGitRepo: true` → 输出 `git: true`
- [ ] 集成：polyrepo fixture → init 全流程 → config.yaml 含 `git: true` → 运行时 `packages_context.py` 显示 `(git repo)`

### 文档

- [ ] config.yaml 模板注释补 `git: true` 示例
- [ ] README / spec 简短一节说明 polyrepo 支持
- [ ] CHANGELOG 注明

---

## 显式 Discard（FP 后）

- ❌ `--packages` CLI flag —— 与 config.yaml 语义重叠，UX 糖。Trellis 哲学是声明式优先，不养成 flag/config 二元习惯
- ❌ `DetectedPackage.source: enum` —— 运行时已用 `isSubmodule` + `isGitRepo` 双 boolean，跨语言保持对齐
- ❌ N > 阈值时 confirm 的 default 翻转 —— 用户拍板"按 Enter 是用户责任"
- ❌ 裸 `trellis init` 时禁用 polyrepo 扫描 —— 现有 confirm prompt 已是意图门槛，不需要额外 `--monorepo` 卡口

## 非目标

- **不处理**跨 repo 的 git 操作（Trellis 不做 git 工具）
- **不处理**嵌套超过 1 层的 polyrepo（`apps/group/repo/.git`）—— 极少见，用户走手写 config.yaml
- **不自动**为每个子 repo 写 hook（各子 repo 有自己的 `.claude/` 如何合并，另开任务）

---

## 优先级

🟡 **P2** — 不阻塞 v0.5.0 发布，但首位外部用户就踩到，属于"小众但存在的真实需求"。P1/P3 之间。

## 风险

- `.git` sibling 扫描可能误伤：用户 `~/projects/` 下一堆独立项目，`trellis init` 会把所有项目当 package。Mitigation：`--polyrepo` 默认关闭，需显式 `--monorepo` 或 `--packages` 才触发
- `--packages` 和 auto-detect 同时出现时语义冲突：设计里明确了手动优先
- Config.yaml 的 `packages` 字段变成 breaking schema change：用 optional field，向后兼容

## 关联

- `04-17-hook-path-robustness` —— 独立问题，但同一批用户可能同时踩到
- `04-16-skill-first-refactor` —— 不直接关联

---

## 调研发现（2026-04-22 校准 PRD）

### 现状代码核对

| 文件 | 现状 |
|---|---|
| `packages/cli/src/utils/project-detector.ts:555` | `detectMonorepo()` 6 个 parser，PRD 描述准确 |
| `DetectedPackage` 接口（line 220） | 当前只有 `isSubmodule: boolean`，无 `source` enum |
| `packages/cli/src/commands/init.ts:730` | `--monorepo` 失败分支确认存在，错误信息单薄 |
| `packages/cli/src/commands/init.ts:574` `writeMonorepoConfig` | **会跳过已有 `packages:`**（非破坏式 patch）→ 手写 config.yaml 已是隐性逃生舱 |

### 重大发现：运行时已经半支持 polyrepo

- `.trellis/scripts/common/config.py:267` `get_git_packages()` —— 已识别 `git: true` 字段
- `packages_context.py:109,119,145,186` —— 已读取 `isGitRepo`，已显示 `(git repo)` / `[git repo]` 标签
- **缺口**：
  1. CLI 侧 `detectMonorepo()` 不会产出 `git: true`（因为没检测 polyrepo）
  2. `.trellis/config.yaml` 默认模板**没有**文档 `git: true` 字段（只有 `type: submodule` 示例）
  3. 用户即使手写 `packages:`，也不知道 polyrepo 子目录该写 `git: true`

### 这意味着什么

PRD 原方案 A+B 体量过大。运行时已就绪，CLI 侧只需补"产出 + 文档"两件事：

- **方案 A（自动）只需在 TS 侧补 `parsePolyrepo` + 给 `DetectedPackage` 加 `isGitRepo` + `writeMonorepoConfig` 输出 `git: true`** —— 不需要为运行时新增字段
- **方案 B 的 config.yaml 路径已天然支持**（init 不会覆盖已有 `packages:`）→ 只需文档化 `git: true` 字段
- `source` enum 改造与现有 `isSubmodule`/`isGitRepo` 双 boolean 不一致，**建议放弃 enum 设计**，与运行时保持双 boolean 对齐

### 风险重新评估

- "`~/projects/` 误伤"风险被放大：如果用户在 polyrepo 父目录跑 `trellis init` 不带任何 flag，`parsePolyrepo` 会自动触发 → 把所有项目当 package。**必须**用"显式 `--monorepo` 才触发"或"打印检测结果让用户确认"门槛。
- 现状的 `--monorepo` 失败时直接 exit，没有保留交互引导用户手写 `packages:`。
