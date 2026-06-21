# 绘影制作全流程 dry-run 回归

更新时间：2026-06-17 00:27（Asia/Shanghai）

## 本轮目标

本轮按自动化 F2 推进“制作全流程闭环”。目标不是调用真实供应商生成视频，而是先用本地可复跑链路证明绘影能把一个短片创意拆成可回看的制作任务：

`创意/剧本 -> 角色/场景/资产摘要 -> 分镜/镜头 -> 任务中心 -> 后续成片/导出`

该链路用于对齐 ViMAX 的多阶段创作链路、Toonflow-app 的节点化资产组织，以及 ArcReel 的剧本到分镜到任务队列工程链路；不会照抄它们的视觉或产品命名。

## 新增接口

| 接口 | 用途 | 是否调用供应商 | 是否产生费用 |
| --- | --- | --- | --- |
| `POST /api/production/dry-run` | 用本地分镜引擎把创意拆成项目、视觉锚点、字幕/旁白、镜头列表，并写入任务中心 | 否 | 否 |

请求示例：

```json
{
  "prompt": "雨夜的旧剧院里，一名年轻剪辑师发现胶片中反复出现同一个未来镜头，她必须在天亮前把真相剪成一支一分钟短片。",
  "duration": 60,
  "segmentDuration": 10,
  "style": "黑色电影感短剧",
  "sceneType": "drama",
  "ratio": "16:9"
}
```

返回重点字段：

| 字段 | 说明 |
| --- | --- |
| `taskId` | 写入任务中心的 `storyboard` 任务 ID |
| `flow.stages` | 创意、资产、分镜、任务、导出五段流程状态 |
| `flow.totalDuration` | dry-run 计划总时长，当前 QA 固定验证至少 60 秒 |
| `shots` | 可进入后续图片/视频生成的镜头队列 |
| `project.visualAnchors` | 用于角色、场景、风格一致性的视觉锚点 |

## 回归脚本

```bash
pnpm run qa:flow
```

该脚本会：

1. 请求 `POST /api/production/dry-run` 创建一个 60 秒 dry-run 制作任务。
2. 请求 `GET /api/tasks/{taskId}` 验证任务已完成且结果包含分镜与 `productionFlow`。
3. 请求 `GET /api/tasks?type=storyboard` 验证任务中心可追踪。
4. 恢复 `/tmp/dreambox-tasks/tasks.json` 原始内容，避免污染用户任务。

注意：`qa:flow` 与 `qa:tasks` 都会临时改写同一个任务文件，脚本已使用 `${HUIYING_TASKS_FILE}.qa.lock` 做互斥。发布检查应顺序执行；若并行运行，后启动的脚本会给出可读锁文件错误，而不会覆盖另一个脚本的任务备份。

## 当前验证结果

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| dry-run 创建 | `pnpm run qa:flow` | 通过 | `success=true`，`usedRealKey=false`，`incurredCost=false` |
| 60 秒分镜规划 | `pnpm run qa:flow` | 通过 | `shotCount=6`，`totalDuration=60` |
| 任务详情可回看 | `pnpm run qa:flow` 请求 `GET /api/tasks/{taskId}` | 通过 | `status=completed`，`type=storyboard`，`resultShotCount=6` |
| 任务列表可追踪 | `pnpm run qa:flow` 请求 `GET /api/tasks?type=storyboard` | 通过 | `listed=true`，`total=1` |
| 探针恢复 | `pnpm run qa:flow` 结束后恢复任务文件 | 通过 | `leakedProbeTasks=0`，`totalAfterRestore=0` |
| 任务中心前端可见 | Playwright 在页面环境请求 `/api/production/dry-run` 后打开任务中心 | 通过 | 任务按钮 `任务 1`；任务中心显示 `全部 (1)`、`已完成 (1)`、`分镜头生成`、`60s`、`打开结果`、`重新生成` |

## 本轮验证命令

```bash
pnpm run ts-check
pnpm run qa:flow
pnpm run qa:tasks
```

顺序执行结果均通过。曾发现 `qa:flow` 与 `qa:tasks` 并行运行会竞争同一个任务文件，因此本轮已为两个脚本加 `.qa.lock` 互斥锁，并在 README 中注明发布检查应顺序执行。

## 仍未完成

- 该 dry-run 只证明“剧本/创意到任务”的本地闭环，不等于真实 1 分钟视频已生成。
- 成片/导出阶段目前标记为 `pending`，需要后续接入真实视频任务和合成任务。
- 前端尚未把 `production-dry-run` 作为用户可点击的一键演练入口；当前主要用于自动化和发布前质量门。

## 2026-06-17 00:58 真实 61 秒视频生成探针

用户要求直接生成 1 分钟以上视频用于查看。本轮按 F5 的最低门槛先确认配置与任务链路：

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 服务端视频密钥状态 | 检查当前进程环境变量，不输出密钥值 | 未配置 | 未发现 `MINIMAX_API_KEY`、`COZE_API_KEY`、`COZE_WORKLOAD_IDENTITY_API_KEY`、`ARK` / `VOLC` 相关密钥处于已设置状态 |
| 浏览器 BYOK 状态 | 通过 CDP 只读检查 `dreambox-api-connection`，不读取或输出密钥 | 未配置 | `exists=false` |
| 61 秒分段视频提交 | `POST /api/video/merge`，`duration=61` | 已创建任务但随即失败 | `taskId=8f2e544e-224f-4fb0-b1b2-7bb86c27121b`，返回 `segmentCount=7`、`segmentDuration=10` |
| 任务状态轮询 | `GET /api/tasks/8f2e544e-224f-4fb0-b1b2-7bb86c27121b` | 失败可读 | `status=failed`、`progress=10`、`stage=生成失败`、`error=MINIMAX_API_KEY 未配置` |
| 长任务事件流 | `GET /api/tasks/8f2e544e-224f-4fb0-b1b2-7bb86c27121b/events` | 失败提示可读 | SSE 返回 `event: task` / `event: done`，`waitingHint=供应商配置或调用失败。请先到设置页检查 API Base、API Key 和模型名称。` |
| 费用与密钥 | 本轮没有调用真实供应商 | 无费用 | 未使用真实密钥，未产生视频生成费用 |

当前结论：

- 绘影已有 60 秒本地制作 dry-run 和任务中心回看能力。
- 真实 1 分钟以上视频生成入口可提交任务，并会按 7 个 10 秒片段规划，但当前被供应商配置阻塞。
- 现有 1 分钟分段成片路径仍依赖服务端视频密钥，尚未接入设置页 BYOK/Ark 视频生成链路；这也是下一轮 F3/F5 的关键修复点。

## 2026-06-17 01:42 Ark BYOK 视频链路修复

本轮修复上一节暴露的关键问题：`/api/video/merge` 和 `/api/video/submit` 不应在用户配置火山 Ark 后继续硬走 Minimax。现在设置页可分别保存文本、图片、视频模型，前端视频提交会携带 BYOK 请求头，后端视频生成会优先使用 Ark Plan 的任务接口。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 类型检查 | `pnpm run ts-check` | 通过 | `tsc -p tsconfig.json` 无错误 |
| 私有 API Base 拦截 | `POST /api/video/merge`，Ark BYOK headers，`apiBase=http://127.0.0.1:9`，dummy key | 通过 | 返回 `400`，`error=用户供应商配置失败：API Base 不允许指向 localhost、内网或链路本地地址` |
| Ark 视频模型缺失 | `POST /api/video/merge`，Ark BYOK headers，合法 Ark Base，dummy key，缺 `x-yh-video-model` | 通过 | 创建任务 `a20502e9-13c5-48e0-ba61-0bf7242c0781` 后快速失败，`error=供应商配置或调用失败：BYOK 视频调用缺少视频模型` |
| 费用与密钥 | 仅使用 dummy key 和配置错误探针 | 无费用 | 未使用真实密钥，未调用真实视频生成 |

本轮改动：

| 文件 | 改动 | 发布价值 |
| --- | --- | --- |
| `src/lib/byok-provider.ts` | 新增 Ark Plan 视频任务提交、状态查询和轮询工具，支持 `videoModel` | 火山 Ark 成为视频 BYOK 的主路径，不再被 Minimax 硬编码阻塞 |
| `src/lib/generate-segmented-video.ts` | 分段视频生成在有 BYOK 时走 Ark，每段完成后继续合并 | 1 分钟以上视频可按 6s/10s 片段逐级提交和追踪 |
| `src/app/api/video/merge/route.ts` | 从请求头提取 BYOK，失败时给出供应商配置错误 | 长视频入口支持用户自带火山 Key，并保持任务中心可读 |
| `src/app/api/video/submit/route.ts` | 短视频/镜头生成支持 BYOK 优先，失败后进入任务中心 | 影视创作、精灵等入口的视频任务不再只依赖服务端默认 Key |
| `src/lib/byok-client.ts` | 请求头增加 `x-yh-image-model`、`x-yh-video-model` | 文本、图片、视频模型可分开配置 |
| `src/app/DreamboxHome.tsx` | 设置页增加图片模型、视频模型字段 | 用户可以明确填写火山 Seedream/Seedance 模型 |
| `src/components/video-generation-form.tsx`、`src/components/generation-console.tsx`、`src/components/film-creation-panel.tsx` | 视频提交携带 BYOK 请求头 | 主视频、绘影精灵、影视创作入口行为一致 |

下一步 F5：

- 在设置页填写 Ark Plan 的 `API Base`、`API Key` 和视频模型后，先跑 5s 单段视频。
- 5s 成功后再按 10s -> 30s -> 60s 递进；任一级失败就停止加时长并修复任务/轮询/错误提示。

## 2026-06-17 真实 Ark 5 秒与 61 秒阶梯测试

用户明确授权使用其提供的火山 Ark Key 做真实视频测试。本轮只在请求头中传递密钥，未写入代码、文档、日志或最终回复。

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| Ark 5 秒单镜头 | `POST /api/video/submit`，BYOK headers，模型 `doubao-seedance-1.5-pro` | 通过 | 本地任务 `514d6e73-2825-412f-a9e0-5f3d1485a0f5` 完成并返回 Ark mp4 URL |
| Ark 61 秒分段任务 | `POST /api/video/merge`，`duration=61`，BYOK headers，模型 `doubao-seedance-1.5-pro` | 未通过 | 本地任务 `3a8ca093-2345-4538-bd3c-50f671ae0f3b` 完成，但最终文件不是 61 秒成片 |
| 实际媒体时长 | `pnpm run qa:video-duration -- artifacts/huiying-ark-61s.mp4` | 未通过 | 输出 `durationSeconds=6.074`，说明最终结果只是一段短片 |
| 已有片段恢复 | 检查任务文件与 Next 开发日志 | 未能恢复 | `/tmp/dreambox-tasks/tasks.json` 只保留最终短片 URL，日志未记录每段 Ark URL |

根因：

- Ark 单段生成链路是通的，真实 5 秒视频已跑通。
- 61 秒分段任务实际生成了多个片段，但后续合并失败或没有产出长成片。
- 旧实现的 `mergeVideos()` 在合并异常时会 `return segmentUrls[0]`，导致任务被错误标记为成功，并把第一个片段冒充最终成片。
- 旧任务结果没有逐段持久化 `segmentUrls`，所以这次已产生费用的分段结果无法从本地任务文件恢复。

本轮修复：

| 文件 | 修复 | 目的 |
| --- | --- | --- |
| `src/lib/generate-segmented-video.ts` | 合并失败时抛出可读错误，不再返回第一个片段；每段完成后触发 `onSegmentComplete` | 防止 1 分钟任务假成功，并允许未来失败后恢复已生成片段 |
| `src/app/api/video/merge/route.ts` | 分段数计算与生成器对齐；每个片段完成后写入任务 `result.segments`；最终结果保留 `segments` | 任务中心可看到真实片段资产，合并失败也不丢中间产物 |
| `scripts/check-video-duration.mjs` | 新增 MP4 `moov/mvhd` 时长检查脚本 | 后续 F5 必须用实际媒体时长验证，不只看任务状态 |
| `package.json` | 新增 `qa:video-duration` | 将媒体时长验证纳入可复用发布检查 |

当前结论：

- 已验证能力：火山 Ark BYOK 5 秒视频生成可用。
- 未验证/未达标能力：1 分钟以上最终成片不可声明可用。本轮 61 秒尝试实际产出只有 6.074 秒。
- 后续禁止继续盲目加时长生成。下一次真实 F5 必须先确认：每段 URL 能持久化、合并失败会失败而非假成功、任务中心能回看已生成片段，然后再从 10 秒或 30 秒继续阶梯测试。
- 本轮真实调用已产生供应商视频生成费用；后续除非再次明确授权，不继续发起计费视频任务。

## 2026-06-17 S1 项目级制作模型

自动化已从 F 类工程补课切换到 S 类结构化产品改造。本轮选择 S1，不再只验证“能生成分镜任务”，而是把 dry-run 结果升级为可追踪的制作项目模型。

### 参考项目落地点

| 参考 | 借鉴的结构能力 | 落到绘影的位置 |
| --- | --- | --- |
| ViMAX | 创意进入多阶段生产链，而不是停留在单次提示词输出 | `productionProject.stages` 固化为创意/剧本、资产、分镜、任务、片段合成、成片/导出 |
| Toonflow-app | 剧本、角色、分镜、视频片段应作为可见节点资产被组织和复用 | `productionProject.assets` 和 `graph` 把 script、character、scene、prop、storyboard、task、deliverable 变成可追踪资产 |
| ArcReel | 小说/剧本到分镜到任务队列需要工程化中间产物，失败后可以回看当前阶段 | `/api/production/dry-run` 把项目结构写入任务结果，任务中心可回看阶段、资产和镜头队列 |

### 改造内容

| 文件 | 改动 | 结构化价值 |
| --- | --- | --- |
| `src/lib/production-project.ts` | 新增 `ProductionProject` 构建器，输出资产、阶段、图关系、镜头队列和下一步 | 建立项目级制作模型，避免剧本、角色、分镜、任务散落在不同工具 |
| `src/app/api/production/dry-run/route.ts` | dry-run 返回并持久化 `productionProject`，原 `flow` 由项目阶段派生 | 后端 API 从“分镜脚本”升级为“项目生产结构” |
| `src/types/task.ts` | `TaskResult` 增加 `productionProject` 类型 | 前后端任务契约显式携带制作项目 |
| `src/components/task-center.tsx` | 任务卡片显示制作项目摘要，结果弹窗显示阶段、资产和镜头队列 | 用户能在任务中心理解项目状态和下一步，不只是看到一条完成任务 |
| `scripts/qa-production-flow.mjs` | 增加资产类型、阶段、镜头数和任务结果中的项目结构断言 | S1 改造具备可复跑验证，不靠人工判断 |

### 验证结果

| 验证项 | 方法 | 结果 | 证据 |
| --- | --- | --- | --- |
| 类型检查 | `pnpm run ts-check` | 通过 | `tsc -p tsconfig.json` 无错误 |
| S1 接口回归 | `pnpm run qa:flow` | 通过 | dry-run 返回 `productionProjectId`，包含 `script/character/scene/storyboard/task/deliverable`，`stageCount=6` |
| 浏览器任务中心 | 打开 `http://localhost:5000/`，创建 60 秒 dry-run 后进入任务中心 | 通过 | 任务卡片显示 `6 个阶段 · 6 个资产 · 6 个镜头` |
| 浏览器结果弹窗 | 点击任务中心的 `打开结果` | 通过 | 弹窗显示 `制作项目结构`、`项目资产`、`镜头队列`，且列出 6 个阶段和前 4 个镜头 |
| 探针清理 | 浏览器验证前备份 `/tmp/dreambox-tasks/tasks.json`，验证后恢复 | 通过 | 临时 dry-run 任务未污染用户原任务文件 |

### 当前结论

- 绘影已经从“工具集合 + 分镜任务”前进到“项目级制作模型”的第一版。
- S1 只完成了后端项目结构和任务中心回看，还没有把该项目模型贯通到 `smart` 导演链路、`node-editor` 画布和真实视频生成链路。
- 1 分钟以上真实成片能力仍未通过；当前真实结论仍是 Ark 5 秒可用，61 秒最终成片失败且实际下载文件只有 6.074 秒。

## 2026-06-17 S2 绘影精灵导演链路

本轮从工程化补课切到结构化产品改造。审计结论：绘影最初能力和当前框架已经有聊天、分镜、影视创作、任务中心和 S1 项目模型，但 `smart` 仍然像“快捷工具集合”，没有把导演、编剧、制片、镜头设计的中间产物稳定交给项目资产和任务中心。

### 参考项目落地点

| 参考 | 借鉴的结构能力 | 落到绘影的位置 |
| --- | --- | --- |
| ViMAX | 多 Agent 创作链路：导演定调、编剧拆镜、制片控资产、镜头生成协作 | `src/lib/smart-director-chain.ts` 输出 `director/screenwriter/producer/cinematographer` 四类结构化 Agent 产物 |
| Toonflow-app | 节点/资产不是一次性文本，而是后续可复用的制作资产 | 导演链结果同时写入 `productionProject.assets/stages/storyboard`，后续可接画布资产工作台 |
| ArcReel | 剧本到分镜到任务队列必须有工程化中间状态，失败后可回看 | `/api/smart/director-chain` 创建 `storyboard` 任务，结果持久化 `directorChain + productionProject + shots` |

### 改造内容

| 文件 | 改动 | 结构化价值 |
| --- | --- | --- |
| `src/lib/smart-director-chain.ts` | 新增导演链构建器，四个 Agent 输出决策、结构化 output、交接信息和质量门 | 把绘影精灵从普通助手升级为短片制作协作链 |
| `src/app/api/smart/director-chain/route.ts` | 新增 dry-run 导演链 API，复用分镜生成和 S1 项目模型，并写入任务中心 | 前端、任务和项目模型形成可验证闭环，不调用真实模型 |
| `src/types/task.ts`、`src/lib/task-manager.ts` | 显式增加 `TaskResult.directorChain` 类型 | 前后端任务契约不再靠隐式字段 |
| `src/components/smart-assistant-panel.tsx` | 快捷工具增加“导演链路”，在精灵内生成四 Agent 摘要并给出任务 ID、资产数、镜头数 | 用户不用跳页也能得到结构化导演链，并能去任务中心回看 |
| `scripts/qa-smart-director-chain.mjs`、`package.json` | 新增 `pnpm run qa:director` | 可复跑验证四 Agent、任务详情、项目资产和任务列表 |

### 验证口径

- 本链路是结构化 dry-run，不使用真实 API Key，不产生费用。
- `pnpm run ts-check` 通过。
- `pnpm run qa:director` 通过：返回 4 个 Agent，任务详情包含 `workflow=smart-director-chain`、`directorChain.agents.length=4`、`productionProject.storyboard.totalDuration=60`，并在探针结束后恢复任务文件。
- `pnpm run qa:flow` 通过：S1 项目级制作模型未被 S2 破坏。
- 浏览器点击验证通过：进入 `smart` 绘影精灵页面，点击“导演链路”后页面显示“导演链路已建档”、任务 ID、项目资产和镜头计划；验证后恢复任务文件，并通过“新对话”清理主界面测试消息。
- 真实视频能力结论不因 S2 改变：Ark 5 秒已通过；61 秒最终成片仍未通过，之前下载文件实际只有 6.074 秒。
- 下一步应把 S2 产物接入 S3 画布节点或 S4 剧本到成片链路，而不是继续只修工程脚本。
## 2026-06-17 S3 画布资产导入基线

- 当前目标：参考 Toonflow-app，把绘影已有的项目级资产和导演链路导入 `/node-editor`，让画布成为短片制作流的资产工作台，而不是孤立节点编辑器。
- 改前基线：
  - `/node-editor` 只有空白画布、手动添加节点、从视频生成表单导入两个节点。
  - `productionProject` 已有项目、角色、场景、道具、分镜、任务、成片资产，但没有可视化进入画布。
  - `directorChain` 已有导演/编剧/制片/镜头设计结构化输出，但停留在任务结果和绘影精灵里。
- 改后验证目标：
  - `/api/node-editor/production-canvas` 可从任务中心读取 `productionProject` 和 `directorChain`，返回画布节点/边。
  - `/node-editor` 可点击“从绘影项目导入”，导入 script、agent、character、scene、storyboard、video 节点。
  - `pnpm run qa:canvas` 必须验证节点类型、边数量、分镜时长、无真实 key、无费用、探针任务恢复。

## 2026-06-17 S4 片段任务计划基线

- 当前目标：参考 ArcReel，把绘影的剧本/分镜从“可视资产”推进到“可执行、可恢复的片段任务计划”。
- 改前基线：
  - `productionProject.storyboard.shots` 能表示 60 秒分镜，但没有独立的片段生成队列计划。
  - 分段视频恢复已有底层 `segments` 结果契约，但未和项目级分镜资产连接。
  - `/node-editor` 的视频节点只能表示成片入口，不能携带片段任务计划。
- 改后验证目标：
  - `/api/production/assembly-plan` 从任务中心读取 `productionProject` 并生成 `assemblyPlan`。
  - `assemblyPlan.segments` 和分镜镜头一一对应，初始状态为 `queued`，不伪造 `videoUrl`。
  - 任务结果持久化 `assemblyPlan`，后续失败恢复和真实视频生成能复用。
  - `/api/node-editor/production-canvas` 的视频节点携带 `assemblyPlan` 摘要。
  - `pnpm run qa:assembly` 必须验证无真实 key、无费用、探针任务恢复。

## 2026-06-17 Q1/Q3 短剧内容质量基线

- 当前目标：先不追求更长视频，优先解决“能生成但内容无意义”的问题，让短片具备角色目标、冲突、转折和结尾钩子。
- 改前基线：
  - `productionProject` 已经能追踪项目、资产、阶段和分镜，但缺少统一的故事圣经。
  - `directorChain` 有导演/编剧/制片/镜头设计四个 Agent，但主要围绕资产和任务，没有强制绑定冲突和情绪弧线。
  - `assemblyPlan.segments[].prompt` 直接复用镜头 prompt，真实生成时容易退化成炫技画面或抽象胶片，而不是服务剧情。
- 改造落点：
  - `src/lib/production-project.ts` 新增 `storyBible`，包含 premise、protagonist、desire、obstacle、conflict、turningPoint、endingHook、emotionalArc、continuityRules 和 beats。
  - 每个 storyboard shot 绑定 `storyBeat`、`dramaticPurpose`、`emotionShift`。
  - `src/lib/smart-director-chain.ts` 的四 Agent 输出读取 storyBible，导演负责冲突和情绪弧线，编剧负责剧情节点，制片负责连续性，镜头设计负责每镜头服务 storyBeat。
  - `src/lib/production-assembly-plan.ts` 的分段 prompt 增加“短剧前提、角色动机、当前冲突、剧情目的、情绪变化、连续性规则、镜头执行”。
  - 新增 `pnpm run qa:short-drama`，用一个便利店录像带短剧 prompt 验证 storyBible、shot story metadata 和 story-aware segment prompt。
- 验证口径：
  - 本轮是无费用结构化质量门禁，不调用真实模型。
  - 通过后只能说明短剧生成链路具备剧情约束，不代表最终视频审美已达标；后续真实 10s/30s 应优先使用这种 story-aware prompt 生成样片。

## 2026-06-18 P6 真实 30 秒 story-aware 短剧验证

本轮在 `trailerBeatSheet + segmentBridgePlan` 增强后，执行真实 Ark 30 秒短剧验证。目标不是继续证明抽象时长，而是检查“最后一班列车”这种简单预告片脚本，在真实视频中是否能看见人物、场景、关键道具和动作因果。

### 测试输入

- 预设：`last-train`
- 目标时长：30 秒
- 风格：现实灾难悬疑预告片
- 视觉锚点：暴雨车站、年轻急救员、红色书包、旧桥警报屏、最后一班列车
- 关键 prompt 契约：短剧前提、主角、角色动机、当前冲突、中段转折、结尾钩子、核心资产、预告片结构参考、分段镜头计划、观众必须看见、动作因果、入点状态、出点状态、桥接动作、剪辑衔接、跨段衔接硬要求、道具状态

### 真实结果

| 项 | 结果 |
| --- | --- |
| 真实视频任务 | `ced6dc11-d288-4607-b681-c3abeb4d1093` |
| 导演链任务 | `21e6f858-b4dd-4f13-9afc-2ecb96e52a34` |
| 状态 | completed |
| 轮询耗时 | 254 秒 |
| 片段数 | 3 |
| 本地文件 | `artifacts/huiying-story-aware-30s-ced6dc11-d288-4607-b681-c3abeb4d1093.mp4` |
| 文件大小 | 42,638,721 bytes |
| 实际时长 | 30.174 秒 |
| 关键帧 contact sheet | `artifacts/huiying-story-aware-30s-ced6dc11-frames/contact.jpg` |
| 首页/素材链路 | `/api/production/case-assets` 首个案例为该任务 `finalVideo`，时长标签 `00:30` |

### 验证命令

- `node scripts/qa-story-aware-video-gate.mjs` 通过，真实调用 Ark，产生费用。
- `node scripts/check-video-duration.mjs artifacts/huiying-story-aware-30s-ced6dc11-d288-4607-b681-c3abeb4d1093.mp4` 解析实际时长 `30.174`。
- `pnpm run qa:production-case-assets` 通过：`firstCaseId=ced6dc11-d288-4607-b681-c3abeb4d1093:final-video`，`firstSource=productionProject.assets.finalVideo`。
- 敏感扫描未发现真实 Ark key 形态落入 `src/scripts/docs/README/.env.example/package.json`。

### 观感复盘

- 明显进步：关键帧能看见地铁/车站、急救员、红色书包、报警屏、奔跑和对讲机，故事锚点比早期“抽象宇宙胶片/纯氛围画面”更可读。
- 仍有风险：故事主线能看出“急救员 + 红包/书包 + 警报 + 奔跑”，但“最后一班列车驶向旧桥、孩子在车上”的因果还主要依赖文字 prompt，画面里不一定足够直观。
- 下一步：把 `lastFrameUrl` 或抽帧图作为下一段生成参考输入，进一步强化列车/旧桥/孩子三个视觉锚点；同时把 Toonflow 式分镜可编辑回写接到真实重生成，让用户能点选某段重写“必须出现列车/旧桥/孩子”。

## 2026-06-18 P5 段落尾帧 handoff 与任务中心新鲜度修复

- 背景：上一轮真实 30 秒样片证明角色/道具/场景锚点可见，但段落之间的直接衔接仍弱。继续烧真实生成前，先把上一段 `lastFrameUrl` 变成下一段真实可用的 `firstFrameUrl` 输入契约。
- 改动：
  - `ProductionSegmentPlan` 新增 `expectedInputs.firstFrameUrl/previousLastFrameUrl/sourceSegmentId/sourceAssetId/continuityPrompt`。
  - `applySegmentAssetWriteback` 在片段成功且有 `lastFrameUrl` 时，把尾帧写入下一段 `expectedInputs`，失败片段不传播、不创建假视频资产。
  - `/api/production/assembly-plan/segment/start` 真实启动时把 `segment.expectedInputs.firstFrameUrl` 传给 BYOK `firstFrameImage`。
  - `/api/tasks/[taskId]` 的单任务 GET 改为 `getTaskFresh`，避免任务中心刚启动片段后读到空 stage/message。
- 验证：
  - `pnpm run ts-check` 通过。
  - `pnpm run qa:segment-assets` 通过，新增检查 `completed segment writes last frame into next segment firstFrameUrl`。
  - `pnpm run qa:assembly` 通过：60s、6 segments、bridgeCount=6、canvasNodeCount=19、leakedProbeTasks=0。
  - `pnpm run qa:canvas` 串行复跑通过：nodeCount=19、edgeCount=32、storyReadabilityScore=100。
  - `pnpm run qa:segment-start` 通过：dry-run 子任务 stage=`片段启动前检查通过`；缺模型失败正确回写父级 segment。
  - `pnpm run qa:production-case-assets` 通过：首页/素材案例仍以真实 `finalVideo/videoSegment` 资产为来源。
  - `pnpm run qa:open-source-demo-parity` 通过：ViMAX/Toonflow-app/ArcReel 三条 demo 对齐路径仍可运行。
  - Ark key 形态扫描通过，未在 `src/scripts/docs/README.md/.env.example/package.json` 发现真实密钥。
- 费用：本轮未新增真实视频生成，未产生新费用；沿用上一轮真实 30 秒任务 `ced6dc11-d288-4607-b681-c3abeb4d1093` 作为视觉问题基线。
- 剩余风险：下一轮需要用低成本真实 2-3 段复测，确认 Ark 供应商实际接受 `first_frame` 图像输入后，段落衔接是否比上一轮更稳。

## 2026-06-18 P6 真实分段 handoff 门禁与对象存储阻塞

- 目标：用 2 段低成本真实 production assembly 验证第 1 段 `lastFrameUrl` 能写入第 2 段 `expectedInputs.firstFrameUrl`，并被 `/api/production/assembly-plan/segment/start` 传给 Ark `firstFrameImage`。
- 新增：
  - `src/lib/video-frame-extraction.ts` 支持本地 ffmpeg 抽尾帧并上传对象存储，解决第三方抽帧服务访问 Ark 临时视频 URL 403 的问题。
  - `/api/video/extract-last-frame` 在 SDK 抽帧失败时尝试本地 ffmpeg + S3Storage 兜底。
  - `scripts/qa-real-segment-handoff.mjs` / `pnpm run qa:real-segment-handoff`：真实创建 2 段 production assembly 队列，先生成第 1 段，断言第 2 段拿到首帧参考后再生成第 2 段。
- 真实测试结果：
  - 第一次运行 `pnpm run qa:real-segment-handoff` 已真实启动第 1 段，产生费用；父任务 `4ea33d1e-29ab-4f62-8c23-35bd7fa2bfef`，第 1 段子任务 `f99cae49-e98d-4e2d-ba8e-f6367aa2f168` completed，供应商任务 `cgt-20260618212218-p94m6`。
  - 失败点：第 1 段有 `videoUrl/providerTaskId`，但没有 `lastFrameUrl`；第 2 段仍 queued，没有 `firstFrameUrl`，脚本停止，没有继续启动第 2 段。
  - 直接复现 `/api/video/extract-last-frame`：第三方帧提取服务访问 Ark 临时 TOS URL 返回 HTTP 403。
  - 接入本地 ffmpeg 兜底后继续复现：本地抽帧能进入上传阶段，但当前环境缺少 `HUIYING_OBJECT_STORAGE_ENDPOINT_URL`，无法把尾帧变成供应商可访问图片 URL。
- 防浪费修复：
  - `qa:real-segment-handoff` 现在会在缺少 `HUIYING_OBJECT_STORAGE_ENDPOINT_URL`、`HUIYING_OBJECT_STORAGE_BUCKET_NAME`、`HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID` 或 `HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY` 时提交视频前停止。
  - 复跑结果：`usedRealKey=false`、`incurredCost=false`、错误为“缺少 HUIYING_OBJECT_STORAGE_ENDPOINT_URL, HUIYING_OBJECT_STORAGE_BUCKET_NAME, HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID, HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY”。
- 发布契约：
  - `.env.example` 和 README 已说明真实分段 handoff 需要公网对象存储；没有对象存储时，只能验证队列/资产写回，不能宣称真实首帧连续生成闭环完成。

## 2026-06-18 P8 真实分段 handoff readiness 产品化

- 背景：上一轮已经证明真实第 1 段可以生成，但尾帧抽取/上传缺对象存储时会导致第 2 段无法拿到首帧参考。如果这个状态只藏在 QA 脚本里，用户和部署者会误以为 60s+ 多段连续性已经可用。
- 改动：
  - 新增 `src/lib/runtime-readiness.ts`，只负责读取配置存在性并输出能力状态，不输出任何密钥值。
  - `GET /api/health` 新增 `runtimeReadiness.objectStorage` 和 `runtimeReadiness.realSegmentHandoff`，让设置页、部署检查和自动化都能提前知道真实 handoff 是否可用。
  - 新增 `pnpm run qa:production-readiness`，无费用检查 `/api/health` readiness 契约，并断言响应不泄露 Ark/Bearer 形态密钥。
  - `qa:real-segment-handoff` 的提交前门禁扩展为四项对象存储变量，避免缺上传凭证时才在真实第 1 段完成后失败。
- 验收意义：
  - ArcReel 对齐：分段队列不再只看任务 completed，而是把“上一段尾帧能否成为下一段首帧”提升为可检查发布条件。
  - Toonflow-app 对齐：对象存储 readiness 是素材资产可复用的前置条件，缺失时不能把视频片段节点标成可连续复用。
  - ViMAX 对齐：导演链的连续性约束有了运行时门禁，避免 artifact 写得很完整但真实生成无法执行。
