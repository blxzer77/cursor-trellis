# First Principles Analysis: Polyrepo 检测与手动配置

## Axioms

1. **Trellis 在单一根目录管理工作流状态**；多 package 支持的存在原因是某些项目跨越多个需要独立 spec context 的代码单元。不可再分，因为"单一根"是 Trellis 的存在前提。
2. **init 时 Trellis 只能用文件系统作为信号** — `.git`、`pnpm-workspace.yaml` 等。没有语义信号 — 只有文件 — 因为 Trellis 是本地 CLI，无外部上下文输入。
3. **任何不带用户确认的 FS 检测在某些布局下必然误报**（如 `~/projects/` 下一堆独立 repo）。不可再分，"用户想分组"vs"用户走错目录"在 FS 上无法区分。
4. **"把 N 个 repo 当一个项目管"是人类意图，不是 FS 属性**。意图只在用户选择中编码，文件里不写。
5. **`config.yaml` 是下游 Python 运行时的唯一真理来源**（已通过 `get_packages` 验证）。CLI init 只是写 config.yaml 的一种方式。

## Problem Essence

5 Whys：
- 为什么 `--monorepo` 失败？detector 不识别 sibling `.git`
- 为什么不识别？因为 sibling `.git` 在意图上歧义
- 为什么歧义是问题？因为无确认的自动行为 = 沉默惊喜
- 为什么沉默惊喜糟糕？因为 Trellis 会写 config.yaml + 创建 N 个 spec 目录
- 为什么有摩擦是核心？因为 Trellis init 哲学是非侵入式

**Core problem**：系统需要一个意图声明通道处理 polyrepo 情况，因为意图无法从 FS 单独推断。

**Success criteria**：
- 用户能用 ≤1 步摩擦表达"把这 N 个当 monorepo"
- 系统永远不会沉默地把独立 repo 当 monorepo
- config.yaml 最终被正确填充供运行时消费

## Assumptions Challenged

| Assumption | Challenge | Axiom(s) | Verdict |
|---|---|---|---|
| 需要 `parsePolyrepo` 自动检测 | 检测在已声明意图后只是省力工具，不是核心 | A2,A3,A4 | **Modify**（最终接受为 parser #7） |
| 需要 `--packages` flag | 按 A4+A5，config.yaml 是意图声明形式，flag 是同概念瞬时形式，UX 糖 | A4,A5 | **Discard** |
| `DetectedPackage` 需要 `source: enum` | 运行时已用双 boolean，TS 加 enum 制造跨语言不一致 | A5 | **Discard** |
| 自动检测是用户友好路径 | 真摩擦是"我不知道 schema"，显式打印 schema 示例更友好 | A3 | **Modify** |
| Polyrepo 和 submodule 是不同概念 | 从运行时看，两者都是"有自己 git 历史的 package"，行为同构 | A4,A5 | **Modify** — schema 已存在 `git: true` |
| `--monorepo` 失败应硬报错 | 用户键入 `--monorepo` 已表达意图，硬报错抛弃这意图 | A4 | **Discard** |

## Ground Truths

1. **Polyrepo 意图必须人为提供** — sibling `.git` 是必要但不充分证据（具体可证伪：移除 `.gitmodules` + 留 N 个 sibling `.git` 不构成 monorepo 凭据）
2. **运行时 schema 已就绪** — `packages: { foo: { path, git: true } }`。`get_git_packages()` 已存在，`(git repo)` 标签已显示，`isGitRepo` 字段已贯穿
3. **`writeMonorepoConfig` 已是非破坏式** — `init.ts:586` 检测到 `packages:` 已存在则跳过；手写 config.yaml 已是可工作的逃生舱
4. **当前 `--monorepo` 失败信息无用** — 直接 exit 1，不告诉用户如何解决
5. **误报代价不对称** — 误判 polyrepo 会写 config.yaml + 创建 N 个 spec 目录；漏判则只是"用户回头加 flag"

## Reasoning Chain（含 user pushback 修正）

### 初版 Phase 4（错误）

GT#1 + GT#5 → polyrepo 扫描必须 opt-in，永不在裸 init 时跑 → 加 `allowPolyrepo` 参数

### User pushback

> "现在识别 monorepo 不是有个自己的规则集吗，在那个规则集下面加上对子目录进行递归的 .git 的识别不行吗？"

### 复查发现 reasoning flaw

`init.ts:762` 已经有 `inquirer.confirm` 让用户看着候选列表确认（先 print packages 再 prompt）。

→ GT#1（意图须人为）实际被**已存在的 confirm prompt 满足**，不需要 `--monorepo` 门槛重复一道。

### 修正后 Reasoning Chain

```
GT#1 + GT#5 + 现有 confirm prompt
  → polyrepo 作为 parser #7 挂在链尾，与其他 6 个 parser 同级
  → 不需要 allowPolyrepo 参数
  → Change A

GT#2 + GT#3
  → 不需要 schema 改造，CLI 侧产出 git: true 并文档化
  → Change B

GT#4
  → --monorepo 失败时打印 checklist + 手写 config.yaml 示例
  → Change C
```

## Conclusion

**关键洞察**（FP 揭示，惯性思维错过）：**运行时已半实现 polyrepo**。按 PRD 字面意思建 `--packages` flag + `source` enum 会与已有架构打架。FP 强迫问"我们到底缺什么"，答案是"补 CLI ↔ runtime 之间的 schema 桥梁"。

**用户反驳让我意识到**：FP 也会过度工程。我用 GT#5 推导出 "auto = silent"，但代码里早就有 confirm prompt，意图门槛已存在。FP 的纪律是好事，但要建立在准确的代码事实上。

### Recommended Approach

| Change | 范围 | GT |
|---|---|---|
| **A** `parsePolyrepo` 作为第 7 个 parser，挂在 `detectMonorepo()` 链尾 | TS | GT#1, GT#5（confirm prompt 满足） |
| **B** `DetectedPackage.isGitRepo` + `writeMonorepoConfig` 输出 `git: true` + config.yaml 模板文档化 | TS + template | GT#2, GT#3 |
| **C** `--monorepo` 失败 → checklist + 手写 config.yaml 示例 | TS | GT#4 |

### Discarded
- `--packages` flag（assumption #2）
- `source` enum（assumption #3）
- `allowPolyrepo` 门槛（user pushback 后撤回）
- N > 阈值时翻转 default（用户拍板"按 Enter 是用户责任"）

### Trade-offs Acknowledged
- 在 `~/projects/` 下裸 `trellis init` 误按 Enter 会一次性创建 N 个 spec 目录。可接受 —— 47 个候选展开屏幕已是足够视觉警告
- `--packages` flag 便利被牺牲。可接受 —— config.yaml 是 source of truth

## Validation

- [x] 每个结论可追溯到 GT
- [x] 每个 GT 都被覆盖（含修正后）
- [x] 没跳/糊弄阶段
- [x] Pre-Mortem 压测：失败 #1（误按 Enter）已与用户讨论并拍板不处理；失败 #3（submodule 双重计数）已通过"跳过 submodulePaths 集合"缓解
- [x] Inversion 压测：所有"必然失败"路径已识别并缓解
