# `init-context` 失败的双层根因

## 用户仓库实际配置

`.trellis/config.yaml`:
```yaml
packages:
  frontend:
    path: iqs-front-human
    git: true
    merge_target: master-human
  backend:
    path: iqs
    git: true
    merge_target: test

# default_package: frontend   ← 被注释掉
```

`.trellis/spec/` 实际目录：
```
.trellis/spec/backend/dev/index.md    # "backend" 是 package 名
.trellis/spec/frontend/dev/index.md   # "frontend" 是 package 名
.trellis/spec/guides/index.md
```

`get_context.py --mode packages` 的输出也印证：
```
### frontend [git repo]
Path: iqs-front-human
Spec layers: dev
  - .trellis/spec/frontend/dev/index.md

### backend [git repo]
Path: iqs
Spec layers: dev
  - .trellis/spec/backend/dev/index.md
```

## 第 1 层：`Error: monorepo project requires --package`

触发路径在 `packages/cli/src/templates/trellis/scripts/common/task_context.py:128-148`:

1. 命令行没传 `--package`
2. 读 `task.json.package` → 空（任务刚 start）
3. `resolve_package(task_package=None, ...)` → 拿 `default_package` → **注释掉了，返回 None**
4. `package is None` → 触发 fallback prohibition → 退出 1

**表面修复**：去掉 `default_package` 的注释即可。但这只是让脚本不报错，**生成的 jsonl 仍然错**（见第 2 层）。

## 第 2 层（真正的坑）：代码假设的目录结构和项目实际不匹配

`task_context.py:48-61` 拼 spec 路径的逻辑：

```python
def get_implement_backend(package):
    spec_base = f"{DIR_SPEC}/{package}" if package else DIR_SPEC
    return [{"file": f"{DIR_WORKFLOW}/{spec_base}/backend/index.md", ...}]
    # → .trellis/spec/<package>/backend/index.md

def get_implement_frontend(package):
    spec_base = f"{DIR_SPEC}/{package}" if package else DIR_SPEC
    return [{"file": f"{DIR_WORKFLOW}/{spec_base}/frontend/index.md", ...}]
    # → .trellis/spec/<package>/frontend/index.md
```

**Trellis 代码假设的结构**：
```
.trellis/spec/<package>/backend/index.md     ← package 内部有 backend/frontend 子目录
.trellis/spec/<package>/frontend/index.md
```
隐含模型：**package = 业务域**，内部按端分层（像 `packages/user-module/{backend,frontend}/`）。

**用户项目实际结构**：
```
.trellis/spec/backend/dev/index.md           ← package 名就是 backend / frontend
.trellis/spec/frontend/dev/index.md
```
实际模型：**package = 端**（语言/技术栈维度），没有"业务域"层。

### 后果

即使传 `--package frontend`，`fullstack` dev_type 会拼出：
- `.trellis/spec/frontend/backend/index.md` ❌ 不存在
- `.trellis/spec/frontend/frontend/index.md` ❌ 不存在

传 `--package backend` 同样错位。**没有任何 `--package` 取值能让 fullstack 在这种布局下跑通**，因为"按端拆包" + `fullstack` 需要跨两个 package 取 spec，而 `cmd_init_context` 用同一个 `package` 变量塞两路：

```python
elif dev_type == "fullstack":
    implement_entries.extend(get_implement_backend(package))   # 同一个 package
    implement_entries.extend(get_implement_frontend(package))
```

## 为什么以前没暴露

Trellis 自己 `init` 时生成的默认 spec 骨架是按"业务域 package"设计的，所以自用/template case 一直正常。用户**手工配了 config.yaml + 按端拆包**（Maven 多模块 + 独立前端仓，monorepo 典型姿势），立刻踩到了隐含假设。

## 为什么不能"修"脚本

理论上可以给 `task_context.py` 加：
- `--package` 接受多值
- 探测多种 spec 布局（`<pkg>/backend/`、`<pkg>/dev/`、平级 `<pkg>/`）
- config.yaml 每个 package 声明 `spec:` 字段

但本质问题不在参数或探测 —— 是**"脚本在没有业务上下文时试图机械猜测"**。任何机械策略都会在某种 monorepo 姿势下错位。正确做法是**把决策权交给懂上下文的 agent**：agent 看了 prd + config + 实际 spec 文件列表后自己挑，肯定比任何通用规则准。

## Why relevant to this task

这份分析确立了"删除机械填充"的必要性，不是修 bug，是砍掉错误的抽象。**任何"给 init-context 打补丁"的方案都会在新 monorepo 姿势下重新翻车**；只有让 agent 自己填才根本解决。
