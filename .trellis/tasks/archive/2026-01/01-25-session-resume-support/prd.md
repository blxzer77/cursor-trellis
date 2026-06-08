# Add Session-ID Support for Agent Resume

## Goal

当 multi-agent pipeline 中的 agent 被 block（如等待用户输入、网络问题等）时，用户可以快速 resume 继续工作。

## Background

- Claude Code CLI 支持 `--session-id <uuid>` 启动时指定 session ID
- 支持 `--resume <session-id>` 恢复指定会话
- 当前 start.sh 启动 agent 后没有记录 session ID，导致 block 后难以恢复

## Requirements

### 1. start.sh 修改

- [ ] 启动 agent 前生成 UUID 作为 session ID
- [ ] 将 session ID 保存到 `$WORKTREE_PATH/.session-id`
- [ ] 启动 claude 时使用 `--session-id` 指定该 ID
- [ ] 在 summary 输出中显示 session ID

### 2. status.sh 修改

- [ ] 检测 stopped/blocked agent 时，检查是否存在 `.session-id` 文件
- [ ] 如果存在，打印一行可直接复制执行的 resume 命令：
  ```
  Resume: cd <worktree> && claude --resume <session-id>
  ```

## Technical Notes

```bash
# 生成 UUID (macOS/Linux 兼容)
SESSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# 或使用 /proc/sys/kernel/random/uuid (Linux only)
# SESSION_ID=$(cat /proc/sys/kernel/random/uuid)

# 启动时指定
claude --session-id "$SESSION_ID" -p --agent dispatch ...

# Resume
claude --resume "$SESSION_ID"
```

## Acceptance Criteria

- [ ] 启动 agent 后 `.session-id` 文件被创建
- [ ] `status.sh` 对 stopped agent 显示 resume 命令
- [ ] 执行 resume 命令能成功恢复会话
