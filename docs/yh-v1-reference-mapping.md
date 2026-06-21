# 绘影工作室 v1 参考映射清单

本文件用于把绘影工作室现有能力映射到三个核心参考项目，作为后续前端、后端和任务链路迭代的约束。参考项目只用于借鉴结构和工程方法，不作为照抄对象。

数据日期：2026-06-15  
核心参考：

- ViMAX：多 Agent 创作链路，覆盖创意到视频、小说到视频、剧本到视频，以及导演、编剧、制片、生成器协作。
- Toonflow-app：短剧创作工作台和画布形态，覆盖策划、编剧、分镜、出片，以及剧本、角色、分镜、素材、视频节点组织。
- ArcReel：小说到短视频工程链路，覆盖角色/线索提取、分集规划、剧本 JSON、角色设计图、分镜图、视频片段、FFmpeg 合成、剪映草稿导出、任务队列和 BYOK。

## 2026-06-17 19:48 ArcReel 片段恢复契约落地

| 参考能力 | 绘影落地 | 验证证据 |
| --- | --- | --- |
| ArcReel 的剧本到视频工程链路不把长视频视为单次黑盒调用，而是把片段作为可追踪、可恢复的任务资产 | `/api/video/merge` 的通用分段任务现在在 running/completed/failed 三个节点都写入 `TaskResult.segments` 快照；每段保留 `prompt/duration/ratio/videoModel/videoUrl/lastFrameUrl/error` | `pnpm run qa:video-recovery` 模拟 2 段成功 + 1 段失败，确认失败任务仍保留 3 个片段快照和失败段 prompt |
| 失败恢复要保护已成功片段，避免用户为第 N 段失败重烧前 N-1 段额度 | `successSegmentCount` 只统计有结果片段，`failedSegments` 保留失败 index，为下一步“只补缺失段”API 提供输入 | `pnpm run ts-check` 通过；`docs/yh-task-reliability-qa.md` 已记录 60 秒限流失败后的结构性修复路径 |
| 失败片段恢复应先确认可补对象，再由用户明确进入真实费用路径 | 新增 `/api/tasks/{taskId}/resume-segment`，默认 dry-run 自动定位失败或缺失片段，已完成片段返回 409，真实补段必须 `allowRealCost=true` | `pnpm run qa:resume-segment` 通过：定位第 3 段失败片段、拒绝重跑第 1 段、阻止未授权真实补段 |

## 质量门审计

- 上一轮产出：已将自动化从纯调研改为基于 ViMAX、Toonflow-app、ArcReel 的分析、测试和迭代优化；没有项目文件增量。
- 当前仓库状态：`work/project/projects` 目录不是 git 仓库，不能用 `git diff` 审计，只能用文件内容、时间戳、运行命令和页面验证记录审计。
- 运行日志：当前线程未挂接 app terminal，会话内没有可读取的服务日志。
- 功能边界：已读取 `docs/product-function-retention.md`，后续不能隐藏或删除 `home`、`video`、`image`、`smart`、`media`、`film`、`tasks`、`/node-editor`、`/research`、`settings/BYOK`。
- 外部来源：GitHub API 已出现 rate limit，后续星数只作为快照参考；功能判断优先使用 README、源码目录、release notes 和本地运行验证。

## v1 模块映射

| 绘影模块 | 当前保全要求 | ViMAX 参考 | Toonflow 参考 | ArcReel 参考 | v1 动作 |
| --- | --- | --- | --- | --- | --- |
| `home` 创作工作台 | 保留聚合输入、作品预览、工具箱、优秀作品参考 | 用创意/小说/剧本三种入口承接创作意图 | 用“策划 -> 编剧 -> 分镜 -> 出片”表达工作流 | 用项目工作台组织项目、素材、任务状态 | 增强：改成项目化创作入口，保留快速生成和作品预览 |
| `smart` 绘影精灵 | 保留剧本、分镜、提示词协作和转入生成 | 借鉴 Director / Screenwriter / Producer 多 Agent 分工 | 借鉴 ScriptAgent 生成故事骨架、改编策略、结构化剧本 | 借鉴 Agent 自动检测项目状态并调度子任务 | 增强：从聊天助手升级为导演助手，输出结构化剧本、角色、分镜和镜头计划 |
| `film` 影视创作 | 保留长流程影视创作、分镜与成片管理 | 借鉴 Novel2Video 和 Script2Video | 借鉴短剧生产闭环 | 借鉴小说上传、角色/线索提取、分集规划、视频合成 | 增强：成为长流程主入口，承接小说/剧本导入、分集、角色追踪、镜头拆分 |
| `node-editor` 工作流画布 | 保留节点编排、工作流保存、导出到视频生成表单 | 借鉴多阶段 Agent pipeline 的状态流 | 借鉴无限画布组织剧本、角色、分镜、素材、视频节点 | 借鉴任务状态与素材版本回滚 | 增强：画布节点从通用流程升级为短剧生产节点 |
| `video` AI 视频 | 保留提示词、参考素材、历史作品与生成链路 | 借鉴镜头规划、参考管理和一致性验证 | 借鉴视频节点回流工作台 | 借鉴分镜图/宫格图/参考图到视频片段再合成 | 增强：保留快速生成，新增镜头级生成队列和片段复用 |
| `image` 图片生成 | 保留文生图、参考图、风格参考和图片历史 | 借鉴角色、场景、风格一致性校验 | 借鉴角色、场景、素材节点 | 借鉴角色设计图、线索设计图、分镜图、风格参考图 | 增强：图片资产按角色、场景、道具、分镜分类沉淀 |
| `media` 图文/素材 | 保留图文资产、平台化内容和素材管理入口 | 借鉴参考图像管理 | 借鉴素材节点和对象存储 | 借鉴项目导入/导出、素材版本历史 | 增强：定位为项目资产库，兼容图文平台内容，不从主流程移除 |
| `tasks` 任务中心 | 保留任务状态、生成结果、打开/复用/重新生成 | 借鉴阶段切换、资源管理、重试/降级逻辑 | 借鉴任务拆解、质量审阅、修订反馈 | 借鉴异步任务队列、RPM 限制、并发通道、lease 调度、断点续传、SSE 追踪 | 重点增强：形成公网可用任务系统，支持失败重试、状态恢复、结果复用 |
| `settings/BYOK` | 保留 API Base、API Key、模型名、连接测试、清除配置 | 借鉴 LLM/Image/Video provider 配置 | 借鉴设置中心配置文本/图像/视频模型 | 借鉴自定义供应商、Base URL、API Key、多 key、项目级/全局切换 | 重点增强：先做安全 BYOK 与连接测试，不做可编程供应商代码 |
| `/research` 平台研究 | 保留研究页入口 | 可展示 Agent 链路依据 | 可展示画布工作台依据 | 可展示工程链路依据 | 保留：作为能力说明和研究入口，不参与主创作阻塞链路 |

## v1 功能决策

| 能力 | 决策 | 理由 |
| --- | --- | --- |
| 创意/小说/剧本三入口 | 新增 | ViMAX 三入口清晰，能降低用户理解成本 |
| 导演助手 | 增强 | 由 `smart` 承担，输出结构化中间产物 |
| 角色一致性资产 | 新增 | ArcReel 和 ViMAX 都把角色一致性放在核心链路 |
| 场景/道具/线索资产 | 新增 | ArcReel 的线索追踪适合解决跨镜头连贯性 |
| 分集/章节切分 | 新增轻量版 | v1 先支持文本拆分和人工确认，不追求全自动长篇改编 |
| 短剧生产画布 | 增强 | Toonflow 证明画布适合组织剧本、角色、分镜、素材、视频节点 |
| 镜头级视频任务 | 增强 | 视频生成应从单表单升级为镜头队列，但保留快速生成 |
| 任务断点续传 | 新增 | 公网发布必须能处理长任务失败和恢复 |
| 成本预估/费用追踪 | 暂缓 | ArcReel 有参考价值，但 v1 先保证任务可靠和 BYOK 安全 |
| 剪映草稿导出 | 暂缓 | 先预留导出接口，不进入第一轮实现 |
| 可编程供应商逻辑 | 暂缓 | Toonflow 方案灵活但风险高，v1 只做表单化供应商配置 |

## 下一轮最小实现切片

优先级从高到低：

1. `settings/BYOK` 调用链路审计：确认 API Base、API Key、模型名、连接测试、清除配置是否贯通 `/api/provider/test`，并补安全说明。
2. `tasks` 任务中心审计：确认任务状态、失败、重试、打开结果、复用、重新生成是否有统一状态模型。
3. `smart` 到 `film/video/image/node-editor` 的中间产物流转：确认绘影精灵是否能把剧本、角色、分镜、提示词转入实际生成入口。

## 2026-06-17 S2 落地更新

本轮已把 `smart` 从“聊天助手/快捷入口”推进为第一版导演链路：

| 参考能力 | 绘影落点 | 当前状态 |
| --- | --- | --- |
| ViMAX 的 Director / Screenwriter / Producer / Generator 协作分工 | `src/lib/smart-director-chain.ts` 输出导演、编剧、制片、镜头设计四类结构化 Agent 产物 | 已落地，`pnpm run qa:director` 可验证 |
| Toonflow-app 的资产节点复用思路 | 导演链结果复用 S1 `productionProject.assets/stages/storyboard`，为后续 `/node-editor` 节点化做准备 | 已生成资产结构，尚未接入画布 |
| ArcReel 的剧本到任务队列中间状态 | `/api/smart/director-chain` 创建 `storyboard` 任务，并把 `directorChain + productionProject + shots` 持久化 | 已落地，任务详情可回看 |

后续结构化优先级：S3 把 `productionProject` 和 `directorChain` 映射到 `/node-editor` 可视节点；S4 把该结构继续推进到真实片段生成、合成和导出恢复。

## 验证要求

- 文档类改动：至少用 `pnpm run ts-check` 或 `pnpm run lint:build` 确认项目当前类型/静态检查状态；若失败，记录失败原因。
- 前端改动：必须人工式点击或脚本点击覆盖 `home`、`video`、`image`、`smart`、`media`、`film`、`tasks`、`settings`、`/node-editor`。
- BYOK 测试：只在本地运行配置或浏览器表单输入密钥，禁止写入代码、文档、日志和最终回复。
- Ark 测试顺序：文本连通 -> 最小图片请求 -> 单镜头视频任务创建/轮询；避免无必要的视频费用。
## 2026-06-17 S3 Toonflow 画布资产工作台落地

- 参考点：Toonflow-app 的画布不只是空白编辑器，而是把剧本、角色、场景、分镜、视频片段和任务作为可见节点资产组织起来。
- 绘影落地：
  - 新增 `src/lib/production-canvas.ts`，把 `productionProject` 与 `directorChain` 映射成画布节点和边。
  - 新增 `/api/node-editor/production-canvas`，从任务中心读取最新或指定任务的制作项目，返回可导入 React Flow 的结构化画布。
  - `/node-editor` 增加“从绘影项目导入”，把项目资产、导演链路 Agent、分镜和成片节点一次性导入画布。
  - 新增 `pnpm run qa:canvas`，验证 dry-run 项目可以转成包含 script/agent/character/scene/storyboard/video 的连通画布，且不使用真实 key、不产生费用。
- 保留边界：画布入口仍为 `/node-editor`；原手工建节点和“从视频生成导入”保留；这轮只增强结构化导入，不删除原功能。

## 2026-06-17 S4 ArcReel 剧本到成片工程链路第一版

- 参考点：ArcReel 的核心不是单次生成，而是把剧本/分镜变成可恢复的异步片段任务、合成和导出链路。
- 绘影落地：
  - 新增 `src/lib/production-assembly-plan.ts`，把 `productionProject.storyboard.shots` 转成片段任务计划。
  - 新增 `/api/production/assembly-plan`，把片段计划写回任务结果 `assemblyPlan`，并保留 `usedRealKey=false/incurredCost=false` 的无费用基线。
  - `/api/node-editor/production-canvas` 会把 `assemblyPlan` 注入成片/视频节点，画布可看到后续片段生成计划。
  - 新增 `pnpm run qa:assembly`，验证“导演链路项目 -> 片段计划 -> 任务持久化 -> 画布视频节点”闭环。
- 与 1 分钟视频关系：本轮证明 60 秒项目可被拆成可恢复的片段队列；不宣称真实 60 秒视频生成成功。真实生成仍需按 5s -> 10s -> 30s -> 60s+ 阶梯验证。

## 2026-06-17 Q1/Q3 短剧故事约束落地

- 参考点：
  - ViMAX 的价值不只是多 Agent 名称，而是每个 Agent 围绕同一条剧情意图交接结构化中间产物。
  - ArcReel 的片段任务不能只拿视觉 prompt，应携带剧本意图、连续性和失败后可重试的明确上下文。
- 绘影落地：
  - `productionProject.storyBible` 成为项目级故事约束，统一记录主角、目标、阻碍、冲突、转折、结尾钩子和情绪弧线。
  - `productionProject.storyboard.shots[]` 增加 `storyBeat`、`dramaticPurpose`、`emotionShift`，分镜不再只是画面列表。
  - `directorChain` 四个 Agent 读取 storyBible，输出围绕剧情目的而非泛化视觉风格。
  - `assemblyPlan.segments[].prompt` 变成 story-aware prompt，明确短剧前提、角色动机、当前冲突、剧情目的、情绪变化和连续性规则。
  - `pnpm run qa:short-drama` 作为内容质量门禁，防止后续迭代退回“无意义内容”。
- 下一步：用 story-aware prompt 跑一次真实 10s 或 30s 样片，检查画面是否真的围绕角色目标和冲突，而不是继续生成抽象胶片/宇宙素材。
