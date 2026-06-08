# Rename "empty" Template to "from scratch"

## Background

User feedback: `trellis init` 的模板选择中 "empty templates" 这个命名很奇怪。从产品角度应该叫 "from scratch"，并且不应该真的是空的 — 应该让 AI 根据项目情况自动生成初始内容。

## Goal

1. Rename the "empty" template option to "from scratch" (or similar)
2. Instead of generating truly empty spec files, generate contextual starter content based on the project

## Requirements

- [ ] Rename template choice label from "empty templates" to "from scratch" (or "start fresh")
- [ ] Update the description to clarify: AI will generate initial content based on your project
- [ ] After init with "from scratch", spec files should have meaningful starter content (not just empty headers)
- [ ] Consider: should AI analyze the project (package.json, file structure) to generate relevant specs?

## Technical Notes

- Affects: `trellis init` interactive prompt (template selection)
- Related files: `src/commands/init.ts`, template registry
- Need to check if "empty" is referenced elsewhere (docs, tests, etc.)
