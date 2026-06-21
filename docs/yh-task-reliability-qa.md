# 绘影工作室任务可靠性回归

更新时间：2026-06-17 19:48（Asia/Shanghai）

## 2026-06-17 19:48 Q6 通用分段任务恢复快照

本轮审计上一阶段真实视频证据后，确认 30 秒故事短剧已完整生成，60 秒任务因 Ark 供应商限流在第 6 段失败，随后只能把前 5 段恢复合成为约 50 秒视频。问题不在“是否会分段”，而在通用 `/api/video/merge` 的部分结果只保存成功片段 URL，缺少每段 prompt、duration、ratio、model 和失败段错误，导致后续很难只补缺失片段，容易重跑全部片段浪费生成额度。

本轮参考 ArcReel 的“片段队列必须可恢复”思路，把通用分段视频任务的中间结果契约补齐：片段开始时写入 `running` 快照，成功时写入 `completed + videoUrl/lastFrameUrl`，失败时写入 `failed + error`；每条快照都保留 story-aware prompt、时长、比例和模型。这样任务中心、恢复脚本和后续真实补段 API 有足够证据定位“第几段失败、该用什么 prompt 继续生成”。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 类型契约 | `pnpm run ts-check` | 通过 | `TaskResult.segments` 与生成器快照类型一致，运行中/失败片段允许无 `videoUrl` |
| 分段失败恢复快照 | `pnpm run qa:video-recovery` | 通过 | 模拟 2 段成功 + 1 段失败，`preservedSegmentCount=3`、`successSegmentCount=2`、`failedSegments=[2]`，失败段保留 prompt/duration/model/error |
| 短剧内容链路 | `pnpm run qa:short-drama` | 通过 | `director-chain-story-bible`、`assembly-story-aware-prompts`、`probe-restore` 均通过，`promptMarkers` 包含短剧前提、角色动机、当前冲突、剧情目的、连续性规则 |
| QA 并发风险复盘 | 串行复测前检查 Node 进程和 `.qa.lock` | 已处理 | 清理了挂起的 `qa-segmented-video-recovery` 进程；后续本类 QA 必须串行执行，避免抢同一任务文件 |

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/lib/segmented-video-task-result.ts` | `SegmentSnapshot` 扩展 `status/prompt/duration/ratio/videoModel/providerTaskId/error`，`successSegmentCount` 只统计有结果片段 | 为失败补段、任务中心回看和真实长视频恢复提供结构化依据 |
| `src/lib/generate-segmented-video.ts` | 新增 `onSegmentUpdate`，在片段 running/completed/failed 三个节点写入快照 | 真实生成过程中不再等全部成功才有可审计中间状态 |
| `src/app/api/video/merge/route.ts` | `/api/video/merge` 接入 `onSegmentUpdate` 写任务结果 | 通用视频生成和 story-aware gate 都能保留恢复上下文 |
| `src/types/task.ts` / `src/lib/task-manager.ts` | 类型化 `TaskResult.segments` 新字段 | 前后端任务中心不再依赖隐式字段 |
| `scripts/qa-segmented-video-recovery.ts` | 回归脚本增加失败段 prompt/duration/model/error 断言 | 防止后续改动退回“只保存 URL、无法补段”的旧状态 |

剩余缺口：本轮没有直接重跑 60 秒真实生成，因为上一轮失败原因是供应商限流。现在已经补齐“失败段恢复所需快照”，下一步应做只补缺失片段的真实恢复 API，而不是重新生成已成功的前 5 段。

## 2026-06-17 13:10 真实视频门控回归

本轮把真实 API 测试从零散命令收敛为顺序门控，避免 `qa:video-byok`、`qa:video-recovery` 并发抢同一个任务文件锁。该门控默认不读取真实密钥、不调用供应商、不产生费用；只有私有环境变量和 `HUIYING_ALLOW_REAL_VIDEO_COST=true` 同时存在时，才会提交真实 Ark 分段视频任务。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| Ark BYOK 无费用探针 | `pnpm run qa:real-video-gate` 内部顺序执行 `node scripts/qa-video-byok.mjs` | 通过 | 内网 API Base 被 400 拦截；缺少视频模型的 Ark 任务失败可读；探针任务恢复后 `leakedProbeTasks=0` |
| 分段失败恢复探针 | 同一门控内部顺序执行 `tsx scripts/qa-segmented-video-recovery.ts` | 通过 | 模拟两段已生成但合成失败，任务为 `failed`，`preservedSegmentCount=2`，错误提示可读 |
| 历史 61 秒产物实长解析 | 同一门控内部执行 `node scripts/check-video-duration.mjs -- artifacts/huiying-ark-61s.mp4` | 通过 | 实际 `durationSeconds=6.074`，因此历史 61 秒任务不能证明 1 分钟生成能力 |
| 真实 Ark 阶梯门禁 | 同一门控检查私有环境变量和费用开关 | 阻塞但可读 | 当前运行环境缺少私有 Ark API Key 和视频模型，`usedRealKey=false`、`incurredCost=false` |
| 敏感信息扫描 | 扫描 `src`、`scripts`、`docs`、`README.md`、`.env.example`、`package.json` | 通过 | 未发现真实 Ark key、TOS 签名 URL 或真实 key 赋值 |

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `scripts/qa-real-video-gate.mjs` | 新增真实视频门控脚本，顺序执行无费用探针；有授权时提交真实 Ark 视频、轮询任务、下载 mp4 并解析实际时长 | 把“能否生成 1 分钟以上”变成可复跑、可审计的阶梯证据，而不是看 UI 成功或请求参数 |
| `package.json` | 新增 `qa:real-video-gate` | 后续自动化统一从一个入口跑真实视频门控，降低并发污染任务文件风险 |
| `.env.example` | 增加真实 Ark 门控所需变量名，默认留空且费用开关为 false | 明确操作者如何私有配置测试，不把 key 写入仓库 |
| `README.md` | 增加真实视频门控说明、费用边界和阶梯推进规则 | 发布契约与真实验证方式对齐 |

## 2026-06-17 13:30 R3/R4 片段计划到画布一致性回归

本轮继续真实闭环审计，先复查 `qa:director`：导演链任务详情、任务列表和探针恢复均通过，之前担心的“详情可读但列表查不到”未复现。随后顺序验证制作链路时发现 `qa:assembly` 失败：任务详情中已经持久化 `assemblyPlan`，但 `/api/node-editor/production-canvas` 返回的视频节点没有 `assemblyPlan`。复现结果表明，这是任务管理器短 TTL 缓存导致跨 API 串联读取到旧任务快照。

## 2026-06-17 R3 片段子任务队列门禁

本轮把 ArcReel 式“分镜片段必须进入可恢复任务队列”落到绘影自己的任务系统：新增 `/api/production/assembly-plan/queue`，把已持久化的 `assemblyPlan.segments` 转换成 `production-assembly-segment` 视频子任务。该接口默认只排队，不启动真实供应商调用，因此不会产生费用；每段会写回 `expectedOutputs.taskId`，父任务写入 `assemblyQueue`，任务中心可按 `parentTaskId` 回看后续分段执行状态。

新增 `pnpm run qa:assembly-queue` 作为无费用门禁：它会创建导演链任务、生成 60 秒 `assemblyPlan`、排队 6 个视频子任务、验证子任务在任务列表可见且保持 `pending`，并在结束后恢复任务文件，避免污染真实测试基线。

## 2026-06-17 R3 单片段启动与失败写回门禁

本轮继续把 `assemblyQueue` 从“可追踪子任务”推进到“可控启动入口”：新增 `/api/production/assembly-plan/segment/start`。默认 dry-run 只做启动前检查，不调用供应商；真实启动必须带 BYOK headers 且显式 `allowRealCost=true`，否则拒绝。该接口会同步更新子任务状态和父级 `assemblyPlan.segments[index]`，因此单片段失败能在父任务、任务中心和后续画布恢复链路中被定位。

新增 `pnpm run qa:segment-start`：先验证 dry-run 不产生费用且子任务保持 `pending`，再用 dummy Ark 配置但缺少视频模型触发失败路径，确认错误同时写回子任务和父级 segment，并且不会回退到 Minimax 或伪成功。

## 2026-06-17 R6 任务中心分段队列可见性

本轮把 R3 的父子任务结构暴露到用户可见的任务中心：任务结果弹窗新增“分段生成队列”面板，展示总时长、子任务数量、每段状态、片段 prompt、子任务 ID、供应商任务 ID、失败原因、视频 URL 和尾帧 URL。这样长视频失败时，用户能看到具体失败片段，而不是只看到一个不可解释的失败任务。

新增 `pnpm run qa:task-center-assembly`：通过真实本地 API 创建导演链、assemblyPlan、assemblyQueue，并用 dummy Ark 缺视频模型制造一个失败片段，验证 `/api/tasks/{parentTaskId}` 返回的 `assemblyQueue`、6 个 `assemblyPlan.segments`、失败原因和子任务 ID 足够任务中心渲染，最后恢复任务文件。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 绘影精灵导演链任务一致性 | `pnpm run qa:director` | 通过 | `task-detail`、`task-list`、`probe-restore` 均 `ok=true`，`listed=true` |
| 片段计划持久化 | `pnpm run qa:assembly` | 通过 | `segmentCount=6`、`totalDuration=60`、`persistedSegmentCount=6` |
| 片段计划导入画布 | `pnpm run qa:assembly` | 通过 | `assembly-plan-visible-in-canvas` 通过，`videoNodeHasAssemblyPlan=true`、`canvasNodeCount=10` |
| 制作 dry-run 列表一致性 | `pnpm run qa:flow` 顺序执行 | 通过 | `shotCount=6`、`totalDuration=60`、`task-list listed=true`、`leakedProbeTasks=0` |
| 画布资产工作台 | `pnpm run qa:canvas` 顺序执行 | 通过 | 节点类型包含 `agent/character/scene/script/storyboard/video`，`storyboardShotCount=6` |
| 真实视频门控抗并发 | `pnpm run qa:real-video-gate` | 通过 | 门控会等待共享 `.qa.lock` 释放后再顺序执行子探针，避免并发 QA 污染任务文件 |

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/lib/task-manager.ts` | 新增 `getTaskFresh()` 和 `getAllTasksFresh()`，强制从任务文件读取并刷新缓存 | 解决“刚写入后另一个 API 立即读取旧快照”的制作链路断点 |
| `src/app/api/production/assembly-plan/route.ts` | 使用 fresh task 读取生成片段计划 | ArcReel 式剧本到片段计划链路不再依赖过期缓存 |
| `src/app/api/node-editor/production-canvas/route.ts` | 使用 fresh task 读取 productionProject 和 assemblyPlan | Toonflow 式画布资产节点能稳定显示片段任务计划 |
| `scripts/qa-real-video-gate.mjs` | 子探针执行前等待共享 `.qa.lock` 释放 | 半小时自动化和人工 QA 同时触发时不再直接失败 |

## 本轮范围

本轮按自动化 M3 推进任务可靠性闭环，并顺带覆盖 M1 BYOK 错误探针。目标是让用户在公网使用时不会看到不可理解的“永远运行中”任务，也不会因为 API Base/API Key 配置错误得到模糊错误。

## 代码改动

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/lib/task-manager.ts` | 服务端启动时立即执行一次 `cleanupExpiredTasks()` | 避免历史僵尸任务在服务重启后继续显示为运行中 |
| `src/lib/task-manager.ts` | 明确 `TaskConfig.retryCount/originalTaskId` 和 `TaskResult.shots` 类型 | 任务重试与分镜结果复用不再依赖隐式 `any` |
| `src/app/api/tasks/route.ts` | `GET /api/tasks` 前执行 `cleanupExpiredTasks()`，并返回 `cleanupCount` | 用户打开任务中心或前端轮询时能触发轻量清理，接口证据可审计 |

## 接口探针

| 探针 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 旧 running 任务恢复 | 注入一个 `lastUpdatedAt` 超过 31 分钟的本地 running 任务后请求 `GET /api/tasks?limit=10` | 通过 | `cleanupCount=1`，任务被标记为 `failed`，`stage=任务超时`，`error=任务运行超过30分钟无响应，可能已中断` |
| 探针污染恢复 | 恢复 `/tmp/dreambox-tasks/tasks.json` 备份后再次请求 `GET /api/tasks?limit=10` | 通过 | `total=0`，`probeStillPresent=false` |
| BYOK 无 Key | `POST /api/provider/test`，缺少 `apiKey` | 通过 | 返回 `ok=false`，`error=缺少 API Key` |
| BYOK 非法 URL | `POST /api/provider/test`，`apiBase=not a url` | 通过 | 返回 `ok=false`，`error=API Base 不是有效 URL` |
| BYOK 本地地址拦截 | `POST /api/provider/test`，`apiBase=http://127.0.0.1:9`，dummy key | 通过 | 返回 `ok=false`，`error=API Base 不允许指向 localhost、内网或链路本地地址` |

## 2026-06-16 18:05 前端可见性回归

本轮继续 M3，把上一轮后端任务恢复能力接到任务中心前端反馈里。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 超时失败可读 | 注入一个 40 分钟未更新的 running 任务，启动本地服务后打开任务中心 | 通过 | 任务中心显示 `任务运行超过30分钟无响应，可能已中断` |
| 恢复提示可执行 | 浏览器点击 `打开任务中心` | 通过 | 失败任务下方显示 `系统已把长时间无响应任务恢复为失败状态。建议先查看配置，确认素材和模型后重新生成。` |
| 操作路径保留 | 浏览器检查失败任务按钮 | 通过 | 可见 `查看配置`、`编辑配置`、`重新生成`、`删除任务` |
| 探针污染恢复 | 通过 `DELETE /api/tasks` 删除探针任务，并恢复 `/tmp/dreambox-tasks/tasks.json` 备份 | 通过 | `GET /api/tasks?limit=10` 返回 `total=0`、`cleanupCount=0` |

## 前端改动记录

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/contexts/TaskContext.tsx` | 同步 `/api/tasks` 时保留 `cleanupCount`、最近同步时间和同步错误 | 任务中心可以展示服务端恢复/同步异常，不再静默失败 |
| `src/components/task-center.tsx` | 增加超时/配置错误的恢复提示；失败任务展示为可读提示卡片；已取消任务也可重新生成 | 用户知道失败原因和下一步动作，减少任务卡死感 |
| `src/components/task-center.tsx` | 将任务状态、进度条、tab 选中态从旧红色主题调整为蓝青/琥珀体系 | 任务中心与当前黑色 AIGC 产品视觉更一致 |
| `src/types/task.ts` | 扩展 `TaskContextType` 同步元信息字段 | 前端状态契约与后端 `cleanupCount` 对齐 |

## 2026-06-16 20:47 首页商业体验回归

本轮按 F6 处理首页视觉可信度问题：用户指出头图左侧过黑、浮层截图设计不自然，以及画廊中“视频/画布”素材重复导致不像真实短片。改动仅限首页视觉和画廊卡片，不改变功能入口和生成链路。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 首页品牌可见 | 浏览器刷新 `http://localhost:5000/` | 通过 | H1 为 `绘影`，口号 `绘意成片，影贯全程` 可见 |
| 头图左侧层次 | 浏览器截图检查 | 通过 | 左侧补入低透明短片场景和制作时间线暗示，不再是纯黑空洞 |
| 视频卡不再复用流程图 | DOM 与截图检查 | 通过 | `雨巷追光`、`香氛广告`、`森林推进` 使用短片/广告/镜头画面，并显示播放态、时长和时间线 |
| 工作流图语义保留 | DOM 检查 | 通过 | `huiying-workflow-canvas.png` 仅保留在 `镜头流水线` 画布语义卡 |
| 画廊跳转可用 | 浏览器点击 `雨巷追光` | 通过 | 进入 `影视创作` 页面，随后通过 `回到绘影首页` 返回 |
| 核心入口保留 | 浏览器 DOM 检查 | 通过 | `首页`、`素材`、`视频`、`精灵`、`影视`、`画布`、`研究`、`任务`、`设置` 仍可见 |

## 首页视觉改动记录

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/app/DreamboxHome.tsx` | 调整 hero 遮罩、左侧暗部层次和制作台浮层 | 头图保持黑色质感，同时避免左侧空洞和截图感过重 |
| `src/app/DreamboxHome.tsx` | 替换画廊首屏视频/短片素材映射，减少工作流图重复 | 用户能区分成片、镜头、广告、画布和资产 |
| `src/app/DreamboxHome.tsx` | 为短片/视频/镜头/广告卡增加播放按钮、时长和进度条 | 静态素材更像视频作品入口，不误导为普通图片 |

## 2026-06-16 22:08 首页 hero 原创化回归

本轮继续 F6。用户确认旧版沉浸黑色首页方向可取，但指出女侧脸发丝式头图与参考产品过于雷同；因此将 hero 调整为“镜头、分镜、制作台、任务流”主题，保留绘影的短剧制作语义，避免照搬竞品视觉母题。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 头图不再使用女侧脸母题 | 静态资源和浏览器 DOM 检查 | 通过 | hero 指向 `/home/huiying-hero-cinematic-flow.png`，画面主体为镜头制作流、分镜屏和制作台 |
| 左侧不再纯黑空洞 | 浏览器截图检查 | 通过 | 左侧保留文字阅读区，同时有低亮度场景、镜头流和分镜节点作为层次 |
| 旧截图浮层移除 | DOM 检查 | 通过 | 删除额外叠加的 `huiying-story-rain.png` 和左侧 HUD 卡片浮层，避免“截图贴上去”的割裂感 |
| 品牌文案保留 | 浏览器刷新 `http://localhost:5000/` | 通过 | H1 为 `绘影`，口号 `绘意成片，影贯全程` |

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `public/home/huiying-hero-cinematic-flow.png` | 新增原创首页 hero 资产 | 保留沉浸式黑色电影感，同时转向绘影自己的镜头/分镜/制作流识别 |
| `src/app/DreamboxHome.tsx` | hero 切换到新资产，并收敛遮罩和浮层 | 减少雷同和截图感，提升首页第一屏可信度 |

## 2026-06-16 22:45 F4 任务可靠性脚本化回归

本轮从首页视觉回到 F4，把任务可靠性验证固化为可复跑脚本。脚本只注入本地 `codex-f4-qa-*` 探针任务，结束后恢复原任务文件；不使用真实 API Key，不调用供应商，不产生费用。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 任务列表可读 | `pnpm run qa:tasks` 注入 running/failed 探针后请求 `GET /api/tasks?limit=20` | 通过 | 找到 `codex-f4-qa-running-*` 和 `codex-f4-qa-failed-*`，`cleanupCount=0` |
| 单任务状态可轮询 | 同脚本请求 `GET /api/tasks/{runningId}` | 通过 | 返回 `status=running`、`progress=37`、`stage=镜头生成中` |
| SSE 等待安抚 | 同脚本请求 `GET /api/tasks/{runningId}/events` | 通过 | 返回 `Content-Type=text/event-stream; charset=utf-8`，事件包含 `event: task`、`waitingHint`、`nextPollMs` |
| 运行中任务可取消 | 同脚本执行 `DELETE /api/tasks/{runningId}` | 通过 | 返回 `status=cancelled`、`message=任务已取消` |
| 失败任务可重试 | 同脚本执行 `POST /api/tasks/{failedId}` + `{ "action": "retry" }` | 通过 | 返回 `status=pending`、`retryCount=1`、`originalTaskId={failedId}` |
| 探针污染恢复 | 脚本 finally 恢复原任务文件后再次请求 `GET /api/tasks?limit=20` | 通过 | `leakedProbeTasks=0`、`totalAfterRestore=0` |
| 任务中心前端反馈 | 浏览器打开 `http://localhost:5000/` 并点击 `查看任务中心，当前 2 个任务` | 部分通过 | 页面展示 `镜头生成中`、`重连中，已保留轮询`、等待安抚文案、已运行时间、`取消`、失败恢复提示；但本次页面数据来自浏览器本地历史探针任务，暴露出 localStorage 历史任务与服务端任务同步优先级仍需治理 |
| 服务端探针恢复 | 恢复 `\tmp\dreambox-tasks\tasks.json` 后请求 `GET /api/tasks?limit=20` | 通过 | `codex-f4-browser-*` 服务端泄漏数为 `0` |

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `scripts/qa-task-reliability.mjs` | 新增任务可靠性端到端探针 | 后续自动化和发布前检查可以稳定验证长任务反馈、取消、重试、恢复 |
| `package.json` | 新增 `qa:tasks` 命令 | 让 F4 门槛变成标准 npm script |
| `README.md` | 增加 `pnpm run qa:tasks` 发布前说明 | 操作者知道如何验证长任务体验，且知道该探针不会产生费用 |

### 下一轮 F4 风险

- 任务中心会合并浏览器本地历史任务和服务端任务；当本地 `dreambox-background-tasks` 残留旧探针时，页面可能展示旧任务而非本轮服务端探针。下一轮应收敛同步策略：服务端任务优先、已删除/探针任务不回流、提供清空本地历史任务的用户可见入口或自动清理策略。

## 2026-06-16 23:18 F4 本地历史任务同步回归

本轮继续收敛上一轮暴露的 localStorage 历史任务污染问题。服务端 `/api/tasks` 同步成功后，前端现在以服务端任务列表为权威来源：服务端已不存在的 UUID/codex 探针任务会被移除；已断连或超过短暂宽限期的本地运行中任务不会继续显示为真实后台任务；事件流错误回调也不会把已被同步裁决删除的任务重新创建出来。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 服务端任务探针仍通过 | `pnpm run qa:tasks` | 通过 | `task-list`、`running-detail`、`sse-waiting-feedback`、`cancel-running-task`、`retry-failed-task`、`probe-restore` 全部 `ok=true` |
| 类型契约仍通过 | `pnpm run ts-check` | 通过 | `tsc -p tsconfig.json` 无错误 |
| 本地历史运行任务不回流 | Playwright 注入 `task_codex_local_stale_running` 和 `codex-f4-browser-probe-local` 到 `dreambox-background-tasks` 后刷新首页 | 通过 | 任务按钮显示 `任务 0`，任务中心显示 `全部 (0)`、`进行中 (0)`、`暂无任务`，`localStorageAfter=[]` |
| 事件流竞态不复活任务 | 同上，等待事件流错误和同步完成后点击任务中心 | 通过 | 页面不再出现 `历史假任务`、`浏览器本地历史假任务` 或 `codex-f4-browser-probe-local` |

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/contexts/TaskContext.tsx` | 服务端同步时只保留短暂宽限期内的乐观本地任务，移除服务端缺席的历史运行任务、探针任务和过期终态任务 | 任务中心不再因浏览器缓存残留展示“假运行中”，降低长任务卡死感 |
| `src/contexts/TaskContext.tsx` | 新增 `updateExistingTask`，事件流回调只更新已存在任务，不再重建已被服务端同步删除的任务 | 解决同步删除与 SSE 失败回调之间的竞态，保证服务端裁决优先 |

## 2026-06-16 18:36 长任务事件流回归

本轮按自动化 F4 补齐长任务的服务端事件流契约，为 1 分钟以上视频生成前的“可追踪、可安抚、可恢复”打底。本轮只使用本地临时任务探针，没有调用真实供应商。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 单任务详情仍可读 | 注入一个本地 `running` 视频任务后请求 `GET /api/tasks/codex-sse-running-1781606172587` | 通过 | 返回 `status=running`、`progress=37`、`stage=镜头生成中`、`message=正在生成第 1 个镜头` |
| SSE 长任务反馈 | 请求 `GET /api/tasks/codex-sse-running-1781606172587/events` | 通过 | 返回 `Content-Type=text/event-stream; charset=utf-8`、`retry: 2000`、`event: task`、`waitingHint=正在生成核心镜头内容。视频、分镜和多素材任务通常会停留在此阶段较久。` |
| 缺失任务可读错误 | 请求 `GET /api/tasks/codex-missing/events` | 通过 | 返回 `404`，`success=false`，`error=任务不存在` |
| 探针污染恢复 | 恢复临时任务文件备份后请求 `GET /api/tasks?limit=5` | 通过 | 返回 `tasks=[]`、`monitorTasks=[]`、`total=0`、`cleanupCount=0` |

## 长任务接口契约

| 接口 | 用途 | 用户体验要求 |
| --- | --- | --- |
| `GET /api/tasks/{taskId}` | 单次轮询任务状态 | 前端可在不支持 SSE 的环境下 fallback 到轮询 |
| `GET /api/tasks/{taskId}/events` | 长任务事件流 | 前端应展示 `stage`、`message`、`progress`、`waitingHint`，并按 `nextPollMs/retry` 处理重连 |
| `DELETE /api/tasks/{taskId}` | 取消任务 | 长视频生成必须给用户中止入口 |
| `POST /api/tasks/{taskId}` + `{ "action": "retry" }` | 失败/取消后重试 | 用户应能在任务中心复用原配置并重新生成 |

## 2026-06-16 18:56 任务中心事件流前端回归

本轮继续 F4，把上一轮新增的 `GET /api/tasks/{taskId}/events` 接入前端任务上下文和任务中心。现有轮询仍保留为 fallback；事件流只增强运行中任务的阶段、等待安抚和重连状态。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 运行任务事件流订阅 | 注入一个本地 `running` 视频任务，浏览器打开 `http://127.0.0.1:5000/` 后点击 `打开任务中心` | 通过 | 页面显示 `镜头生成中`、`正在生成第 1 个镜头`、`实时同步` |
| 等待安抚文案 | 同一任务中心卡片 | 通过 | 页面显示 `正在生成核心镜头内容。视频、分镜和多素材任务通常会停留在此阶段较久。` |
| 后台运行提示 | 同一任务中心卡片 | 通过 | 页面显示 `已运行 6分56秒，可留在后台继续生成。` |
| 探针污染恢复 | 清理浏览器 `dreambox-background-tasks` 中 `id` 以 `codex-` 开头的探针任务，并恢复 `/tmp/dreambox-tasks/tasks.json` 备份 | 通过 | 服务端 `GET /api/tasks?limit=5` 返回 `tasks=[]`、`total=0`、`cleanupCount=0`；刷新后页面不再包含 `codex-ui-stream`、`实时同步`、`正在生成核心镜头内容` |

## 前端事件流改动记录

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/contexts/TaskContext.tsx` | 为运行中/等待中任务建立 `EventSource` 连接，监听 `task/done/error` 事件；事件流失败时保留原轮询同步 | 长任务不再只靠盲轮询，前端可实时收到阶段和等待解释 |
| `src/components/task-center.tsx` | 运行中任务展示事件流状态、阶段、消息、等待安抚、已运行时间和后台运行提示 | 用户面对 1 分钟以上生成时有明确进度和心理预期 |
| `src/types/task.ts` | 为任务增加 `waitingHint`、`elapsedSeconds`、`nextPollMs`、`streamStatus` 等可选字段 | 前后端任务状态契约与 SSE payload 对齐 |

## 2026-06-16 19:24 BYOK 最小文本探针回归

本轮从 F4 回到 F3，把设置页的供应商连接测试拆成“模型列表可达性”和“最小文本请求”两条路径。`POST /api/provider/test` 新增 `testMode=chat`，只在用户填写默认模型后发起 `max_tokens=1` 的文本探针；前端明确提示可能产生供应商最小调用费用。本轮未使用真实密钥，未产生费用。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 无 Key 错误 | `POST /api/provider/test`，`testMode=chat`，缺少 `apiKey` | 通过 | 返回 `400`，`error=缺少 API Key` |
| 缺默认模型错误 | `POST /api/provider/test`，dummy key，`testMode=chat`，缺少 `model` | 通过 | 返回 `400`，`error=请先填写默认模型，再测试文本请求` |
| 本地地址拦截 | `POST /api/provider/test`，dummy key，`apiBase=http://127.0.0.1:9`，`testMode=chat` | 通过 | 返回 `400`，`error=API Base 不允许指向 localhost、内网或链路本地地址` |
| dummy key 外部调用失败可读 | `POST /api/provider/test`，dummy key，`apiBase=https://api.openai.com/v1`，`model=gpt-4o-mini`，`testMode=chat` | 通过 | 返回 `502`，`error=连接超时，请检查 API Base 或网络`，未暴露 key |
| 设置页入口可见 | 浏览器打开 `http://127.0.0.1:5000/`，进入 `设置与 BYOK` | 通过 | 可见 `模型连接`、`测试连接`、`测试文本请求`、`1 token 探针`、`公网部署启用 HTTPS` |
| 前端无 Key 提示 | 设置页 API Key 为空时点击 `测试文本请求` | 通过 | 页面显示 `请先填写 API Base 和 API Key` |

## BYOK 测试契约

| testMode | 用途 | 费用/风险 |
| --- | --- | --- |
| `models` | 只请求供应商模型列表，用于确认 API Base/API Key 可达 | 通常不产生生成费用，但取决于供应商策略 |
| `chat` | 对默认模型发起 `max_tokens=1` 的最小文本请求，用于确认模型名和调用权限 | 可能产生供应商最小调用费用，必须由用户主动点击 |
| `image` | 对图片模型发起一张最小图片生成探针，用于确认图片端点和模型权限 | 可能产生供应商最小图片调用费用，必须由用户主动点击 |
| `auto` | 保持旧兼容：先测模型列表，列表失败且填写了模型时 fallback 到文本探针 | 仅供旧调用路径兼容，新 UI 默认使用显式按钮 |

## 2026-06-16 20:07 BYOK 最小图片探针回归

本轮继续 F3，把设置页供应商测试扩展到图片端点。`POST /api/provider/test` 新增 `testMode=image`，只在用户填写图片模型后调用 `/images/generations`；前端新增 `测试图片请求` 按钮，并明确提示该操作可能产生供应商最小图片调用费用。本轮未使用真实密钥，未产生费用。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 无 Key 错误 | `POST /api/provider/test`，`testMode=image`，缺少 `apiKey` | 通过 | 返回 `400`，`error=缺少 API Key` |
| 缺图片模型错误 | `POST /api/provider/test`，dummy key，`testMode=image`，缺少 `model` | 通过 | 返回 `400`，`error=请先填写图片模型，再测试图片请求` |
| 本地地址拦截 | `POST /api/provider/test`，dummy key，`apiBase=http://127.0.0.1:9`，`testMode=image` | 通过 | 返回 `400`，`error=API Base 不允许指向 localhost、内网或链路本地地址` |
| dummy key 外部调用失败可读 | `POST /api/provider/test`，dummy key，`apiBase=https://api.openai.com/v1`，`model=gpt-image-1`，`testMode=image` | 通过 | 返回 `502`，`error=连接超时，请检查 API Base 或网络`，未暴露 key |
| 设置页入口可见 | 浏览器打开 `http://127.0.0.1:5000/`，进入 `设置与 BYOK` | 通过 | 可见 `模型连接`、`测试图片请求`、`图片生成端点`、`供应商最小调用费用` |
| 前端无 Key 提示 | 设置页 API Key 为空时点击 `测试图片请求` | 通过 | 页面显示 `请先填写 API Base 和 API Key` |

## 当前结论

- M3 任务中心的最低可靠性门槛继续前进：任务列表请求现在能主动清理过期运行任务，旧任务会回到用户可理解的失败状态。
- M3 前端可见性继续前进：用户现在能在任务中心看到失败原因、恢复建议和重试路径。
- F4 长任务反馈门槛继续前进：SSE 事件流已接到前端任务上下文和任务中心，运行中任务能显示实时同步、阶段、等待安抚和后台运行提示。
- F3 BYOK 的最低文本/图片调用门槛继续前进：用户现在可以分别测试模型列表可达性、默认模型的最小文本调用、图片模型的最小图片调用；无 key、缺模型、内网 base、dummy key 失败都是可读错误，且本轮未使用真实密钥。
- 这仍不是最长视频生成能力评估；M6 需要在 M1-M3 更完整后，按 5s -> 10s -> 15s -> 30s -> 60s 阶梯测试。

## 下一步建议

下一轮优先继续 F2：把“剧本 -> 分镜 -> 任务”链路用本地 dry-run 串成可回看的闭环；随后才进入 F5 的 5s 视频阶梯测试。
## 2026-06-17 F4 分段视频恢复回归

本轮针对真实 61 秒 Ark 任务暴露的问题做工程化回归：上一版分段合成失败后会把第一个短片当最终成片，且没有保留每段 URL，导致用户既误以为成功，又无法恢复已生成资产。本轮参考三个项目的落地点如下：

- ViMAX：多镜头链路必须把每个镜头当成可审阅、可重试的阶段产物。
- Toonflow-app：画布/节点式资产组织要求视频片段先成为节点资产，而不是只存在于最终合成结果里。
- ArcReel：小说/剧本到分镜到视频片段再合成的工程链路要求任务队列能恢复中间产物，失败后可重试合成或导出片段。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 分段结果契约 | `buildPartialSegmentResult()` 生成两个片段结果 | 通过 | `isPartial=true`、`segmentCount=2`、每段保留 `videoUrl`，首段保留 `lastFrameUrl` |
| 合成失败不假成功 | `pnpm run qa:video-recovery` 注入临时任务、写入分段结果后调用 `failTask()` | 通过 | 任务状态为 `failed`，错误包含 `合并成长视频失败` |
| 已生成片段可恢复 | 同脚本读取任务详情 | 通过 | `preservedSegmentCount=2`，失败任务仍保留片段 URL |
| 探针费用与密钥 | 本地任务文件注入 | 通过 | `usedRealKey=false`、`incurredCost=false` |

本轮改动：

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/lib/segmented-video-task-result.ts` | 新增 `buildPartialSegmentResult()` 统一分段资产结果结构 | 路由、任务中心和 QA 共用同一契约，避免片段字段漂移 |
| `src/app/api/video/merge/route.ts` | 分段完成回调改用统一结果构造器 | 每段生成后都能持久化为可恢复资产 |
| `scripts/qa-segmented-video-recovery.ts` | 新增无供应商费用的恢复回归脚本 | 后续每次改长视频任务链路都能验证“失败不假成功、片段不丢” |
| `package.json` | 新增 `qa:video-recovery` | 发布前检查可直接运行 |
| `src/types/task.ts` | 扩展 `TaskResult.segments` 类型 | 前端能类型化识别可恢复片段，不靠隐式字段 |
| `src/components/task-center.tsx` | 失败任务展示已保留片段，并在结果弹窗提供打开、复制、下载入口 | 合成失败不再等于资产丢失，用户可检查片段并继续剪辑或重试 |

补充浏览器验证：

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 任务中心片段恢复可见 | 浏览器打开 `http://localhost:5000/`，点击 `查看任务中心，当前 5 个任务` | 通过 | 失败的 61 秒分段任务显示 `已保留 2 个可恢复片段`、`片段 1`、`片段 2`、`查看片段` |
| 片段详情可操作 | 同一浏览器任务中心点击 `查看片段` | 通过 | `视频结果` 弹窗显示 `已保留的镜头片段`，每段提供 `打开`、`复制`、`下载` |
| 探针污染恢复 | 恢复 `/tmp/dreambox-tasks/tasks.json` 浏览器验证备份 | 通过 | 临时 `codex-segment-recovery-browser` 任务仅用于 UI 验证，验证结束后恢复原任务文件 |

下一步进入真实 60 秒前的门槛：

1. 合成服务需要明确可用性探针；如果 `VideoEditClient.concatVideos` 不可用，应在任务中心给出“片段已生成，合成失败，可重试合成”的动作。
2. 下一轮真实 F5 不应直接重跑 60 秒，应先从 10s/30s 阶梯恢复，并继续用 `qa:video-duration` 解析实际媒体时长。

## 2026-06-17 R3/R6 失败片段重新排队回归

本轮继续围绕真实 61 秒失败复盘暴露的恢复问题推进：上一轮任务中心能看到 `assemblyPlan.segments` 和失败原因，但用户仍不能从父任务结果面板直接恢复某个失败片段。本轮参考 ArcReel 的“片段任务队列可恢复”思路，把失败片段重试落成独立后端 API 与任务中心按钮；默认只重新排队，不调用供应商，不产生费用。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 失败片段可重新排队 | `pnpm run qa:segment-retry` 先用 dummy Ark 缺视频模型制造失败，再调用 `/api/production/assembly-plan/segment/retry` | 通过 | 子任务从 `failed` 恢复为 `pending`，`retryCount>=1` |
| 父任务 segment 错误被清理 | 同脚本读取父任务详情 | 通过 | 失败 segment 回到 `queued`，`error` 清空，保留同一个 child task id |
| 队列索引不丢失 | 同脚本读取 `assemblyQueue.childTaskIds` | 通过 | 重新排队后的 child task id 仍在父任务队列中 |
| 费用与密钥 | dummy key + 缺模型错误路径 | 通过 | `usedRealKey=false`、`incurredCost=false`，未触发真实视频生成 |

本轮改动：

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/app/api/production/assembly-plan/segment/retry/route.ts` | 新增失败片段重新排队 API，支持通过 `parentTaskId + segmentIndex` 或 `childTaskId` 定位 | 失败恢复不再依赖用户手动找子任务，父任务可以驱动片段级恢复 |
| `src/components/task-center.tsx` | 父任务结果弹窗的失败片段新增“重新排队”按钮 | 用户能在任务中心直接恢复失败片段，且按钮文案明确不会自动产生供应商费用 |
| `scripts/qa-production-segment-retry.mjs` | 新增无费用回归脚本 | 防止后续改动破坏“子任务状态、父任务 segment、assemblyQueue”三者一致性 |
| `package.json` | 新增 `qa:segment-retry` | 发布前可直接运行片段恢复回归 |

下一步建议：

1. 继续 R3：把重新排队后的片段启动动作和任务中心衔接起来，要求真实生成仍必须经过 `allowRealCost=true` 门禁。
2. 继续 R2 前先验证 10s：使用真实 Ark 配置只跑单片段 10s，并用 `qa:video-duration` 解析实际媒体时长，不直接重试 60s。

## 2026-06-17 R2 真实 Ark 10 秒单片段基线

本轮在 5 秒真实视频已通过后，按阶梯进入 10 秒单片段真实验证。测试使用本机私有 `.env.local` 中的 Ark BYOK 配置，脚本只输出配置存在性与任务结果，不输出 API Key。该测试产生真实供应商调用费用。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 真实 Ark 10 秒提交 | `HUIYING_REAL_VIDEO_SECONDS=10 HUIYING_REAL_VIDEO_MAX_SECONDS=10 HUIYING_ALLOW_REAL_VIDEO_COST=true pnpm run qa:real-video-gate` | 通过 | `taskId=0ef0ad2b-a3d4-4af9-a66a-c299498fc7d9`，任务 `completed` |
| 实际媒体时长 | 同脚本下载产物并解析 | 通过 | `durationSeconds=10.074`，文件 `artifacts/huiying-real-ark-10s-0ef0ad2b-a3d4-4af9-a66a-c299498fc7d9.mp4` |
| 长任务反馈 | 同脚本记录 timeline | 通过 | `running` at 0s，`completed` at 73s，最终 `progress=100` |
| 历史 61 秒基线复核 | 同脚本继续解析历史文件 | 未通过 1 分钟能力 | 历史 `artifacts/huiying-ark-61s.mp4` 实际仍为 `6.074s` |

当前最长稳定生成能力结论：

- 已真实验证：单片段 10 秒请求可完成，实际媒体约 10.074 秒。
- 未验证通过：30 秒、60 秒、60 秒以上。
- 下一步不应直接跑 60 秒；应先跑 30 秒单片段。如果 30 秒成功，再评估是供应商单任务支持 60 秒，还是必须走多个 10-15 秒片段队列再合成。

## 2026-06-17 R3/R6 真实 30 秒分段合成恢复

本轮继续真实 30 秒阶梯验证。两次真实 Ark 30 秒任务均完成了 3 个约 10 秒片段，但云端合成阶段失败；这说明当前瓶颈不是视频片段生成，而是长片合成与失败恢复。参考 ArcReel 的“生成任务队列 + 中间产物可恢复”思路，本轮将已保留片段接入本地 FFmpeg 合成恢复 API，并在任务中心暴露“重试合成成片”动作。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 真实 Ark 30 秒片段生成 | `HUIYING_REAL_VIDEO_SECONDS=30 HUIYING_REAL_VIDEO_MAX_SECONDS=30 HUIYING_ALLOW_REAL_VIDEO_COST=true pnpm run qa:real-video-gate` | 片段成功，云端合成失败 | 两个真实任务均保留 `segmentCount=3`、`successSegmentCount=3`、`isPartial=true` |
| 本地 FFmpeg 路径故障定位 | `pnpm run qa:merge-segments` | 初次失败 | `ffmpeg-static` 在 Next/Windows 运行时解析为 `\\ROOT\\node_modules\\...`，实际二进制不存在 |
| 本地合成恢复 | 修复 FFmpeg 路径解析后运行 `pnpm run qa:merge-segments` | 通过 | 任务 `5c30c13a-f33a-4454-8dad-7b58ec205d15` 从 `failed` 恢复为 `completed`，实际时长 `30.174s` |
| 第二个失败任务复核 | 指定 `HUIYING_MERGE_TASK_ID=c6c8ca13-97ce-4299-b045-ed8be0dcdee1 pnpm run qa:merge-segments` | 通过 | 任务从 `failed` 恢复为 `completed`，实际时长 `30.174s` |
| 成片 HTTP 可访问 | `HEAD /generated/videos/huiying-merge-*.mp4` | 通过 | 最近两个本地成片均返回 HTTP 200，文件大小约 37MB |
| 费用与密钥 | 30 秒生成使用本地授权 Ark 配置；本地合成恢复不调用供应商 | 生成阶段产生真实费用，恢复阶段无新增供应商费用 | 恢复 API 返回 `usedRealKey=false`、`incurredCost=false` |

本轮改动：

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/lib/local-video-merge.ts` | 新增本地 FFmpeg 合成库，支持下载已生成片段、concat/re-encode 兜底、输出到 `public/generated/videos` | 供应商合成失败时可以恢复长片，不必重新烧视频生成费用 |
| `src/lib/generate-segmented-video.ts` | 分段视频合成失败时复用本地 FFmpeg 兜底 | 真实生成主链路从“云端合成失败即失败”升级为“先云端，失败后本地恢复” |
| `src/app/api/tasks/[taskId]/merge-segments/route.ts` | 新增失败任务按已保留片段重试合成 API | 任务中心和 QA 可对失败任务做恢复，不依赖一次性生成流程 |
| `src/components/task-center.tsx` | 已保留片段区域新增“重试合成成片”按钮 | 用户可在任务中心恢复成片，且文案明确不会重新调用供应商生成 |
| `scripts/qa-merge-failed-segments.mjs` | 新增恢复回归脚本，自动找失败分段任务或按 `HUIYING_MERGE_TASK_ID` 指定任务 | 发布前可验证“片段不丢、合成可恢复、实际时长可解析” |
| `package.json` / `pnpm-lock.yaml` | 新增 `ffmpeg-static` 和 `qa:merge-segments` | 部署环境可复现本地合成能力 |

当前最长稳定生成能力结论：

- 已真实验证完成：10 秒单片段，实际 `10.074s`。
- 已真实验证恢复：30 秒分段成片，实际 `30.174s`，通过本地 FFmpeg 从 3 个成功片段恢复。
- 尚未验证通过：60 秒与 60 秒以上。下一步应先把 60 秒拆成 6 个 10 秒片段，并复用同一恢复 API；成功后必须解析实际媒体时长，不能只看任务标称。

## 2026-06-17 R2 真实 Ark 60 秒分段成片基线

本轮在 30 秒分段恢复通过后，继续按阶梯推进到 60 秒真实 Ark 测试。`qa:real-video-gate` 在任务刚提交后的首次轮询遇到瞬时 404，并触发 Windows/Node `uv` 断言退出；随后通过任务中心确认真实任务已创建，因此没有重复提交，改为人工轮询该任务直到完成。该轮真实调用可能产生供应商费用。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 真实 Ark 60 秒提交 | `HUIYING_REAL_VIDEO_SECONDS=60 HUIYING_REAL_VIDEO_MAX_SECONDS=60 HUIYING_ALLOW_REAL_VIDEO_COST=true pnpm run qa:real-video-gate` | 已提交，脚本误报失败 | 任务中心出现真实任务 `af920b1c-7ab0-4894-89d6-a4a2159189e4`，`duration=60` |
| 60 秒任务轮询 | 直接轮询 `/api/tasks/af920b1c-7ab0-4894-89d6-a4a2159189e4` | 通过 | 约 571 秒完成，阶段从 `生成第 1/6 个片段...` 到 `已完成` |
| 片段数量 | 同任务详情 | 通过 | `segmentCount=6`，6 个片段均有 `videoUrl` |
| 最终成片 | 同任务详情 | 通过 | `videoUrl=/generated/videos/huiying-merge-1781690078918-e55a96f127f658.mp4` |
| HTTP 可访问 | `HEAD /generated/videos/huiying-merge-1781690078918-e55a96f127f658.mp4` | 通过 | HTTP 200，`Content-Length=76441917` |
| 实际媒体时长 | `node scripts/check-video-duration.mjs public/generated/videos/huiying-merge-1781690078918-e55a96f127f658.mp4` | 通过 | `durationSeconds=60.324` |
| QA 脚本修复 | `scripts/qa-real-video-gate.mjs` | 已修 | `pollTask()` 对任务提交后的短暂 404 容忍 60 秒，避免重复烧生成额度 |

当前最长稳定生成能力结论：

- 已真实验证完成：60 秒分段成片，实际 `60.324s`。
- 仍需继续验证：60 秒以上，例如 70 秒或更长；下一步必须继续沿用同一个任务恢复和媒体时长解析链路，不能只看 UI 成功。

## 2026-06-17 Q6 通用失败片段只补 API

本轮继续收敛真实长任务体验：上一轮已经能在 `/api/video/merge` 的通用分段任务里持久化每个片段的 `prompt/duration/ratio/videoModel/videoUrl/error`，但失败后仍缺少“只补失败段”的统一入口。本轮参考 ArcReel 的片段队列恢复思路，新增 `/api/tasks/{taskId}/resume-segment`，默认先做无费用 dry-run，真实补段必须显式传入费用门禁。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 自动定位失败片段 | `pnpm run qa:resume-segment` 注入 2 段成功 + 1 段失败的临时任务后调用默认 dry-run | 通过 | 返回 `segmentIndex=2`、`promptReady=true`、`successSegmentCount=2` |
| 已完成片段不重烧 | 同脚本指定 `segmentIndex=0` | 通过 | 返回 HTTP 409，`usedRealKey=false` |
| 真实补段费用门禁 | 同脚本传 `dryRun=false` 但不传 `allowRealCost=true` | 通过 | 返回 HTTP 400，`incurredCost=false` |
| QA 不污染任务文件 | 同脚本备份并恢复 `/tmp/dreambox-tasks/tasks.json` | 通过 | `leakedProbeTasks=0`，历史任务数量恢复为 17 |

本轮改动：

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/app/api/tasks/[taskId]/resume-segment/route.ts` | 新增失败/缺失片段恢复 API，支持 dry-run、完成段 409 防重烧、真实补段显式费用门禁、补段后可触发本地合成 | 用户后续可以只补失败片段，不必为已成功片段重复消耗视频额度 |
| `scripts/qa-resume-segment.mjs` | 新增无费用 QA，覆盖失败段定位、完成段拒绝、费用门禁和任务文件恢复 | 每次改恢复链路后都能验证“不会误烧、不会污染任务状态” |
| `package.json` | 新增 `qa:resume-segment` | 发布前可直接运行片段只补回归 |
| `src/lib/task-manager.ts` | 清理定时器增加 `unref` | 一次性 QA 脚本不再被后台清理定时器挂住 |

补充修复：`qa:resume-segment` 在脚本写入任务后，会对 `/api/tasks/{taskId}/resume-segment` 的短暂 `任务不存在` 做有限重试，覆盖服务端任务缓存和文件刷新之间的短窗口；同时该 QA 必须串行运行，不能和其他任务文件 QA 并发抢锁。

下一步建议：

1. 将任务中心失败片段按钮接到 `/api/tasks/{taskId}/resume-segment`，先走 dry-run 确认片段，再由用户确认真实补段。
2. 真实补段时继续复用 `runWithBYOKVideoRetry()` 和媒体时长解析，补完后必须验证合成产物，而不是只看供应商任务成功。

## 2026-06-17 Q6 任务中心接入只补失败片段

本轮把上一节的通用恢复 API 接到任务中心前端：失败的视频分段任务如果同时保留了成功片段和失败片段快照，用户可以在任务卡片先执行“只补失败段”的 dry-run 检查，也可以在结果弹窗里对具体失败片段执行“检查”或“真实补段”。真实补段会读取浏览器本地 BYOK 配置并弹出确认，只有确认后才会传 `dryRun=false` 与 `allowRealCost=true`。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 前端类型契约 | `pnpm run ts-check` | 通过 | `task-center.tsx` 新增恢复按钮、BYOK headers 读取和真实补段确认后类型通过 |
| 恢复 API 门禁 | `pnpm run qa:resume-segment` | 通过 | dry-run 定位失败片段；已完成片段返回 409；真实补段无费用门禁时返回 400；探针任务无泄漏 |
| 服务健康 | `GET /api/health` | 通过 | HTTP 200 |
| 浏览器点击 | in-app browser 尝试打开 `http://localhost:5000/` 并点击任务入口 | 未完成 | 浏览器插件在临时 tab attach 时超时；已恢复临时任务文件，确认 `codex-ui-resume-segment-probe` 未泄漏 |

本轮改动：

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/components/task-center.tsx` | 识别 `result.segments` 中有 prompt/duration 的失败片段；任务卡片显示“待补失败片段”；结果弹窗提供“检查”和“真实补段” | 用户可以从任务中心直接理解并恢复失败片段，而不是只能重新生成整个任务 |
| `docs/yh-task-reliability-qa.md` | 记录前端接入、验证和浏览器验证边界 | 后续自动化知道下一步应补稳定浏览器点击，而不是重复做接口层 |

下一步建议：

1. 用稳定浏览器会话补一次真实点击验证：打开任务中心、进入失败任务结果弹窗、点击“检查”，确认弹窗提示只补第 N 段。
2. 选择一个真实失败的 Ark 分段任务执行一次真实补段，补完后必须解析最终合成媒体时长。
