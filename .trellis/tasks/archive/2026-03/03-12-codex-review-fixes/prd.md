# v0.4.0-beta.1 Codex Review Fixes

## Background

S1-S4 实现完成后，通过 Codex CLI 对全量 diff（main...feat/v0.4.0-beta）进行了多轮 cross-review。
覆盖 5 个模块：core-update-migration、core-init-detect、dogfooded-scripts、templates、tests。
共发现 17 个问题（5 CRITICAL + 10 WARNING + 2 NITPICK）。

## Verification Summary

人工逐一对照代码验证后，17 个问题中：
- **真问题需修复**: 4 个（CR#5, CR#15, CR#11, CR#2）
- **真问题但影响极小/已知限制**: 5 个（CR#3, CR#8, CR#9, CR#10, CR#12）
- **假问题/设计意图**: 6 个（CR#1, CR#4, CR#6, CR#7, CR#13, CR#14）
- **NITPICK 真但概率极低**: 2 个（CR#16, CR#17）

## Findings

### CRITICAL — 原标记必须修复

#### CR#1: safe-file-delete 路径未校验（数据丢失风险）
- **位置**: `packages/cli/src/commands/update.ts` L151, L257
- **问题**: `safe-file-delete` 直接 `fs.unlinkSync(item.from)` 没有路径边界检查。恶意或错误的 manifest entry（绝对路径或 `../`）可删除任意文件
- **修复**: `path.resolve` 归一化 → 拒绝绝对路径/traversal → 要求 `isManagedPath(item.from)` → 校验失败则 fail closed
- **✅ 验证结果: 假问题** — `collectSafeFileDeletes()` 用 `path.join(cwd, item.from)` 拼接，先经过 `isProtectedPath` 检查。`item.from` 来自打包在 CLI 内部的 JSON manifest 文件（`src/migrations/manifests/*.json`），不是用户输入，不存在注入风险。

#### CR#2: protected-path 过滤器可能跳过合法旧迁移
- **位置**: `packages/cli/src/commands/update.ts` L850
- **问题**: 新增的 protected-path 列表（`.trellis/workspace`、`.trellis/spec`、`.trellis/tasks`、`.trellis/.current-task`）可能阻止 0.2.0 之前的合法迁移
- **修复**: 允许已知历史迁移目标通过 protected-path 检查（allowlist），或仅对非迁移写入应用保护。加回归测试
- **✅ 验证结果: 真问题但影响小** — 0.2.0.json 确实有 `"to": ".trellis/workspace"` 等 migration target 在 PROTECTED_PATHS 中。但实际影响很小：0.2.0 迁移只在极早期版本升级时触发，且 skip 只是跳过不执行（不报错），这些目录在 init 时已创建。

#### CR#3: .gitmodules 误判 monorepo
- **位置**: `packages/cli/src/utils/project-detector.ts`
- **问题**: 仅有 `.gitmodules` 文件就会被识别为 monorepo，即使没有任何 workspace 配置。可能把普通单仓项目误判
- **修复**: 只在检测到真正的 workspace manager（pnpm/npm/Cargo/go/uv）时才启用 monorepo。submodules 作为元数据，不单独触发 monorepo 模式
- **✅ 验证结果: 真问题但影响小** — L554: `detected = true` 仅凭 `.gitmodules` 存在就设为 true。但如果仅有 `.gitmodules` 没有 workspace manager，`packages` Map 只含 submodule entries，init 仍能正常工作。Init 是一次性操作，用户会看到结果。

#### CR#4: 包名冲突导致 spec/config 覆盖
- **位置**: `packages/cli/src/utils/project-detector.ts`
- **问题**: 用 `pkg.name` 作为 `spec/<name>` 和 `config.yaml` 的 key。如果包名冲突（如 Go module 只取最后一段），会互相覆盖
- **修复**: 用归一化的包路径作为稳定 key，加冲突检测
- **✅ 验证结果: 假问题** — `detectMonorepo()` 的 Map key 是 normalized **path**（如 `packages/cli`），不是 name。L601: `packages.has(np)` 检查的是路径。Codex 误读了代码。

#### CR#5: update.skip 测试假绿（tautological）
- **位置**: `packages/cli/test/commands/update.integration.test.ts` L424, L432
- **问题**: 测试文件内容是 `"some content"`（hash 不匹配），所以即使 `update.skip` 逻辑完全坏了，文件也不会被删，测试照样过
- **修复**: 使用 hash 匹配的内容，验证有无 `update.skip` 时行为确实不同
- **✅ 验证结果: 真问题** — 测试 #20 写入 `"some content"`，其 hash 不在任何 manifest 的 `allowed_hashes` 中，所以 `collectSafeFileDeletes` 会返回 `skip-modified`，文件被保留。即使完全删除 `update.skip` 检查逻辑，测试仍会通过。**必须修复。**

### WARNING — 建议修复

#### CR#6: safe-file-delete 无需 --migrate 即执行
- **位置**: `update.ts` L1353, L1632
- **问题**: `safe-file-delete` 在默认 `trellis update` 中就会执行删除，改变了原来"只更新模板"的默认行为
- **建议**: 考虑是否需要 opt-in 或确认提示
- **✅ 验证结果: 设计意图** — 注释明确写着 "safe-file-delete auto-executes (no --migrate needed)"（L137），hash 匹配是安全网。这是有意设计，不是遗漏。关闭。

#### CR#7: manifest 无 schema 校验
- **位置**: `migrations/index.ts` L86, L130
- **问题**: manifest JSON 缺字段（如 `from` 缺失）会导致 `path.join` 抛异常，中断整个 update
- **建议**: 加载时校验 schema，跳过无效条目并打印警告
- **✅ 验证结果: 假问题** — manifest 是 CLI 内部打包的 JSON 文件，经过代码审查和测试，不是外部输入。添加 schema 校验是过度防御。关闭。

#### CR#8: 删除失败静默吞错 + config 解析失败回退空数组
- **位置**: `update.ts` L262, L335
- **问题**: 文件删除失败不报错；`config.yaml` 解析失败时 skip 列表回退为空，可能导致本该跳过的文件被删
- **建议**: log 删除失败；config 解析失败时禁用 safe-file-delete（fail-safe）
- **✅ 验证结果: 半真** — 删除失败的 catch 注释 "File may have been removed between classify and execute" 是合理的竞态处理。但 `loadUpdateSkipPaths` catch 返回 `[]` 确实有理论风险（config.yaml 存在但解析异常时 skip 列表为空）。不过 safe-file-delete 还有 hash 校验兜底，实际风险极低。**可选修复。**

#### CR#9: workspace glob 只支持 segment-level `*`
- **位置**: `project-detector.ts`
- **问题**: `packages/*` 能匹配，但 `packages/**`、`pkg-*` 等常见 glob 不行
- **建议**: 用 `fast-glob` 或 `minimatch` 替换自定义匹配器
- **✅ 验证结果: 真问题但已知限制** — `matchGlobSegments` L294 只处理 `*` 作为完整段，不支持 `**` 和前缀/后缀 glob。覆盖了最常见的 `packages/*` 模式，但 `apps/*-service`、`libs/**` 等模式不工作。**可延后。**

#### CR#10: --monorepo + 0 包时静默回退单仓
- **位置**: `project-detector.ts`
- **问题**: 用户显式传 `--monorepo` 但检测到 0 个包时不报错
- **建议**: 此时应报错并给出诊断信息
- **✅ 验证结果: 真问题但影响小** — `detectMonorepo` 返回空数组时不会报错。但 init 是一次性操作，用户会看到没有生成包级 spec。**可延后。**

#### CR#11: start.py submodule status 解析丢失前缀
- **位置**: `.trellis/scripts/multi_agent/start.py` L192
- **问题**: `status_out.strip()` 会移除开头的空格前缀，导致已初始化的 submodule 被误分类
- **建议**: 在 strip 前先解析前缀字符
- **✅ 验证结果: 真问题** — `git submodule status` 输出格式：空格前缀=已初始化，`-`=未初始化，`+`=有修改。`.strip()` 会移除 leading space，导致已初始化的 submodule 的 `prefix = status_line[0]` 读到 commit hash 首字符而非空格。**应修复。**

#### CR#12: create_pr.py task.json 写入非原子
- **位置**: `.trellis/scripts/multi_agent/create_pr.py` L283, L455
- **问题**: `_write_json_file()` 不检查返回值，写入中断可能产生半截 JSON
- **建议**: 改用 tmp + `os.replace` 原子写入
- **✅ 验证结果: 真问题但影响极小** — task.json 是很小的文件（<1KB），写入中断概率极低。非原子写入理论上有风险但实际几乎不会发生。**可延后。**

#### CR#13: submodule 分支 diverge 只警告不阻断
- **位置**: `create_pr.py` L194
- **问题**: submodule 分支 diverge 时只打警告继续执行，可能把过期 commit 包进 PR
- **建议**: 改为 hard stop 或要求显式 `--allow-diverged`
- **✅ 验证结果: 设计选择** — 警告而非阻断是合理的——用户可能知道 diverge 原因，强制阻断会降低易用性。关闭。

#### CR#14: session-start hook config 加载失败静默回退全量扫描
- **位置**: claude/iflow/opencode session-start hooks
- **问题**: monorepo config 加载异常时回退到全量 spec 扫描，可能注入错误上下文
- **建议**: 注入 `<config-warning>` 提示；monorepo 模式下 fail closed
- **✅ 验证结果: 设计意图** — `_load_trellis_config` L158: `except Exception: return False, {}, None, None, None`，回退到单仓模式。`_resolve_spec_scope` 对 `None` scope 返回全量扫描（L264），是 fail-safe（注入所有 spec 而非注入错误 spec）。关闭。

#### CR#15: safe-file-delete happy path 没测
- **位置**: `update.integration.test.ts`
- **问题**: 只测了保留/缺失/跳过的场景，没测真正匹配 hash 成功删除的 happy path
- **建议**: 补充测试：文件被删、hash 记录被清、空父目录被清理
- **✅ 验证结果: 真问题** — 测试 #18 测 preserve（hash 不匹配），#19 测 missing，#20 测 update.skip。没有任何测试验证 hash 匹配后文件被成功删除。**必须补充。**

### NITPICK — 可延后

#### CR#16: create_pr.py 默认分支 hardcode "main"
- **位置**: `create_pr.py` L105
- **问题**: `origin/HEAD` 查找失败时 fallback 到 `"main"`，对用 `master` 或自定义默认分支的仓库不兼容
- **建议**: 用 `gh repo view --json defaultBranchRef` 查询
- **✅ 验证结果: 真问题** — `return "main"` fallback 对使用 `master` 的仓库不兼容，但属于 edge case。**可延后。**

#### CR#17: TOML section 解析用 indexOf 可匹配前缀
- **位置**: `project-detector.ts`
- **问题**: `indexOf` 匹配 section 头可能匹配到名字是前缀的不同 section
- **建议**: 用锚定正则 `^\[section\]\s*$`
- **✅ 验证结果: 真问题但概率极低** — section 名重复前缀在实际 TOML 文件中几乎不会出现。**可延后。**

## Revised Priority Matrix

| 优先级 | 编号 | 判定 | 理由 |
|--------|------|------|------|
| **P0 必修** | CR#5, CR#15 | 真问题 | 测试假绿 / happy path 测试缺失 |
| **P1 应修** | CR#11 | 真问题 | submodule status 解析 bug，影响 multi-agent pipeline |
| **P2 可选修** | CR#2, CR#8 | 真但影响小 | 历史迁移 edge case / config 解析 fail-safe 可加强 |
| **P3 延后** | CR#3, CR#9, CR#10, CR#12, CR#16, CR#17 | 真但影响极小 | Init 一次性 / glob 限制 / 极低概率 |
| **关闭** | CR#1, CR#4, CR#6, CR#7, CR#13, CR#14 | 假问题或设计意图 | Codex 误读代码 / 有意为之 |

## Acceptance Criteria

- [ ] P0: CR#5 测试重写（用匹配 hash 的内容）+ CR#15 补充 happy path 测试
- [ ] P1: CR#11 修复 start.py submodule prefix 解析
- [ ] P2: 修复或记录延后理由
- [ ] 全量测试通过（459+）
- [ ] 再跑一轮 Codex review 确认 P0/P1 问题已解决
