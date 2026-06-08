# 更新文档 — hooks 机制 + 自定义模板

## Goal

在 Trellis 文档站和相关文档中补充 0.3.6 新增功能的说明：
1. Task lifecycle hooks 机制（after_create, after_start, after_finish, after_archive）
2. 自定义远程模板源（`--registry` flag）

## Requirements

* [ ] 文档站新增 hooks 机制说明页
  * config.yaml 配置格式
  * 支持的 hook 事件列表
  * 环境变量（TASK_JSON_PATH）
  * 示例：Linear sync hook
* [ ] 文档站新增自定义模板源说明
  * `--registry` 用法（marketplace 模式 vs 直接下载模式）
  * 自建 marketplace 的 index.json 格式
  * 私有仓库认证（GIGET_AUTH 环境变量）
* [ ] 更新 meta-skill (trellis-meta) 中的功能说明
* [ ] 更新 workflow.md 中与 hooks 相关的流程描述
* [ ] README 或 changelog 中体现新功能

## Acceptance Criteria

* [ ] 用户能通过文档了解如何配置 hooks
* [ ] 用户能通过文档了解如何使用自定义模板源
* [ ] 文档内容与实际代码行为一致

## Definition of Done

* Docs reviewed for accuracy
* Links between pages correct
* No stale references

## Out of Scope

* hooks 和 registry 的代码实现（分别在其他 task 中）
* 视频教程

## Technical Notes

* hooks 实现已合并：PR #76
* 自定义模板源实现在 `03-05-remote-spec-templates` task 中（待完成）
* 文档站位置待确认
* Linear sync hook 脚本：`.trellis/scripts/hooks/linear_sync.py`（仅作为示例，非通用模板）
