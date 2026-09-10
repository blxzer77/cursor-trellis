# `close-basic`

P29 表名：`close-basic`（不得改名）。层：baseline。

## 职责

Close 槽。在 Evidence 已覆盖之后，写入业务 **Outcome**（completed / cancelled / failed）和收尾结论，并给出学习 disposition（是否需要叫醒 `spec-learning`，本块不亲自改长期 spec）。学习 disposition 除叫醒 `spec-learning` 外，还决定是否写 Notes 索引投影（`note-projection`，见 `personal-memory`）：机器按 disposition 在 Close 边界把本次任务的可复用要点沉淀为 ≤N token 的索引投影（摘要 + 路径指针），供未来窗口第 4 层检索。缺投影槽只留痕、不阻塞 Close。Lite：缺 Git、缺 `task-map.md`、缺 `children[]` 都不得挡 Close。物理目录是否搬进 `archive/` 不改变 Outcome。需要 Integrate 的 Task 未完成集成不得 Close（那是 `parent-child` 的条件，本块遵守 Kernel 因果，不自己做集成）。

## 触发/披露

Phase=Close，或 Verify 已过且人走 Finalize 时加载。Open / Define / Execute 当天不讲归档、不灌 archive CLI。收尾结束后本块教战从常驻包拿掉，只留 Outcome。

Agent 看见：

1. Evidence 槽未完成 → 不得 Close。
2. 不得把 `git commit`、推送、物理 archive 当成 Close 本身。
3. cancelled / failed 必须带原因进审计（经 Kernel），不得假装 completed。
4. 学习决策只输出 disposition：`update-spec`（叫醒 `spec-learning`）/ `no-update` / `unsure`（叫醒 `personal-memory` 检索）/ `note-projection`（机器写 Notes 索引投影，见 `personal-memory`）。disposition 只决定叫醒谁、写什么槽，本块不亲自改长期 spec。Notes 投影槽缺位**只留痕、不阻塞**：即使没有写成投影，Close 照常成立（同 Lite 下 `session_auto_commit` 失败仍放行收工的语义）。
5. Finalize 门（commit/远程）仍归 `approval-personal`；本块在门过后写 Outcome。

用户看见：阶段名 Close。结果是完成、取消还是失败。Lite 不要求先有一次 Git 提交才允许收工。缺 Notes 投影不会让收工卡住；投影是机器在边界自动写的，用户不需要被追问「要不要写记忆」。

渐进：非 Close/Finalize 窗口不加载本块。

## 停止条件

- 输入：Verify 完成（AC 已覆盖）；若 topology 要求 Integrate，则集成已完成或 Child 已 cancelled。
- 输出：Outcome + 收尾结论 + 学习 disposition。
- 停止：用物理 retention 冒充完成；无 Evidence 关单；Parent 未集成就 Close。
- Lite 缺 Git 不得挡 Close；缺 `task-map.md`、缺 `children[]` 也不得挡 Close；**缺 Notes 索引投影不得挡 Close**（只留痕、不阻塞）。

## 关掉必须消失

没有业务收尾，生命周期缺 Close 槽，预检应拒绝。不得靠「目录还在 archive 里」假装完成。

## 不得带走

`git commit` / PR（`vcs-integration`）；物理压缩搬家（`retention-storage`）；写回 `.pactile/spec`（`spec-learning`）；AC 映射（`verify-basic`）。