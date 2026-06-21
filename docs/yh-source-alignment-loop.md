# 绘影开源源码对齐轻量循环

目标：把自动化从“大而全推进”收窄为“源码对照 -> 单点改造 -> 测试证据”的稳定循环，避免每轮堆概念或继续形成屎山。

## 每轮硬规则

1. 只选一个参考项目和一个能力点。
2. 必须实际阅读本地 `references` 里的源码文件，再写结论。
3. 每轮只落一个产品增量：前端页面、后端接口、数据模型、任务链路、画布资产或发布 readiness。
4. 不把制作业务规则塞进 API route、task-manager 或前端组件；新业务逻辑进入窄 helper/service。
5. 没有测试证据，不更新复刻百分比。
6. 涉及架构边界的改动必须运行 `pnpm run qa:architecture-guard`；hard violation 必须先修，warning 进入债务清单。
7. 每轮必须运行 `pnpm run qa:iteration-scorecard`，报告复刻度均值、屎山债务分、video submit 行数、遗留 provider 引用数，以及相对上一轮的 delta；如果没有定量增长，必须解释本轮为什么仍有价值。

## 源码对齐入口

| 参考项目 | 优先源码入口 | 先对齐的能力 | 绘影落点 |
| --- | --- | --- | --- |
| ViMAX | `references/ViMax/vimax`、`references/ViMax/tools`、`references/ViMax/vimax_benchmark/*.json` | 多 Agent artifact、故事/角色/场景/镜头连续性评价 | `src/lib/director-chain*`、`src/lib/production-project*`、`src/lib/production-assembly-plan.ts` |
| Toonflow-app | `references/Toonflow-app/src/utils/taskRecord.ts`、`references/Toonflow-app/src/utils/oss.ts`、前端工作台相关目录 | 项目资产、素材持久化、工作台可编辑节点 | `/node-editor`、`src/lib/production-canvas.ts`、productionProject assets |
| ArcReel | `references/ArcReel/lib`、`references/ArcReel/server`、`references/ArcReel/frontend` | 剧本到分镜、任务队列、失败恢复、导出 | `assemblyPlan`、segment queue、task center、export package |
| infinite-canvas | `references/basketikun-infinite-canvas-src/canvas-agent/src`、`references/infinite-canvas/src/App.tsx` | 无限画布交互、节点会话、画布工具协议 | `/node-editor` 交互、节点动作、可点可回写 |

## 单轮输出格式

- 源码证据：读了哪些参考文件，提炼出哪个结构能力。
- 绘影差距：当前模块哪里没达到同等效果。
- 本轮改造：文件级 delta，最多一个主链路。
- 验证：对应 QA、接口探针、浏览器检查或真实媒体证据。
- 百分比：只有在验证通过后更新 ViMAX / Toonflow-app / ArcReel 复刻度。

## 当前基线

- ViMAX：75%。已有导演链和 story artifacts，缺生成后审片与自动修正闭环。
- Toonflow-app：65%。已有真实 taskId 画布映射，缺完整节点编辑回写。
- ArcReel：76%。已有分段队列、失败恢复、任务中心状态映射、retry/start service 化、BYOK provider 参数/submit 边界和视频主入口 BYOK-only provider 审计，缺对象存储 ready 后的真实 lastFrame -> firstFrame 连续性复测，以及更完整导出。

## 迭代记录

### 2026-06-18 ArcReel task-to-unit 状态映射

- 参考源码：
  - `references/ArcReel/frontend/src/utils/task-target.ts`
  - `references/ArcReel/frontend/src/components/task-hud/TaskHud.tsx`
  - `references/ArcReel/frontend/src/components/canvas/reference/ReferenceVideoCanvas.tsx`
  - `references/ArcReel/frontend/src/types/task.ts`
- 参考能力：ArcReel 不让画布/任务 UI 到处散乱判断任务字段，而是把任务行按 resource/unit 聚合为最新状态、失败文案、可点击目标和操作按钮。
- 绘影落点：新增 `src/lib/production-segment-ui.ts`，把 assembly segment 的 UI 状态、重试可用性、资产打开动作和错误文案从 `task-center.tsx` 中抽成纯函数。
- 验证：
  - `pnpm run qa:segment-ui`
  - `pnpm run qa:task-center-assembly`
  - `pnpm run ts-check`
  - `pnpm run qa:architecture-guard`
- 复刻度影响：ArcReel 从 70% 小幅推进到 72%，因为任务中心的 segment 可操作状态更接近 ArcReel 的 task-to-resource 模式；真实 worker 和导出链路仍未变化。

### 2026-06-19 ArcReel queue service / retry route thinning

- 参考源码：
  - `references/ArcReel/lib/generation_queue.py`
  - `references/ArcReel/server/routers/tasks.py`
- 参考能力：ArcReel 把排队、claim、失败、重试、取消和 provider job id 持久化放进 `GenerationQueue`，HTTP route 只做参数接收、调用队列服务和返回本地化状态。
- 绘影差距：`/api/production/assembly-plan/segment/retry` 之前把 segment 定位、父任务回写、子任务创建/重试和错误状态都内联在 route 中，后续继续扩展会让任务恢复逻辑变成新的大 route。
- 绘影落点：
  - 新增 `src/lib/production-segment-retry.ts`，承接片段重试的纯服务边界。
  - 缩薄 `src/app/api/production/assembly-plan/segment/retry/route.ts`，只保留 JSON 解析、service 调用和错误映射。
  - 修正 `src/lib/task-manager.ts` 读取 `HUIYING_TASKS_FILE`，让 QA 与服务共享隔离任务文件，避免测试污染真实任务中心。
  - 新增 `scripts/qa-production-segment-retry-service.ts` 和 `pnpm run qa:segment-retry-service`，直接验证 retry service 的父子任务回写。
- 验证：
  - `pnpm run qa:segment-retry-service`：通过；临时任务文件 `AppData\Local\Temp\huiying-segment-retry-service-*\tasks.json`，断言失败子任务重试为 pending、父 assembly segment 回到 queued、assemblyQueue status 同步。
  - `pnpm run qa:segment-ui`：通过；失败片段可重试、完成片段可打开视频/尾帧、排队片段保持 passive。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount=52`。
  - 严格 Ark key 形态扫描：无命中。
- 复刻度影响：ArcReel 从 72% 推进到 73%。这轮不是扩展新功能，而是把失败恢复从 route 内联逻辑迁到队列服务形态，为后续真实 worker、取消、批量恢复和导出继续对齐 ArcReel 打基础。

### 2026-06-19 ArcReel worker lifecycle / segment start route thinning

- 参考源码：
  - `references/ArcReel/lib/generation_worker.py`
  - `references/ArcReel/lib/generation_queue.py`
- 参考能力：ArcReel 的 worker 把 claim、provider 调用、provider job id 持久化、成功/失败落终态和孤儿恢复放在后台执行体中；route 不直接承载长任务业务。
- 绘影差距：`/api/production/assembly-plan/segment/start` 原先同时承担片段定位、dry-run、费用守卫、BYOK 提交、轮询、尾帧提取、父任务回写和失败脱敏。它是后续真实生成、恢复和连续性迭代的高风险屎山点。
- 绘影落点：
  - 新增 `src/lib/production-segment-start.ts`，承接片段启动、dry-run 写回、真实费用守卫、后台 BYOK 任务执行和父 assemblyPlan 写回。
  - 缩薄 `src/app/api/production/assembly-plan/segment/start/route.ts`，只保留请求解析、BYOK header 提取、service 调用和错误映射。route 行数约 56 行。
  - 新增 `scripts/qa-production-segment-start-service.ts` 和 `pnpm run qa:segment-start-service`，用隔离任务文件验证 dry-run 与费用守卫，不依赖正在运行的 HTTP 服务。
- 验证：
  - `pnpm run qa:segment-start-service`：通过；临时任务文件 `AppData\Local\Temp\huiying-segment-start-service-*\tasks.json`，断言 dry-run 更新子任务/父 segment 且不使用真实密钥、不产生费用；真实路径缺少 `allowRealCost=true` 时由 service 阻断。
  - `pnpm run qa:segment-retry-service`：通过；确认上一轮 retry service 未回归。
  - `pnpm run qa:segment-ui`：通过；确认任务中心 segment UI 状态未回归。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount=52`。
  - 严格 Ark key 形态扫描：无命中。
- 复刻度影响：ArcReel 从 73% 推进到 74%。本轮主要是把 segment start 从大 route 移向 worker/service 边界，还没有实现 ArcReel 的 provider job resume 和统一 worker lease。

### 2026-06-19 ArcReel video backend boundary / BYOK submit provider

- 参考源码：
  - `references/ArcReel/lib/video_backends/base.py`
  - `references/ArcReel/lib/generation_worker.py`
- 参考能力：ArcReel 把 provider submit/poll/download 的边界抽象为 video backend，worker 只调统一执行入口，不让 HTTP route 直接拼每个 provider 的参数和轮询细节。
- 绘影差距：`/api/video/submit` 仍是大 route，包含 BYOK、后处理、尾帧提取和任务完成逻辑；继续往里面加真实生成能力会加重屎山。
- 绘影落点：
  - 新增 `src/lib/video-submit-provider.ts`，抽出 BYOK 视频参数构建、时长 clamp、首帧/尾帧/角色参考图选择和 BYOK submit+poll。
  - `src/app/api/video/submit/route.ts` 的 BYOK 分支改为调用 `runBYOKVideoSubmit`，route 不再直接 import `submitVideoWithBYOK` / `waitForVideoWithBYOK`。
  - 新增 `scripts/qa-video-submit-provider.ts` 和 `pnpm run qa:video-submit-provider`，无真实调用验证 provider 参数规范化。
- 验证：
  - `pnpm run qa:video-submit-provider`：通过；覆盖时长 5-10s clamp、prompt trim、首帧优先级、尾帧保留、角色参考图最多 3 张、素材首帧 fallback。
  - `pnpm run qa:video-byok`：通过；HTTP 级确认私有 API Base 被拦截、Ark BYOK 任务可无真实调用创建、缺模型失败可读、探针任务无泄漏。
  - `pnpm run qa:segment-start-service`：通过；确认分段启动 service 未回归。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount=52`。
  - 严格 Ark key 形态扫描：无命中。
- 复刻度影响：ArcReel 从 74% 推进到 75%。本轮只拆 BYOK provider 边界；后续应继续按同样模式拆后处理和尾帧提取。

### 2026-06-19 ArcReel provider cleanup / BYOK-only video submit

- 参考源码：
  - `references/ArcReel/lib/video_backends/base.py`
  - `references/ArcReel/lib/generation_worker.py`
- 参考能力：ArcReel 的生成 worker 由明确 provider backend 驱动，不在同一个 route 内维护多套隐藏 fallback；失败应留在任务状态中，而不是自动切换到另一个供应商导致不可审计。
- 绘影差距：视频主入口还残留 Minimax/Coze fallback、Coze Chat 自动后期和前端设置页的 Coze/MiniMax provider 选项，导致用户和任务审计无法确定真实 provider。
- 绘影落点：
  - `src/app/api/video/submit/route.ts` 改为 Ark BYOK-only：缺 BYOK 直接 400，不创建伪任务，不再 fallback Minimax/Coze。
  - 自动后期从 Coze Chat 改为本地确定性字幕/BGM 规则，避免隐藏模型调用。
  - 设置页和 `/api/provider/test` 的 provider 选项收窄为 OpenAI 兼容与火山 Ark。
  - 新增 `scripts/qa-video-submit-byok-only.mjs` 和 `pnpm run qa:video-submit-byok-only`，静态防止 Minimax/Coze fallback 回流。
- 验证：
  - `pnpm run qa:video-submit-byok-only`：断言 submit route 无 Minimax env/client、Coze generation endpoint、Coze Chat、Coze SDK direct import、硬编码 Coze 视频模型、mutable fallback provider state。
- 复刻度影响：ArcReel 从 75% 推进到 76%。本轮把视频主入口 provider 状态变成可审计 BYOK-only，但旧 `generate-segmented-video.ts`、`model-router.ts` 和若干图片/TTS/测试 route 仍有 Minimax/Coze 遗留，下一轮应按能力域逐个替换或归档。

### 2026-06-19 ArcReel provider router decoupling / quantitative cleanup

- 参考源码：
  - `references/ArcReel/lib/video_backends/base.py`
- 参考能力：ArcReel 的 provider backend 边界由 worker/调用方显式选择和持久化 provider job，不把具体供应商降级链硬编码在全局 router 中。
- 绘影差距：`src/lib/model-router.ts` 仍写死旧 provider 降级链，虽然视频主入口已 BYOK-only，但健康路由中心仍在传播历史供应商概念。
- 绘影落点：
  - `src/lib/model-router.ts` 移除内置旧 provider fallbackChain，`routeWithFallback` 改为按调用方传入的 executor 顺序执行。
  - `getCurrentRoute` 在无健康状态时返回 `unconfigured`，避免默认暗示某个旧 provider 是主路径。
  - 新增 `scripts/qa-model-router.ts` 和 `pnpm run qa:model-router`，验证空路由、首个 executor、fallback executor 和空 executor fail-fast。
- 验证：
  - `pnpm run qa:model-router`：通过。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount=51`。
  - `pnpm run qa:iteration-scorecard`：通过；本轮首次改后量化为 `debtScore 439 -> 438`、`legacyProviderReferenceCount 547 -> 538`、`videoSubmitForbiddenCount=0`。
  - 严格 Ark/sk key 形态扫描：无命中。
- 复刻度影响：ArcReel 仍为 76%。本轮是工程债务清理和 provider 边界收敛，不提高复刻百分比，但产生了定量屎山下降；下一轮应继续处理 `ai-service-adapter.ts` 或 `generate-segmented-video.ts`，让 legacy provider 引用继续下降。

### 2026-06-19 ViMAX readiness scorecard / story-continuity-clickable metrics

- 参考源码：
  - `references/ViMAX/prompts/workflow.md`
  - `references/ViMAX/agent_runtime/vimax_adapters.py`
- 参考能力：ViMAX 在 render 之前要求 story、characters、script、storyboard、shot_decomposition、camera_tree 等结构化文本 artifact 已存在；adapter 会先生成/复用 artifact checklist，再判断是否 ready for render。
- 绘影差距：上一版自动化只记录三大项目复刻百分比和工程债务，缺少用户真正关心的“故事是否看得懂、段落是否衔接、产品节点是否能点”的量化门禁，导致每轮容易凭感觉推进。
- 绘影落点：
  - `scripts/qa-iteration-scorecard.mjs` 新增 `readiness` 分组，输出 `overallReadiness`、`storyReadabilityScore`、`segmentContinuityScore`、`realGenerationStabilityScore`、`clickableProductScore`、`engineeringHygieneScore`、`deliveryReadinessScore`。
  - `overallReadiness` 按 20/20/15/15/10/10/10 权重聚合：demo parity、故事可读性、分段连续性、真实生成稳定性、资产工作台可用性、工程防屎山、上线交付。
  - 为避免“结构存在就自评满分”，scorecard 加入 cap：当文档仍记录故事动作/桥接优化缺口时，`storyReadabilityScore` 最高 85；当对象存储/真实 handoff 阻塞仍存在时，`segmentContinuityScore` 最高 70、`realGenerationStabilityScore` 最高 80。
- 验证：
  - `pnpm run qa:iteration-scorecard`：通过；新增 `overallReadiness=76.6`，输入分为 `demoParity=72`、`storyReadability=85`、`segmentContinuity=70`、`realGenerationStability=80`、`clickableProduct=100`、`engineeringHygiene=27`、`deliveryReadiness=100`。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount=51`。
  - `pnpm run ts-check`：通过。
- 复刻度影响：ViMAX/Toonflow-app/ArcReel 百分比本轮不提高，仍为 75% / 65% / 76%。本轮价值是把后续增长从口头判断变成可重复分数；下一轮应优先降低最低项 `engineeringHygiene=27`，或在对象存储 ready 后复测真实 handoff 解除 continuity cap。

### 2026-06-19 ArcReel adapter video fail-closed / legacy provider cleanup

- 参考源码：
  - `references/ArcReel/lib/video_backends/base.py`
  - `references/ArcReel/lib/generation_worker.py`
- 参考能力：ArcReel 的视频生成由显式 `VideoBackend` 协议和 worker 驱动，provider job id 在 submit 后立即持久化，恢复路径不会通过一个通用 adapter 隐式切换旧供应商。
- 绘影差距：`src/lib/ai-service-adapter.ts` 仍保留 `generateVideo` 旧视频 fallback，实现上会绕过 BYOK video submit 和 production assembly segment service，且无法保证 provider job 持久化/恢复。
- 绘影落点：
  - `src/lib/ai-service-adapter.ts` 移除 `generateMiniMaxVideo` import，并将 `aiService.generateVideo` 改为 fail-closed，明确要求使用 `/api/video/submit` BYOK 或 production assembly segment start。
  - 新增 `scripts/qa-ai-service-video-disabled.mjs` 和 `pnpm run qa:ai-service-video-disabled`，防止旧视频 provider 调用回流到通用 adapter。
- 验证：
  - `pnpm run qa:ai-service-video-disabled`：通过；确认 `generateVideo` fail-closed，且不再调用旧视频 provider。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount=51`。
  - `pnpm run qa:iteration-scorecard`：通过；`debtScore 438 -> 436`，`legacyProviderReferenceCount 538 -> 524`，`videoSubmitForbiddenCount=0`。
- 复刻度影响：ArcReel 仍为 76%。本轮是工程防屎山与旧视频主链路隔离，不提高 demo 复刻百分比；下一轮应处理调用方的 storyboard 旧视频入口提示/重定向，避免用户点击后遇到不可读失败。

### 2026-06-19 ArcReel storyboard video path guidance / caller cleanup

- 参考源码：
  - `references/ArcReel/lib/video_backends/base.py`
  - `references/ArcReel/lib/generation_worker.py`
- 参考能力：ArcReel 的 submit / resume / unsupported 分流由 worker 和 backend 协议显式承担；不可安全恢复或不可继续的路径要快速终态失败，避免隐式重新提交和重复计费。
- 绘影差距：上一轮已让 `aiService.generateVideo` fail-closed，但 `storyboard/submit` 与 `storyboard/regenerate-shot` 仍保留旧视频调用语义，用户点击后会进入不可读的旧失败路径。
- 绘影落点：
  - 新增 `src/lib/video-generation-path-guidance.ts`，集中生成旧 storyboard 视频入口的用户可读指引，明确转向 BYOK 视频提交或 production assembly segment start。
  - `src/app/api/storyboard/submit/route.ts` 去掉旧视频 adapter 调用、旧视频模型字段和旧 provider 轮询，失败时给出明确主链路提示。
  - `src/app/api/storyboard/regenerate-shot/route.ts` 去掉旧视频 adapter 调用，保留九宫格图片再生成，但视频阶段 fail-closed 到可恢复主链路。
  - 新增 `scripts/qa-storyboard-video-path-disabled.mjs` 和 `pnpm run qa:storyboard-video-path-disabled`，防止 storyboard 视频调用方回流到旧 adapter。
- 验证：
  - `pnpm run qa:storyboard-video-path-disabled`：通过；确认两个 storyboard 视频调用方 fail-closed 并指向 BYOK/assembly。
  - `pnpm run qa:ai-service-video-disabled`：通过。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount=51`。
  - `pnpm run qa:iteration-scorecard`：通过；`legacyProviderReferenceCount 524 -> 516`，`debtScore=436`，`videoSubmitForbiddenCount=0`，`overallReadiness=76.6`。
  - 严格 Ark/sk key 形态扫描：无命中。
- 复刻度影响：ViMAX/Toonflow-app/ArcReel 仍为 75% / 65% / 76%。本轮没有提高 demo 百分比，但把旧 storyboard 视频入口从隐式旧供应商调用收敛为可审计、可门禁的主链路指引；下一轮建议处理图片/TTS 相关历史 provider 注释与直连 SDK，或拆出 `storyboard/submit` 的视频/音频服务以降低 large route 警告。

### 2026-06-19 ArcReel resume executor boundary / storyboard provider SDK extraction

- 参考源码：
  - `references/ArcReel/server/services/resume_executor.py`
- 参考能力：ArcReel 的 route/worker 入口不直接持有 provider SDK 客户端，而是通过 `server.services.*` service 层完成 resume 与 finalize；入口只负责把 task、job_id、payload 交给服务执行。
- 绘影差距：`src/app/api/storyboard/submit/route.ts` 仍直接 import 视频编辑、语音合成和对象存储 SDK，architecture guard 将其标记为 `route-direct-provider-sdk`。
- 绘影落点：
  - 新增 `src/lib/storyboard-media-clients.ts`，集中初始化 storyboard 后处理所需的视频编辑、语音合成和对象存储客户端。
  - `src/app/api/storyboard/submit/route.ts` 改为从该 helper 取得 `storyboardVideoEditor`、`storyboardSpeechSynthesizer` 与 `getStoryboardStorageClient`，route 不再直接 import provider SDK。
  - 新增 `scripts/qa-storyboard-route-provider-boundary.mjs` 和 `pnpm run qa:storyboard-route-provider-boundary`，防止 storyboard route 回退到直接 SDK import。
- 验证：
  - `pnpm run qa:storyboard-route-provider-boundary`：通过；确认 storyboard submit route 不再包含 provider SDK 直连关键词。
  - `pnpm run qa:storyboard-video-path-disabled`：通过。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount 51 -> 50`。
  - `pnpm run qa:iteration-scorecard`：通过；`debtScore 436 -> 428`，`directProviderSdkRouteCount 35 -> 34`，`overallReadiness 76.6 -> 76.8`，`videoSubmitForbiddenCount=0`。
  - 严格 Ark/sk key 形态扫描：无命中。
- 复刻度影响：ViMAX/Toonflow-app/ArcReel 仍为 75% / 65% / 76%。本轮属于 ArcReel 式 service 边界与工程防屎山，不提高 demo 百分比；下一轮应继续拆 `storyboard/submit` 的音频/字幕后处理 service，或转向 `prompt/auto-complete`、`video/generate` 等仍被 route-direct-provider-sdk 点名的 route。

### 2026-06-19 ArcReel generation service boundary / prompt auto-complete provider extraction

- 参考源码：
  - `references/ArcReel/server/services/generation_tasks.py`
- 参考能力：ArcReel 的任务执行入口把 provider/backend 创建、缓存、配置解析都压在 `server.services.generation_tasks`，调用入口不直接 import 具体 provider SDK。
- 绘影差距：`src/app/api/prompt/auto-complete/route.ts` 仍在 route 内动态 import LLM provider SDK，architecture guard 将其标记为 `route-direct-provider-sdk`。
- 绘影落点：
  - 新增 `src/lib/prompt-auto-complete-client.ts`，集中负责 prompt auto-complete 的 provider SDK 动态导入、header 转发、LLM 调用和 provider 错误包装。
  - `src/app/api/prompt/auto-complete/route.ts` 改为只做参数校验、场景 prompt 选择、JSON 解析和响应，provider 调用委托 `invokePromptAutoComplete`。
  - 新增 `scripts/qa-prompt-auto-complete-provider-boundary.mjs` 和 `pnpm run qa:prompt-auto-complete-provider-boundary`，防止该 route 再次直接 import / dynamic import provider SDK。
- 验证：
  - `pnpm run qa:prompt-auto-complete-provider-boundary`：通过。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount 50 -> 49`。
  - `pnpm run qa:iteration-scorecard`：通过；`debtScore 428 -> 420`，`directProviderSdkRouteCount 34 -> 33`，`engineeringHygieneScore 29 -> 30`，`overallReadiness 76.8 -> 76.9`。
  - 严格 Ark/sk key 形态扫描：无命中。
- 复刻度影响：ViMAX/Toonflow-app/ArcReel 仍为 75% / 65% / 76%。本轮属于工程边界治理，不提高 demo 百分比；下一轮建议继续处理 `video/generate` 或 `script/jimeng-convert` 的 route-direct-provider-sdk，或回到故事可读性 cap 做 ViMAX 式叙事质量提升。

### 2026-06-19 ArcReel generation service boundary / video generate provider extraction

- 参考源码：
  - `references/ArcReel/server/services/generation_tasks.py`
- 参考能力：ArcReel 的视频任务入口通过 service 层创建和缓存 backend，入口逻辑专注于任务状态、payload 和 finalize，不直接散落具体 provider SDK 客户端。
- 绘影差距：`src/app/api/video/generate/route.ts` 同时承担 SSE、字幕本地处理、视频生成、TTS、音视频合成和 provider SDK 初始化，architecture guard 将其标记为 `route-direct-provider-sdk`。
- 绘影落点：
  - 新增 `src/lib/video-generate-provider-clients.ts`，集中负责视频生成、语音合成、音视频合成三类 provider 调用，并包装 provider API 错误。
  - `src/app/api/video/generate/route.ts` 保留 SSE、参数校验、字幕本地处理和响应组装，provider SDK 调用委托 `generateVideoWithProvider`、`synthesizeVideoGenerateSpeech`、`compileVideoGenerateAudio`。
  - 新增 `scripts/qa-video-generate-provider-boundary.mjs` 和 `pnpm run qa:video-generate-provider-boundary`，防止该 route 再次直接 import provider SDK。
- 验证：
  - `pnpm run qa:video-generate-provider-boundary`：通过。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount 49 -> 48`。
  - `pnpm run qa:iteration-scorecard`：通过；`debtScore 420 -> 412`，`directProviderSdkRouteCount 33 -> 32`，`engineeringHygieneScore 30 -> 31`，`overallReadiness 76.9 -> 77.0`。
  - 严格 Ark/sk key 形态扫描：无命中。
- 复刻度影响：ViMAX/Toonflow-app/ArcReel 仍为 75% / 65% / 76%。本轮继续做 ArcReel 式 service 边界与工程防屎山；下一轮建议处理 `script/jimeng-convert` 或 `video/nine-grid` 的 route-direct-provider-sdk，或转向 ViMAX 式故事可读性 cap。

### 2026-06-19 ArcReel generation service boundary / jimeng convert provider extraction

- 参考源码：
  - `references/ArcReel/server/services/generation_tasks.py`
- 参考能力：ArcReel 把 provider/backend 创建、header/config 解析和 backend 缓存集中在 service 层，入口只把 project/payload 交给执行服务，避免 route 直接依赖具体 SDK。
- 绘影差距：`src/app/api/script/jimeng-convert/route.ts` 仍直接 import `coze-coding-dev-sdk` 并在 route 内创建 `LLMClient`，architecture guard 将其标记为 `route-direct-provider-sdk`。
- 绘影落点：
  - 新增 `src/lib/jimeng-convert-llm-client.ts`，集中负责即梦转换链路的 provider SDK 动态导入、header 转发、LLM 调用和 provider 错误包装。
  - `src/app/api/script/jimeng-convert/route.ts` 改为只做请求校验、剧本拆分流程编排、fallback 结构和响应，LLM 调用委托 `createJimengConvertLLM`。
  - 新增 `scripts/qa-jimeng-convert-provider-boundary.mjs` 和 `pnpm run qa:jimeng-convert-provider-boundary`，防止该 route 再次直接 import 或构造 provider SDK client。
- 验证：
  - `pnpm run qa:jimeng-convert-provider-boundary`：通过。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount 48 -> 47`。
  - `pnpm run qa:iteration-scorecard`：通过；`debtScore 412 -> 404`，`directProviderSdkRouteCount 32 -> 31`，`engineeringHygieneScore 31 -> 33`，`overallReadiness 77.0 -> 77.2`。
  - 严格 Ark/sk key 形态扫描：无命中。
- 复刻度影响：ViMAX/Toonflow-app/ArcReel 仍为 75% / 65% / 76%。本轮属于 ArcReel 式 service 边界与工程防屎山，不提高 demo 百分比；下一轮建议处理 `video/nine-grid` 或 `film/compose` 的 route-direct-provider-sdk，或切回 ViMAX 式故事可读性 cap。

### 2026-06-19 ArcReel generation service boundary / video nine-grid provider header extraction

- 参考源码：
  - `references/ArcReel/server/services/generation_tasks.py`
- 参考能力：ArcReel 的入口把 provider/backend 解析、配置和执行委托到 service 层，调用入口只保留任务创建、状态推进和业务编排，不直接持有 SDK header/config 细节。
- 绘影差距：`src/app/api/video/nine-grid/route.ts` 虽然已把图片生成放在 `generateNineGridImages` helper，但 route 仍直接 import `HeaderUtils`，architecture guard 将其标记为 `route-direct-provider-sdk`。
- 绘影落点：
  - 新增 `src/lib/nine-grid-provider-headers.ts`，集中负责九宫格链路的 provider header 转发边界。
  - `src/app/api/video/nine-grid/route.ts` 改为调用 `extractNineGridForwardHeaders(request.headers)`，route 不再直接 import provider SDK。
  - 新增 `scripts/qa-video-nine-grid-provider-boundary.mjs` 和 `pnpm run qa:video-nine-grid-provider-boundary`，防止该 route 再次直接使用 `coze-coding-dev-sdk` 或 `HeaderUtils`。
- 验证：
  - `pnpm run qa:video-nine-grid-provider-boundary`：通过。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount 47 -> 46`。
  - `pnpm run qa:iteration-scorecard`：通过；`debtScore 404 -> 396`，`directProviderSdkRouteCount 31 -> 30`，`engineeringHygieneScore 33 -> 34`，`overallReadiness 77.2 -> 77.3`。
  - 严格 Ark/sk key 形态扫描：无命中。
- 复刻度影响：ViMAX/Toonflow-app/ArcReel 仍为 75% / 65% / 76%。本轮是 ArcReel 式 service 边界治理，不提高 demo 百分比；下一轮建议处理 `film/compose` 的 route-direct-provider-sdk，或拆 `video/nine-grid` 的后处理编排以降低 large route warning。

### 2026-06-19 ArcReel generation service boundary / film compose provider extraction

- 参考源码：
  - `references/ArcReel/server/services/generation_tasks.py`
- 参考能力：ArcReel 将 provider/backend 创建、对象存储、执行调用和配置读取放到 service 层，入口保留任务编排、状态推进和最终响应。
- 绘影差距：`src/app/api/film/compose/route.ts` 直接 import 并初始化 `VideoEditClient`、`TTSClient`、`S3Storage` 和 `Config`，同时在 route 内执行视频拼接、音频合成、TTS 与对象存储转存。
- 绘影落点：
  - 新增 `src/lib/film-compose-provider-clients.ts`，集中负责 film compose 的对象存储转存、视频拼接、TTS 和音视频合成 provider 调用。
  - `src/app/api/film/compose/route.ts` 改为调用 `storeFilmComposeUrl`、`concatFilmComposeVideos`、`synthesizeFilmComposeVoice`、`compileFilmComposeAudio`，route 不再直接 import 或构造 provider SDK client。
  - 新增 `scripts/qa-film-compose-provider-boundary.mjs` 和 `pnpm run qa:film-compose-provider-boundary`，防止该 route 回退到直接 SDK import / client 构造 / 存储 SDK 调用。
- 验证：
  - `pnpm run qa:film-compose-provider-boundary`：通过。
  - `pnpm run ts-check`：通过。
  - `pnpm run qa:architecture-guard`：通过；`hardViolationCount=0`，`warningCount 46 -> 45`。
  - `pnpm run qa:iteration-scorecard`：通过；`debtScore 396 -> 388`，`directProviderSdkRouteCount 30 -> 29`，`engineeringHygieneScore 34 -> 35`，`overallReadiness 77.3 -> 77.4`。
  - 严格 Ark/sk key 形态扫描：无命中。
- 复刻度影响：ViMAX/Toonflow-app/ArcReel 仍为 75% / 65% / 76%。本轮不提高 demo 复刻百分比；它继续补 ArcReel 式 service 边界和工程防屎山。下一轮建议处理 `image/annotate` 或 `subtitle/chat` 的 route-direct-provider-sdk，或开始拆 `film/compose` 仍剩的 large route warning。

### 2026-06-19 60s effect gate / ViMAX shot continuity reference

- 参考源码：
  - `references/ViMax/interfaces/shot_description.py`
- 参考能力：ViMAX 的镜头描述不是只给总 prompt，而是显式要求 `ff_desc`、`lf_desc`、`variation_reason`、`motion_desc` 和音频描述，用首帧、尾帧、运动变化来约束镜头是否可读。
- 绘影差距：此前自动化会记录 60s 文件和首页案例，但没有一个固定 QA 把“60s 时长、首页沉淀、60s 节拍密度、跨段桥接结构”合成可复核门禁，容易又退回到只拆 provider 或只看口头效果。
- 绘影落点：
  - 新增 `scripts/qa-60s-effect.mjs` 和 `pnpm run qa:60s-effect`，检查本地真实 60s 案例 `huiying-case-videotape-60s.mp4` 的媒体时长、首页卡片、ViMAX 首尾帧参考能力、绘影 60s trailer beat、segment bridge memory 和真实 60s gate 可触发性。
  - `scripts/qa-iteration-scorecard.mjs` 接入 `sixtySecondEffectScore`，后续自动化每轮能报告当前 60s 效果门禁分，不再只用泛泛描述。
- 验证：
  - `node scripts/check-video-duration.mjs public/generated/videos/huiying-case-videotape-60s.mp4` 通过：`durationSeconds=60.324`。
  - `pnpm run qa:60s-effect`：通过，`score=100`，未使用真实 key、未产生费用。
- 复刻度影响：ViMAX 仍为 75%，Toonflow-app 仍为 65%，ArcReel 仍为 76%。本轮不直接提高 demo 百分比；它把 60s 效果评估纳入自动化定量输入，下一轮若跑真实 60s 或补 60s 画面语义审查，才可提高故事可读性/真实稳定性分。

### 2026-06-19 60s semantic review packet / ArcReel storyboard dependency reference

- 参考源码：
  - `references/_git-clones/ArcReel/lib/storyboard_sequence.py`
- 参考能力：ArcReel 的 storyboard sequence 会保存上一分镜参考、分组断点和 dependency resource，避免相邻镜头只靠总 prompt 自由漂移。
- 绘影差距：上一轮 `qa:60s-effect` 能证明 60s 视频文件、首页卡片和结构门禁存在，但还不能回答“画面本身是否看得懂”。如果自动化只报告 60s 时长达标，仍可能掩盖人物目标/冲突/转折/结尾不可读的问题。
- 绘影落点：
  - 新增 `scripts/qa-60s-semantic-review.mjs` 和 `pnpm run qa:60s-semantic-review`，对 `huiying-case-videotape-60s.mp4` 抽取 7 个时间点 contact sheet，计算采样帧变化度，并检查首页故事锚点、story-aware prompt 的可见因果要求和 ArcReel 式上一分镜依赖参考能力。
  - `scripts/qa-iteration-scorecard.mjs` 新增 `sixtySecondSemanticReviewScore`，让 60s 语义审查包成为自动化固定输入。
  - 输出 artifact：`artifacts/60s-semantic-review/current.json` 和 `artifacts/60s-semantic-review/huiying-case-videotape-60s-contact.jpg`。
- 验证：
  - `pnpm run qa:60s-semantic-review`：通过，低成本审查 `score=85`，生成 contact sheet；未使用真实 key、未产生费用。
- 结论：当前 60s 可确认“时长达标、关键帧可抽取、画面有变化、产品锚点和结构约束存在”，但仍不能自动证明观众能看懂完整人物目标、冲突、转折和结尾。下一轮若要提高故事可读性分，需要接入人工/视觉模型逐帧语义标注，或跑新的 60s 真实生成并做同样审查。

### 2026-06-19 60s semantic labels / contact sheet story audit

- 参考源码：
  - `references/ViMax/interfaces/shot_description.py`
- 参考能力：ViMAX 的 shot artifact 要求镜头内可见人物、首尾帧、运动变化和音画信息。绘影本轮把这个思想转为 60s contact sheet 逐帧语义标签，而不是只看视频时长。
- 绘影落点：
  - 新增 `scripts/qa-60s-semantic-labels.mjs` 和 `pnpm run qa:60s-semantic-labels`，可在没有标签时生成模板，有标签时按人物、动作、连续性、目标、冲突、转折、结尾可读性评分。
  - 新增 `artifacts/60s-semantic-review/huiying-case-videotape-60s-labels.json`，对当前 60s contact sheet 做一次人工视觉标签审查。
  - `scripts/qa-60s-semantic-review.mjs` 接入 labels review，`scripts/qa-iteration-scorecard.mjs` 输出 `sixtySecondSemanticLabelScore`。
- 验证结论：当前 60s contact sheet 中“同一男性主角 + 便利店 + 屏幕/设备线索”连续性成立，但冲突赌注和结尾钩子仍不够直观；下一次 60s 生成应让倒计时、被威胁对象、主角操作结果明确入画。

### 2026-06-19 60s story-readable prompt hardening / visible threat-result-hook

- 参考源码：
  - `references/ViMax/interfaces/shot_description.py`
  - `references/_git-clones/ArcReel/lib/storyboard_sequence.py`
- 参考能力：
  - ViMAX 的 shot artifact 要把镜头首帧、尾帧、运动变化和可见事件写清，不能只给氛围词。
  - ArcReel 的 `StoryboardTaskPlan` 会显式保存上一分镜依赖和 group/index，避免相邻镜头只靠总 prompt 自由漂移。
- 绘影差距：上一轮人工标签已经证明旧 60s 成片里“主角/便利店/屏幕线索”成立，但 `conflict-readable-without-text=false`、`ending-hook-readable-without-text=false`。问题不是时长，而是威胁对象、危险源、操作结果、结尾新问题没有被强制入画。
- 绘影落点：
  - `src/lib/production-assembly-plan.ts` 的 segment prompt 新增 `【威胁对象】`、`【危险源】`、`【操作结果】`、`【结尾新问题】`，并把开场/冲突/高潮/结尾的可见 beat 从抽象情绪改成具体风险、操作和后果。
  - `src/lib/trailer-beat-sheet.ts` 的 30/60/90s beat sheet 强化“谁会受损、危险源是什么、主角操作后发生什么、结尾留下什么新问题”的观众检查点。
  - `scripts/qa-story-aware-video-gate.mjs`、`scripts/qa-short-drama-quality.mjs`、`scripts/qa-60s-semantic-review.mjs` 同步把这些字段纳入门禁，防止后续 prompt 回退成泛泛氛围。
- 验证：
  - `pnpm run qa:60s-semantic-review`：通过，`score=70`，确认 story-aware 60s prompt 已包含新的可见因果硬要求；旧视频仍报告 `qualityGaps=["semantic-label-story-readability"]`。
  - `pnpm run qa:60s-semantic-labels`：通过，`score=85`；旧标签仍显示 `storyReadableWithoutText=false`，失败项为 `conflict-readable-without-text`、`ending-hook-readable-without-text`。
  - `pnpm run qa:trailer-presets`：通过，30/60/90s 预告片 preset 的 beat 与 visual anchor 保持可解析。
  - `pnpm run qa:short-drama`：本轮因本地 `http://localhost:5000/api/health` 60 秒无响应未完成；记录为运行环境阻塞，不计作产品通过。
- 结论：本轮没有声称旧 60s 成片质量改善；它把已定位的故事可读性缺口转成下一次生成必须满足的结构化 prompt 和 QA 门禁。下一轮应在服务恢复后重跑 `qa:short-drama`，再授权一次低成本 10/30s 或 60s 真实生成，用同一套 labels 复评冲突和结尾钩子是否入画。

### 2026-06-19 60s golden case / product-visible trailer structure gate

- 参考源码：
  - `references/ViMax/agents/storyboard_artist.py`
  - `references/ViMax/agents/script_planner.py`
  - `references/_git-clones/ArcReel/lib/storyboard_sequence.py`
- 参考 demo 行为：
  - ViMAX 的 storyboard demo 要求每个 shot 有明确叙事目的、画面位置、镜头语言和叙事连续性；script planner 要求情绪变化由可见动作和节奏承载，而不是抽象文案。
  - ArcReel 的 storyboard sequence 显式保存上一分镜依赖和 dependency index，避免相邻镜头断裂。
- 绘影当前失败点：上一轮已经把“威胁对象/危险源/操作结果/结尾新问题”写进通用 prompt，但固定 60s golden case 还没有独立回归门禁；`最后一班列车` 60s preset 的危险源覆盖也不足，容易再次生成连续但看不懂危险赌注的片子。
- 绘影落点：
  - `scripts/trailer-script-presets.mjs` 的 60s `最后一班列车` beat 增强旧桥警报、危险区广播、倒计时牌和警报屏熄灭，让危险源在 5 个 beat 中可见，威胁对象在 6 个 beat 中可见。
  - 新增 `scripts/qa-60s-golden-case.mjs` 和 `pnpm run qa:60s-golden-case`，固定检查 60s golden case 是否覆盖：主角/目标、威胁对象、危险源、操作结果、结尾钩子、ViMAX 可读分镜行为、ArcReel 上一分镜依赖、绘影 segment bridge 和当前 60s 质量缺口。
  - `scripts/qa-iteration-scorecard.mjs` 新增 `sixtySecondGoldenCaseScore`，并把 `60s-effect-golden-case-gate` 改为同时要求 60s 媒体证据和 60s golden case 结构门禁。
  - 输出 artifact：`artifacts/60s-golden-case/current.json`。
- 验证：
  - `pnpm run qa:60s-golden-case`：通过，`score=100`，`threatTargetBeatCount=6`、`dangerBeatCount=5`、`operationBeatCount=4`，未使用真实 key、未产生费用。
  - `pnpm run qa:trailer-presets`：通过，确认 30/60/90s preset 结构仍可解析。
  - `pnpm run qa:60s-semantic-labels`：通过，旧视频仍保留 `storyReadableWithoutText=false`，失败项仍为 `conflict-readable-without-text`、`ending-hook-readable-without-text`。
- 结论：本轮产生用户可感知产品增量：下一次 60s 生成有固定 golden case 和结构门禁，不再只靠临时 prompt。旧 60s 成片本身仍没有被重新生成，故事可读性 cap 仍有效；下一步应在服务健康恢复后，用这个 golden case 跑 10/30s 或授权 60s 真生成复评。

### 2026-06-19 60s real deep review / 12-frame visual postmortem

- 复盘对象：
  - `public/generated/videos/huiying-case-videotape-60s.mp4`，实际时长 `60.324s`。
  - 新增 12 帧 contact sheet：`artifacts/60s-semantic-review/deep-12f/contact.jpg`。
  - 新增复盘 artifact：`artifacts/60s-semantic-review/deep-review.json`。
- 真实视觉结论：
  - 优点：同一男性主角、便利店场景、录像带/电视设备三条视觉锚点稳定；中后段有真实操作动作，不是纯空镜。
  - 主要缺口：被威胁对象不可见、危险源不可见、操作结果不可见、结尾新问题不可读。
  - 复盘分：主角一致性 `86`，场景连续性 `92`，道具连续性 `90`，危险源可读性 `25`，操作结果可读性 `35`，结尾钩子可读性 `45`，无字幕故事可读性 `52`。
- 下一次生成处方：
  - `0-8s` 把红色数字拍成明确倒计时，同时出现面试门口或关闭办公室门。
  - `8-18s` 电视必须显示未来失败画面，如失败走出面试室或简历被丢弃。
  - `18-32s` 加入店员关灯、卷帘门下降或便利店时钟逼近关门时间。
  - `32-45s` 主角操作录像机后，屏幕内容必须发生可见变化。
  - `45-60s` 结尾出现另一个版本的主角、倒计时重置或录像带标签变新日期。
- 验证：
  - `pnpm run qa:60s-deep-review`：通过，`score=100`，确认复盘基于 12 帧 contact sheet 且包含可执行下一次生成处方。
- 结论：当前 60s 成片可作为连续性和氛围样例，但不能作为优秀短剧预告片样例。下一轮真实生成不应继续原 prompt，应按复盘处方先修 10/30s，再决定是否烧 60s。

## 反屎山守卫

运行：

```bash
pnpm run qa:architecture-guard
```

当前守卫把以下问题设为 hard violation：

- `task-manager.ts` 引入 production、BYOK、供应商 SDK、route 或 UI。
- `src/components/*` 直接 import 服务端 `task-manager`。
- `src/lib/production-*` 反向 import route 或 UI。

以下问题先作为 warning 暴露，不阻塞开发，但新需求不应继续加重：

- 超过 2500 行的大组件。
- 超过 350 行的大 API route。
- API route 直接 import `coze-coding-dev-sdk`、`VideoEditClient` 或 `S3Storage`。

下一轮建议优先从 ArcReel 的任务队列/恢复源码切入，补齐“失败片段如何在 UI 中明确重试并保持成功片段可复用”；如果对象存储已配置，则先跑真实 handoff 复测。
