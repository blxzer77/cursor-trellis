# 修复 update 机制：只更新 init 时选择的平台

## Goal

修复 `trellis update` 会更新所有平台模板的 bug，使其只更新用户 init 时选择的平台。

## Requirements

- init 时记录用户选择的平台
- update 时读取配置，只收集用户选择的平台模板
- 确保向后兼容

## Acceptance Criteria

- [ ] `trellis init --claude` 后，`trellis update` 不会创建 `.cursor/` 或 `.iflow/` 目录
- [ ] 配置存储位置合理（建议 `.trellis/config.json`）
- [ ] 没有配置文件时的默认行为合理（向后兼容）
- [ ] lint/typecheck 通过

## Technical Notes

问题代码位置：`src/commands/update.ts` 的 `collectTemplateFiles()` 函数

目前硬编码收集所有平台模板：
```typescript
const claudeCommands = getCommandTemplates("claude-code");
const cursorCommands = getCommandTemplates("cursor");
// 没有检测用户选了哪些
```

修复方案：
1. `init` 时写入配置：`.trellis/config.json` 中记录 `tools: ["claude", "cursor"]`
2. `update` 时读取配置，只收集对应平台的模板
3. 没有配置文件时，检测哪些目录存在（`.claude/`, `.cursor/`, `.iflow/`）作为 fallback
