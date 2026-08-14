# Athena Agent UI 1.0 - GA 运维工作区

[English](ga-readiness-v1.0.md) | [简体中文](ga-readiness-v1.0.zh-CN.md)

Operations 工作区只展示后端证据，不会在浏览器中伪造健康状态或成功率。

## 管理员可查看内容

- 汇总 GA 状态与逐项 Readiness；
- Runtime Client 和 Launcher 提供的证据引用；
- 加密备份库存、创建、验证与恢复入口；
- 固定的十条核心用户旅程；
- 无副作用 Golden Journey 基础设施预检；
- 每条旅程的验证级别、不可变 Run ID 与最近持久化结果。

状态颜色保持协议语义。`EXTERNAL_REQUIRED` 不等于成功，表示仍需真实设备流程、安装包测试、签名、公证或持续压测。

`PREFLIGHT` 只表示基础设施检查，永远不能显示为成功。只有独立提交的 `E2E` 证据才能满足 `golden.suite` 与 `trace.provenance`；前端只展示后端证据，不在本地提升或改写状态。

## 权限与安全

- Readiness 和旅程目录要求登录。
- 执行预检和修改备份要求管理员权限。
- 页面不展示模型 Key、网站密码、备份密钥或原始截图 Payload。
- 恢复及其他破坏性操作保留显式确认边界。

## 运维流程

1. 优先在来源组件处理 `FAIL`。
2. 连接桌面设备以验证浏览器和桌面门禁。
3. 创建并验证备份。
4. 执行无副作用预检。
5. 在 UI 外完成安装包、签名、公证和压测，并把证据随 Release 保存。

失败请求显示的 Trace ID 可用于关联 UI、Runtime Client、Runtime、工具和设备日志。
