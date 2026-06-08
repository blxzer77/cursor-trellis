# trellis update: Respect User Deletions + config.yaml Skip Dirs

## Goal

解决用户删掉不需要的模板文件后，`trellis update` 又把它们加回来的问题。

## Background

### 用户反馈（群聊）

用户删了不需要的 frontend/backend 相关 commands/skills 后，`trellis update` 会把它们当作 "New files" 重新添加。这让用户困惑且反复删除。

### Root Cause

`src/commands/update.ts` 的 `analyzeChanges()`（~line 203）把所有不存在的模板文件都当 "new"：

```ts
if (!exists) {
  change.status = "new";
  result.newFiles.push(change);
}
```

没有检查该文件是否之前存在过（有 stored hash），即用户是否主动删除了它。

## Requirements

### R1: 基于 Hash 识别用户主动删除（优先）

如果模板文件在 `.template-hashes.json` 中有记录但磁盘上不存在 → 用户主动删了 → 不要加回来。

**`analyzeChanges()` 改动：**
```ts
if (!exists) {
  const storedHash = hashes[relativePath];
  if (storedHash) {
    // 之前安装过，用户主动删除 — 尊重删除
    result.userDeletedFiles.push(change);
    continue;
  }
  change.status = "new";
  result.newFiles.push(change);
}
```

**UX 展示：** 在 update summary 中新增一类显示：
```
  Deleted by you (preserved):
    - .claude/commands/trellis/check-frontend.md
    - .claude/commands/trellis/before-frontend-dev.md
```

**恢复方式：** 用户想恢复被删文件时：
- 手动创建文件（下次 update 会当 "changed" 处理）
- 从 `.template-hashes.json` 删除对应条目
- （stretch）新增 `--restore-deleted` flag

### R2: config.yaml 配置跳过目录（补充）

在 `.trellis/config.yaml` 中新增 `update.skip` 配置：

```yaml
update:
  skip:
    - .claude/commands/trellis/check-frontend.md
    - .trellis/spec/frontend/
    - .trellis/spec/backend/
```

**作用范围：** 在 `collectTemplateFiles()` 阶段过滤掉匹配路径的模板。

与 R1 的区别：
- R1 是自动的（基于 hash 记录推断用户意图）
- R2 是显式的（用户主动声明跳过）
- 两者互补，R1 解决大部分场景，R2 给高级用户更多控制

## Acceptance Criteria

- [ ] 有 stored hash 但文件不存在的模板，update 时不再作为 "New files" 添加
- [ ] update summary 中展示 "Deleted by you" 类别
- [ ] config.yaml `update.skip` 路径在 update 时被跳过
- [ ] 未配置 `update.skip` 时行为不变（向后兼容）
- [ ] 已有测试通过
- [ ] 新增测试覆盖两种行为

## Technical Notes

- Hash 文件：`.trellis/.template-hashes.json`
- `ChangeAnalysis` 类型需新增 `userDeletedFiles: FileChange[]` 字段
- R1 优先级高于 R2，可以分两步实现
- config.yaml 读取逻辑已有：`src/templates/trellis/scripts/common/config.py`（Python 侧）
- TypeScript 侧需要新增 config.yaml 读取（或复用已有逻辑）
- update 主逻辑在 `src/commands/update.ts`
