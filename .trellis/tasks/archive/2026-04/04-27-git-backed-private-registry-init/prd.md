# fix: support git-backed private registry init

## Goal

让 `trellis init --registry <source>` 支持私有 / 自托管 GitLab marketplace。当前 `index.json` 探测使用匿名 `fetch` 请求 raw URL，私有 GitLab 会返回登录页、401/403 或重定向，Trellis 无法进入 marketplace 模式。目标是改为可复用本机 Git 认证能力的实现路径，让用户已有的 SSH key、Git credential helper、企业 SSO 凭据能自然生效。

## What I Already Know

* 用户场景：自建 GitLab marketplace，例如 `https://xx.example.com/web/trellis-marketplace/-/tree/test`，当前 `--registry` 无法初始化。
* 现有版本：`packages/cli/package.json` 当前为 `0.5.0-beta.14`。
* 现有解析层已经支持自托管 GitLab URL，并会把未知 HTTPS 域名映射到 GitLab-compatible source。
* 失败点不是 URL 前缀必须手写 `gitlab:`，而是 registry mode detection 对 `index.json` 使用匿名 HTTP raw fetch。
* 下载阶段仍依赖 `giget` 的 `downloadTemplate()`；如果只把探测改成 git，但下载仍走 giget，私有仓库仍可能失败。

## Requirements

* `trellis init --registry` 对私有 / 自托管 GitLab registry 支持 git-backed 探测与下载。
* marketplace mode 与 direct download mode 仍按 `index.json` 是否存在判断。
* git-backed 路径必须使用用户本机已有 Git 认证能力，不在 Trellis 内保存 token、cookie 或 secret。
* 探测与下载必须使用同一套后端，避免“探测成功、下载失败”的分裂行为。
* 现有公开 GitHub/GitLab/Bitbucket registry 行为保持兼容。
* 错误提示需要区分：仓库不可访问、认证失败、ref 不存在、`index.json` JSON 无效、模板路径不存在。

## Acceptance Criteria

* [x] `parseRegistrySource()` 保持现有自托管 GitLab URL 解析能力。
* [x] 私有 GitLab URL 可通过本机 Git 凭据完成 `index.json` 探测。
* [x] `index.json` 存在且合法时进入 marketplace mode，并可按 `--template <id>` 下载对应 spec。
* [x] `index.json` 不存在时进入 direct download mode，并复制 registry 指向目录。
* [x] `-y --registry` 路径仍会执行同等 mode detection，不把认证失败误判为 direct download。
* [x] 单元测试覆盖 git-backed probe、marketplace download、direct download、认证 / ref / path 错误分类。
* [x] Focused lint、`pnpm typecheck` 与相关测试通过。
  * Note: full `pnpm lint` is blocked by an unrelated pre-existing `Array<T>` lint violation in `packages/cli/test/configurators/platforms.test.ts`.

## Definition of Done

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Technical Approach

推荐方向：保留现有 public registry 的 HTTP/giget 快路径；对自托管 GitLab/GHE、SSH URL、或 HTTP probe 遇到认证 / 非 JSON 登录页场景时，切换到 git-backed backend。

git-backed backend 的核心行为：

* clone / archive 到临时目录，checkout 指定 ref。
* 从 `<registry subdir>/index.json` 读取 marketplace index。
* marketplace mode 下载时，从同一个 clone 的 `template.path` 复制到目标 spec 目录。
* direct download mode 时，复制 registry 指向目录。
* append / overwrite / skip 策略继续沿用现有 `TemplateStrategy` 语义。

## Decision (ADR-lite)

**Context**: 私有 GitLab 的认证通常已配置在用户本机 Git 环境里，HTTP raw fetch 无法复用这套认证，还会把登录页 / 401 / 403 混成 network error。

**Decision**: 为 `--registry` 增加 git-backed registry backend，用 Git 作为私有 registry 的认证和读取入口；公开 registry 的现有 HTTP/giget 路径保持不变。

**Consequences**: 私有 registry 支持更可靠，但 git-backed 路径要求用户环境有 `git` 可执行文件。需要测试临时目录清理、错误分类和不同 `TemplateStrategy` 下的复制行为。

## Out of Scope

* 不在本任务中实现 Trellis 自己管理 GitLab token / PAT / cookie。
* 不支持绕过本机 Git 配置的企业认证流程。
* 不改变 marketplace `index.json` schema。
* 不新增非 GitLab-compatible 自托管 Git 服务的专用 URL pattern，除非现有 GitLab-compatible 默认分支已覆盖。

## Open Questions

* Resolved: 自托管 / SSH registry 优先走 Git；public registry 保持 HTTP 快路径，但 public GitLab raw probe 遇到 auth / login-page JSON 场景会回退到 Git。

## Implementation Notes

* Added `RegistryBackend` and `RegistryProbeResult.backend` so mode detection carries the chosen backend into template download.
* Added git-backed probe and copy-based download path using local `git` credentials.
* Preserved public HTTP/giget path for normal public registry usage.
* Added tests for public HTTP compatibility, Git-backed marketplace/direct downloads, missing refs, missing paths, invalid JSON, and auth classification.

## Technical Notes

* 主要代码位置：`packages/cli/src/utils/template-fetcher.ts`
* CLI 调用位置：`packages/cli/src/commands/init.ts`
* 相关测试：`packages/cli/test/utils/template-fetcher.test.ts`
* 相关规范：`.trellis/spec/cli/backend/error-handling.md`、`.trellis/spec/cli/backend/quality-guidelines.md`
* 代码事实见 `research/repo-findings.md`
