# Release Track (release/) 版本错位审计

- **审计时间**：2026-04-20
- **审计者**：research sub-agent
- **docs-site 根**：`/Users/taosu/workspace/company/mindfold/product/share-public/Trellis/docs-site/`
- **问题定位**：`release/` 目录是今天从 beta track (0.5.0-beta.8 在用的内容) 全量 `cp -r` 得到的。docs.json 把 Release version 标为 "Stable" tag，默认给 0.4.0 用户看，但实际内容不是纯 0.4.0 文档。
- **审计文件数**：184 个 mdx（en + zh），其中 guide/ 21 个 × 2 = 42，changelog 52 × 2 = 104，其余 showcase/contribute/blog/skills-market/templates/use-cases/index ≈ 38

---

## 关键事实校正

审计前假设 "release/ 里面的内容是 0.5.0-beta.8 的文档"，实际情况比这个稍好：

1. **release/guide/ 的正文内容**不是 0.5 独有的（没有提到 "skill-first 架构"、"Agent Trace"、"Plugin system"、`trellis-implement/check/research`、`CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`、OpenCode factory-function）。
2. release/guide/ 里所有 `/trellis-xxx` 写法都是 **Cursor 平台的命令命名转换**（Cursor 把 `:` 换成 `-`），**不是**子代理 0.5-beta.5 的 rename —— 所以这部分是 "看起来像 0.5 其实是 0.4 能用的" 假阳性。
3. 实际上 release/guide/ 的语言反映的是 **0.3.x-late ~ 0.4.0-beta.0** 过渡期内容（例如 `/before-backend-dev` / `/before-frontend-dev` / `/check-backend` / `/check-frontend` 这些 0.4.0-beta.1 合并前的命令仍大量出现）。

核心问题变成：
- **release/guide/ 是 "0.3 到 0.4-beta.0 时的文档快照"** —— 对 0.4.0 GA 用户来说实际上是**历史版本文档**，不是最新稳定版。
- **release/changelog/** 磁盘上有 52 个版本（含 0.5-beta.0~8、0.4-beta.1~10、0.4-rc.0~1、0.3-beta/rc 系列、0.3.x/0.2/0.1 stable），但 docs.json 只引用了 13 个 stable 版本，**其余 39 个 pre-release/beta 文件是 orphan 磁盘文件**。

---

## 总体发现

- "错位" 分类：
  - **严重（0.5 独有内容 → 0.4 用户不应看到）**：0 个 guide 文件（好消息）
  - **中等（列出 0.4 合并前的 split 命令 → 与 0.4.0 GA 不一致）**：5 个文件
  - **轻微（用词/口径与 0.4 略不符，但不影响理解）**：4 个文件
- **"遗留" 缺失项（0.4 GA 当天的 release note 没出现的重要信息）**：2 项
- **可清理文件（docs.json 未引用的 orphan mdx）**：78 个（39 beta/rc × 2 locale）

---

## 错位清单（按严重程度）

### 严重级别（"0.5 独有内容放到 Release 用户面前"）

**无。** release/guide/ 的正文里没有出现 0.5 引入的技术点（skill-first、workflow-state hook、trellis-* 子代理前缀、OpenCode plugin factory-function、CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR、Plugin system、Agent Trace）。搜索关键词在正文中都只命中 changelog/ 目录，而 changelog/ 已经在 docs.json 的 Release version 里被 navigation 过滤掉了。

### 中等级别（与 0.4.0 GA 的命令语义不一致）

0.4.0-beta.1 (2026-03-XX) 做了：`before-backend-dev` + `before-frontend-dev` 合并成 `before-dev`；`check-backend` + `check-frontend` 合并成 `check`。0.4.0 GA 的命令应该是合并后的版本。但 release/ 里下面这些文件还引用**合并前**的 split 命令：

| 文件 | 问题位置 | 说明 |
|---|---|---|
| `release/guide/ch05-commands.mdx` | 行 7 说 "13 slash commands"，但行 14-17 列了 split 的 backend/frontend 4 个命令，合计 14 行。行 125-145 各自给 `/before-backend-dev` / `/before-frontend-dev` / `/check-backend` / `/check-frontend` 详解 | 0.4.0 GA 已经没有这 4 个命令 |
| `release/guide/ch02-quick-start.mdx` | 行 111 `/trellis-check-backend`；行 366-369 列出 `.claude/commands/trellis/` 目录树里的 `before-backend-dev.md` / `before-frontend-dev.md` / `check-backend.md` / `check-frontend.md` | 新装的 0.4.0 项目里这 4 个文件不存在 |
| `release/guide/ch04-architecture.mdx` | 行 124 `/before-backend-dev`；行 220-221 `/check-backend` + `/trellis-check-backend` + `/check-frontend` | Ralph Loop 的举例还在用 split 命令 |
| `release/guide/ch06-task-management.mdx` | 行 157 `".claude/commands/trellis/check-backend.md"` 出现在 JSONL 示例里 | JSONL 示例路径指向已不存在的文件 |
| `release/guide/ch08-real-world.mdx` | 行 45 `/trellis-check-backend`；行 120-121 `/trellis-before-backend-dev` + `/trellis-before-frontend-dev` | "真实场景" 示例跑不通 |
| `release/guide/appendix-f.mdx` | 行 99 Q11 说 Cursor 要 "manually run `/trellis-check-backend`" | FAQ 答案里给了错命令 |

zh 镜像同问题：`release/zh/guide/ch02-quick-start.mdx`、`ch04-architecture.mdx`、`ch05-commands.mdx`、`ch08-real-world.mdx`、`appendix-f.mdx` 全部同样错位。

### 轻微级别（0.4 GA 语义没问题，但与 0.4.0 GA 最终 release note 不完全一致）

| 文件 | 问题 | 影响 |
|---|---|---|
| `release/index.mdx` 行 28 | "Complete reference for all **13** slash commands" | 0.4.0 GA Claude Code 确实是 13 个，OK；但 ch05 正文列了 14 行，与 index 不自洽 |
| `release/guide/ch01-what-is-trellis.mdx` 行 35 | 平台对比写 "**Claude Code + Cursor + Codex + OpenCode + Kilo + Kiro**"（6 个平台）| 0.4.0 GA 实际支持 12 个平台（新增 Gemini CLI, Qoder, CodeBuddy, GitHub Copilot, Windsurf, Factory Droid）。用户看到后会低估 0.4 的平台覆盖 |
| `release/guide/ch04-architecture.mdx` 行 16 | 架构图顶部只画了 "Claude Code / Cursor / Codex / OpenCode / Kilo / Kiro"（6 个）| 同上 |
| `release/guide/ch04-architecture.mdx` 行 294 | "Trellis includes **6 built-in Agents**"（dispatch / plan / implement / check / debug / research）| 0.4.0 GA 确实是这 6 个，OK；但 Codex 平台实际只有 `implement.toml` / `research.toml` / `check.toml` 3 个 sub-agent（见 ch13.3 实际描述），用词可以统一成 "Claude Code includes 6 built-in Agents" 以消歧 |
| `release/skills-market/trellis-meta.mdx` 行 15 | "Works with Claude Code, Cursor, OpenCode, **iFlow**, Codex, Kilo, Kiro, Gemini CLI, **Antigravity**" | 0.4.0 GA：iFlow **存在**（0.3.0-beta.16 加入，0.5.0-beta.0 删除） ✓；**Antigravity 不在** 0.4.0（是 0.5 加的）。对 0.4 用户来说 Antigravity 是将来式 |
| `release/showcase/terminal-demo.mdx` 行 30 | 示例终端里分支名 `feat/v0.4.0-beta` | 0.4.0 已经 GA 到 `main`，分支名显示成 "beta" 对 Stable 用户误导，但仅是 demo 装饰 |

zh 对应文件镜像同问题（`release/zh/guide/ch01-what-is-trellis.mdx` 等）。

---

## 缺失项（0.4 用户想看到但 release/ 没有）

0.4.0 GA release note (`release/changelog/v0.4.0.mdx`) 强调的几个大卖点，在 release/guide/ 里**没有对应的教程或章节**：

1. **Monorepo-native 支持**：0.4.0 的头条卖点 —— "trellis init 自动识别 monorepo 并为每个 package 创建独立 spec 目录"。release/guide/ 全部 21 个 guide 文件里**没有一篇提到 monorepo**。用户从 Release dropdown 切过来想看 monorepo 怎么用，是看不到的。
2. **自定义 spec 模板注册中心 (`--registry`)**：0.4.0 beta.9 加的重要功能。只在 `release/guide/ch02-quick-start.mdx` 行 211-231 有一小节（"2.5 Remote Spec Templates"）提到，但这其实是 0.4-era 内容，保留 OK；其他地方无引用。

非缺失但值得注意：
- `/record-session` 在 release/guide/ch03, ch05, appendix-a, appendix-b, ch13 都有文档 ✓（0.4 存在，0.5 删）
- `/check-cross-layer` 在 release/guide/ch05, appendix-b, appendix-f 都有文档 ✓（0.4 存在，0.5 合并进 check）
- `/parallel` 在 release/guide/ch05 有完整章节 ✓（0.4 存在，0.5 删）
- `/onboard`, `/create-command`, `/integrate-skill` 都有 ✓

**结论**：0.4 的 "遗留功能文档" 在 release/ 里**完整保留**，没缺。

---

## 可清理文件

### docs.json 的 Release 下拉未引用的 pre-release changelog（纯磁盘孤儿文件）

docs.json 第 319-332 行只把 13 个 stable 版本（0.4.0, 0.3.10~0.3.1, 0.2.0, 0.1.9）放进了 Release 下拉。磁盘上的 beta/rc 文件虽然可以被 Mintlify 构建，但**没有任何 navigation 入口**。

**每个 locale 39 个 orphan 文件，合计 78 个**：

```
release/changelog/v0.3.0-beta.0.mdx
release/changelog/v0.3.0-beta.7.mdx ~ beta.16.mdx   (10 个)
release/changelog/v0.3.0-rc.0.mdx ~ rc.6.mdx        (7 个)
release/changelog/v0.4.0-beta.1.mdx ~ beta.10.mdx   (10 个)
release/changelog/v0.4.0-rc.0.mdx ~ rc.1.mdx        (2 个)
release/changelog/v0.5.0-beta.0.mdx ~ beta.8.mdx    (9 个)
                                          合计       39 个 en
```

+ `release/zh/changelog/…` 镜像 39 个 = 78 个

### 清理选项

- **A 选项（激进清理）**：`git rm` 全部 78 个 orphan 文件。节省 ~400 KB，Mintlify 构建更快一点。Git 历史还在，需要时 `git log --diff-filter=D -- release/changelog/` 能翻出来。
- **B 选项（保留）**：因为都是 `cp -r` 带过来的，保留成本为 0，避免未来想恢复时需要从 git 历史翻。缺点：磁盘混乱，有人误以为可以直接访问这些 URL（Mintlify 实际上不会 serve 因为没在 navigation 里）。
- **C 选项（只清 0.5-beta）**：只删 `v0.5.0-beta.*` 这 18 个文件（9 × 2 locale），保留 0.3/0.4 的 beta/rc，因为这些是历史稳定版的孕育过程，对 release track 语义上 "不那么错位"。

**建议：C 选项**。0.5-beta 的 changelog 里提到的全是未来式功能，对 0.4 GA 用户100% 无意义，删了不丢任何东西。0.3/0.4 的 beta/rc 是历史，保留磁盘冗余但文件仍有归档价值。

---

## 建议策略（三选一）

### A. 快速修（预计 ~2-3h）

修复目标：把 release/guide/ 里的 **中等错位**（5 个 en 文件 + 5 个 zh 镜像 = 10 个）按 0.4.0 GA 对齐，只改命令名：

1. 把所有 `/before-backend-dev` + `/before-frontend-dev` 改成 `/before-dev`
2. 把所有 `/check-backend` + `/check-frontend` 改成 `/check`
3. 把所有 `/trellis-check-backend` + `/trellis-check-frontend` 改成 `/trellis-check`
4. 同步更新 ch02 的目录树示例、ch05 的命令参考表
5. ch01/ch04 的 "平台列表" 从 6 个扩到 12 个（加 Gemini / Qoder / CodeBuddy / Copilot / Windsurf / Droid）
6. 顺手清掉 skills-market/trellis-meta.mdx 里的 "Antigravity" 字样（0.4 没有）
7. 清理 78 个 orphan changelog（走 C 选项 only 删 0.5-beta）

**优点**：工作量可控；保留了 release/guide/ 已经写好的全部叙事；修完之后 0.4 用户看到的内容基本符合其安装版本。
**缺点**：0.4 大卖点 monorepo 仍然没教程，这个要补就是另一个工作量。
**定位**："Release 内容滞后一点但不误导" —— 作为 version-selector 的第一版 release track 是可以接受的。

### B. 按 0.4.0 tag 回滚（预计 ~6-10h）

1. 从 git 历史找到 0.4.0 GA tag（`git log --all --oneline | grep "0.4.0\b"` 找到对应 commit）
2. `git checkout <tag> -- docs-site/guide/ docs-site/zh/guide/ docs-site/index.mdx …` 把那个时间点的 en + zh 内容 checkout 到 release/ 对应位置
3. 覆盖 release/changelog/ 里 0.4.0 之后的（beta/rc）
4. 手动核对 docs.json 对应 pages 引用是否还一致（0.4.0 当天可能 navigation 结构和现在不一样）
5. 在新的 release/ 上测试 Mintlify 构建

**优点**：最准确 —— release 下拉里看到的就是 0.4.0 GA 发版当天的文档，与 npm 上的 0.4.0 包完全对应。
**缺点**：
- 如果当时的 guide/ 结构和现在差异大（章节分法、appendix 编号、双语一致性），需要手工 merge；
- 0.4.0 当天的 docs-site 里可能没有现在这些 showcase/blog/skills-market 条目，需要决定这些要不要保留在 release 下（showcase 是 evergreen 内容，保留合理）；
- 中间万一发现 0.4.0 当天的文档本身也有错漏，需要就地修，工作量突破。
**定位**："Release 内容和 npm install @latest=0.4.0 严丝合缝" —— 最正确但最贵。

### C. 放弃 Release track（预计 ~0.5-1h）

撤回这次 version selector：

1. 从 docs.json 删除整个 "Release" version 节（en + zh 都删）
2. `git rm -rf docs-site/release/`
3. 在 banner 里加一行："0.4.0 docs archived at GitHub tag v0.4.0 — see repo"
4. 让 changelog/v0.4.0.mdx 和其他 stable changelog 继续 serve 在 Beta 版本下（它们已经在）

**优点**：立刻解决 "Release 内容错位" 问题；代码改动最小；避免持续维护两份 docs 的成本。
**缺点**：用户切不了版本；文档唯一入口是 latest beta；对 "我想查 0.4.0 怎么用" 的用户不友好。
**定位**："承认 docs-site 现阶段跟不上双 track 维护，先砍掉 Release 切换功能"。

---

## 审计者倾向

**推荐 A + 部分 C**：
- 走 **A 选项**把 release/guide/ 的 split 命令改掉（这是最显眼的错位，影响 ch02 的 quickstart 目录树 / ch05 的命令参考表，0.4 用户跑 quickstart 第一步就会发现目录里没有 `before-backend-dev.md`）；
- 同时走 **C 选项的 0.5-beta-only 清理**（78 个 orphan 里只删 18 个 0.5-beta 文件）；
- monorepo 教程缺失作为后续任务（P2），不 block 这次 release dropdown；
- B 选项不推荐 —— 0.4.0 tag 当天的 docs 本身也可能不完整（因为文档一直在持续演进），回滚 +hand-merge 投产出比不高。

修完后 Release dropdown 切过去的用户会看到：
- 正确的命令名称（与 0.4.0 安装包一致）
- 完整的 0.4 平台列表（12 个）
- 历史功能文档齐全（/parallel, /record-session, /check-cross-layer 等）
- 没有 0.5 的未来式内容"漏气"

## Caveats / Not Found

- **未确认**：是否存在一个真正的 0.4.0 GA tag 对应的 docs-site 快照 —— 如果要走 B 方案需要先 `git log` 确认。
- **未确认**：docs-site 的 Chinese track 是否存在 0.4.0 当天已有但 release/zh/ 丢失的文件 —— 如果走 A 方案直接改 zh 镜像即可，不影响；如果走 B 方案需要核对。
- **未覆盖**：没有审计 `release/blog/`、`release/contribute/`、`release/templates/`、`release/use-cases/` 的逐字正文，只做了关键词扫描（0.5-only 关键词零命中），如果走 A 方案这些目录默认原样保留。
