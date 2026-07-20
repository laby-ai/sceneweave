# 创作智能体逐镜双路由设计

## 目标

在不改写现有 ViMAX 创作主链的前提下，让规划模型根据完整剧本上下文，为每个镜头边界选择两类语义策略：

- `strict-frame`：同一人物、同一空间、动作匹配或明确要求承接上一镜尾帧，走首帧 I2V。
- `reference-flexible`：主动换景、明显换机位、插叙、蒙太奇或主体跨场景保持，走多参考 R2V。

规划模型只表达叙事意图。模型 ID、Provider、费用门禁和实际调用参数由服务端权威决定，客户端不能伪造。

## 稳定边界

继续复用：

`generate-workspace.tsx → use-vimax-short-drama-skill.ts → /api/smart/vimax-agent-step → productionPlan/project/task/asset/storyboard/assembly/export`

不新增任务中心、Skill 执行器、媒体库或下载路由；不删除现有 R2V、首尾帧、桥接、恢复和导出能力。

## 规划契约

Kimi 的每个 `shot` 新增：

```json
{
  "handoffIntent": "strict-frame | reference-flexible",
  "handoffReason": "与上一镜的叙事和视觉关系",
  "continuityPriorities": ["action", "screen-direction", "subject", "scene", "prop"]
}
```

第一镜默认 `reference-flexible`。后续镜头缺字段、字段非法或模型输出被截断时，服务端根据 `variationType`、动作起止、空间方向和上一镜依赖生成保守默认值；不能因为规划模型遗漏而绕过连续性控制。

规划模型不得返回 Provider 名、模型 ID、API Base、费用决定或实际媒体 URL。

## 服务端权威解析

新增一个窄的纯函数模块，输入为已规范化的镜头、上一镜头、当前 Provider 能力和服务端白名单，输出稳定的逐镜路由决定：

```ts
type ShotGenerationRoute = {
  mode: 'first-frame' | 'multi-reference';
  requestedBy: 'planner' | 'server-default';
  reason: string;
  model: string;
  requiresPreviousLastFrame: boolean;
  referenceRoles: Array<'subject' | 'scene' | 'prop' | 'previous-tail'>;
};
```

解析规则：

1. `strict-frame` 且存在上一镜尾帧时，只能映射到支持首帧的白名单模型。
2. `reference-flexible` 映射到支持多参考图的白名单模型。
3. Provider 同时支持首帧与多参考图时，可输出首帧优先的组合调用，但仍记录为 `first-frame`。
4. 所需能力未就绪时 fail closed；不得静默退化为 T2V 或把普通参考图冒充首帧。
5. 客户端传入的路由、模型或 capability 字段全部忽略。

路由决定写入现有 `productionPlan.continuity` 和 `assemblyPlan.segments`，成为任务恢复、失败段重试和最终交付的唯一状态源。

## HappyHorse 适配

- `happyhorse-1.1-i2v`：请求体包含且仅包含一个 `media[type=first_frame]`；上一镜最后成功版本的尾帧是后续镜头的首帧。
- `happyhorse-1.1-r2v`：沿用现有 1–9 张 `reference_image` 清单，继续承担角色、服饰、场景和道具一致性。
- 不再把 `firstFrameImage` 塞进 R2V 普通参考图后宣称严格首帧承接。
- 旧任务没有逐镜路由时保持现有 R2V 行为，避免历史项目回退。

## Assembly 与边界 QA

首帧路线不再默认生成额外桥接视频。只有规划明确选择转场片且该桥接片会进入最终时间线时，才允许创建桥接任务。

每个边界在交付前记录：

- 上一镜最后成功尾帧 SHA/版本；
- 下一镜实际首帧 SHA/版本；
- 感知相似度、色彩差异和切点突变；
- 使用的路由模式与 planner reason。

`strict-frame` 边界未达到阈值时只阻塞或重试当前镜头，不覆盖最后成功结果；`reference-flexible` 使用较宽阈值，但仍检查人物、服饰、场景和道具锚点。

## 成本、恢复与隔离

- 规划阶段不触发图像或视频 Provider。
- 原费用确认和 readiness 门禁保持不变；逐镜路由不能绕过确认。
- Provider taskId、状态、URL、路由决定和 artifactVersion 继续即时持久化。
- 刷新、进程重启和失败段重试复用同一决定，不重新询问 Kimi，避免重试时路线漂移。
- owner、guest 和 workspace 继续由现有服务端契约隔离。

## 用户界面

用户只看到中文语义：

- `严格接镜`：承接上一镜动作与画面。
- `参考创作`：保持人物与美术设定，允许明显换镜。

不显示 ViMAX、HappyHorse、R2V、I2V 或外部项目名。用户可以查看 Kimi 的简短选择理由，但不能在客户端直接修改 Provider 模型。

## 测试与验收

先用无付费 fixture 完成 RED→GREEN：

1. Kimi 三镜计划能产生逐镜语义意图。
2. 同动作镜映射为首帧 I2V，换景镜映射为多参考 R2V。
3. HappyHorse I2V 请求包含一个 `first_frame`，R2V 请求只包含 `reference_image`。
4. 客户端伪造模型/路由无效。
5. 首帧能力不可用时在 Provider POST 前 fail closed。
6. 刷新、重试和 workspace 切换后路由决定不漂移、不串项目。
7. Assembly 不再丢弃已创建且计划使用的桥接片，也不会为首帧接镜无意义创建桥接任务。
8. 边界 QA 能拒绝明显跳切，而不是只检查时长和文件大小。

真实付费 A/B 不属于实现门禁。代码与正式域无付费路径全绿后，再以用户明确授权的一次第三镜重生成比较当前 R2V 与 I2V。
