## 自动使用 checklist-loop

凡是涉及 **bug 修复、功能新增、UI 改版、设计调整、数据源切换** 等非 trivial 任务，必须使用 `/checklist-loop` skill 流程：

1. **Round 0**: 分析问题 → 制定 checklist → 提交用户审批
2. **Round 1**: 用户确认后执行 → B review → C/D/E 测试 → 提交结果
3. **Round 2+**: 根据用户反馈修复 FAIL 项，最多 3 轮
4. 构建前后端

---

## 构建规则

每次修改代码后，必须同时构建前端和后端：

```bash
cd ui && npm run build && cd .. && taskkill //f //im stockmate-tauri.exe 2>/dev/null; sleep 1 && "$HOME/.cargo/bin/cargo" build --release
```

- `target/release/stockmate-tauri.exe` 为最终可执行文件
- 构建完成后提醒用户重启 app

---

每个问题的工作模式：
1. 启动一个subagent A, 负责具体的任务执行。
2. 启动一个subagent B, 负责问题的分析和策略制定, 监督 A的执行和代码review.
3. 启动3个subagent C,D,E, 负责测试评估任务的执行结果。
4. 主agent负责根据任务和执行方案，制定一个检查表，并监督整个任务的执行过程，确保各个subagent之间的协作顺畅。
5. 任务每一轮结束后，把检查表给用户审查，检查表中包含任务执行的各个环节和评估指标，用户可以根据检查表提出修改意见。根据用户的反馈，主agent会调整任务执行方案，并重新分配subagent的任务，确保最终结果符合用户的期望。