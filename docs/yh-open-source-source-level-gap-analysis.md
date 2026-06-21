# 绘影开源参考源码级对照与改造路线

更新时间：2026-06-17

本文件记录本轮重新下载并源码级阅读 ViMax、Toonflow-app、ArcReel 后，对绘影当前实现的对照结论。目的不是继续泛泛说“参考了开源项目”，而是明确：参考项目的哪个结构能力，已经落到绘影哪里，缺口是什么，下一步应该改什么。

## 参考源码状态

| 项目 | 本地路径 | 获取方式 | 当前版本证据 | 本轮重点阅读 |
| --- | --- | --- | --- | --- |
| ViMax | `references/_git-clones/ViMax` | `git clone --depth 1` | commit `0672b78`，2026-06-13 | `pipelines/idea2video_pipeline.py`、`pipelines/script2video_pipeline.py`、`agent_runtime/loop.py` |
| Toonflow-app | `references/_git-clones/Toonflow-app` | GitHub `master` zip fallback | remote sha `af1d1cbf2e8a`，2026-06-15 | `src/agents/scriptAgent/index.ts`、`src/agents/productionAgent/index.ts`、`src/routes/project/addProject.ts`、storyboard/assets routes |
| ArcReel | `references/_git-clones/ArcReel` | GitHub `main` zip fallback | remote sha `03d497bf826a`，2026-06-16 | `server/services/generation_tasks.py`、`server/services/jianying_draft_service.py`、`server/routers/tasks.py`、provider/assets routes |

说明：Toonflow-app 和 ArcReel 的 git clone 失败后使用 zip fallback，但内容来自 GitHub 远端指定分支快照，不再依赖之前缺少 `.git` 的旧参考目录。

## 一句话判断

绘影相比最初版本已经完成了工程化和结构化雏形：`productionProject`、`storyBible`、`directorChain`、`productionCanvas`、`assemblyPlan`、分段队列、任务中心回看与恢复入口已经出现。

但它距离三个参考项目仍有一个核心差距：现在更像“由单次任务派生出一组结构化结果”，还不是“以项目为中心的可编辑制作系统”。下一阶段要把当前 JSON/任务结果，升级成项目资产、导演链、画布节点、片段队列和导出包之间的稳定数据流。

## ViMax 对照：多 Agent 创作链路

### ViMax 源码能力

ViMax 的 `Idea2VideoPipeline` 不是直接拿 prompt 生成视频，而是先产出可复用中间产物：

- `story.txt`：创意扩写后的故事。
- `characters.json`：角色抽取结果。
- `character_portraits_registry.json`：角色多视角肖像资产。
- `script.json`：剧本结构。
- scene/shot 级脚本继续交给 `Script2VideoPipeline` 渲染。

`Script2VideoPipeline` 进一步把文本规划与渲染拆开：角色、分镜、镜头视觉描述、camera tree、首尾帧、shot/frame 状态事件都在生成前后被显式记录。

`agent_runtime/loop.py` 则说明 ViMax 不是普通聊天助手：它有 prompt trace、tool call、tool result、status event、context compaction 和 session turn record。

### 绘影已落地点

| ViMax 能力 | 绘影当前落点 | 当前状态 |
| --- | --- | --- |
| 创意先转故事/剧本产物 | `src/lib/production-project.ts` 的 `ProductionStoryBible` | 已有 premise、protagonist、desire、conflict、turningPoint、endingHook、emotionalArc、beats |
| 多 Agent 协作 | `src/lib/smart-director-chain.ts` | 已拆为导演、编剧、制片、镜头设计，但仍是确定性函数，不是真正 agent loop |
| 角色/场景/道具资产化 | `productionProject.assets` | 已有 asset kind/status/metadata，但大多是 planned 资产 |
| 镜头绑定剧情目的 | `storyboard.shots[].storyBeat/dramaticPurpose/emotionShift` | 已落地，可用于后续 prompt |
| 渲染前产物规划 | `src/lib/production-assembly-plan.ts` | 已有 story-aware segment prompt 和分段计划 |

### 仍缺什么

1. 缺真正可执行的 agent loop：目前 `smart-director-chain.ts` 是规则拼装，不会调用工具、不会修订、不会保存每轮推理事件。
2. 缺角色一致性资产注册表：ViMax 的 front/side/back 肖像和 registry 是角色连续性的核心，绘影还没有持久化角色参考图/首尾帧库。
3. 缺 planning/rendering 的强分离：绘影已有 plan，但真实生成路径还没有要求每段先消费已确认的角色、场景、道具资产。

### 下一步改造

优先把 `directorChain` 从“展示用四 Agent 文案”升级为“可执行制作计划”：

- 给每个 agent 增加 `artifactId`、`status`、`inputAssetIds`、`outputAssetIds`、`revisionNotes`。
- 角色资产新增 `referenceImages.front/side/back`、`visualConsistencyPrompt`。
- 视频 segment prompt 必须引用角色/场景/道具资产 ID，而不是只拼一段自然语言。

## Toonflow-app 对照：画布资产工作台

### Toonflow-app 源码能力

Toonflow-app 的核心不是单个生成接口，而是项目工作台：

- `src/routes/project/addProject.ts` 创建项目时保存 `projectType/name/intro/artStyle/directorManual/videoRatio/imageModel/videoModel/imageQuality/mode`。
- `scriptAgent` 有 story skeleton、adaptation strategy、script、supervision 等子 agent，并带 memory。
- `productionAgent` 有 derive assets、generate assets、director plan、storyboard generation、storyboard panel/table、supervision 子 agent。
- 生产阶段输出 `<scriptPlan>`、`<storyboardTable>`、`<storyboardItem ...>`，并通过 routes 写入项目数据。

### 绘影已落地点

| Toonflow-app 能力 | 绘影当前落点 | 当前状态 |
| --- | --- | --- |
| 项目级信息 | `ProductionProject` | 已有 title/prompt/style/ratio/duration/storyBible/assets/stages/graph/storyboard/output |
| 画布节点资产 | `src/lib/production-canvas.ts`、`/api/node-editor/production-canvas` | 已可从任务结果生成 script/storyboard/image/video/audio/camera/character/scene/agent 节点 |
| 生产技能拆分 | `smart-director-chain.ts` | 已有角色拆分，但没有 skill/tool/memory |
| 分镜工作台 | `ProductionProject.storyboard` + task center | 有数据，但不是可编辑、可分页、可复用的数据库工作台 |

### 仍缺什么

1. 缺项目数据库/持久工作台：Toonflow 的项目、资产、剧本、分镜是可持续编辑的数据；绘影目前多来自一次任务结果。
2. 缺 `artStyle/directorManual/model/mode` 对生成链路的强约束：绘影有 style，但没有像 Toonflow 那样贯穿项目、agent、资产、分镜。
3. 缺画布反向写回：当前画布是 `buildProductionCanvas()` 生成的展示结构，用户不能在画布上修改节点并写回 productionProject。

### 下一步改造

优先做“项目工作台最小闭环”：

- 新增项目级 API：`/api/production/projects`、`/api/production/projects/[id]/assets`、`/api/production/projects/[id]/storyboard`。
- `productionCanvas` 节点增加 `sourceAssetId` 和 `editableFields`，为后续画布编辑写回准备。
- 设置项目级 `artStyle`、`directorManual`、`imageModel`、`videoModel`，让 agent 和 segment prompt 都读取同一份配置。

## ArcReel 对照：剧本到成片任务工程链路

### ArcReel 源码能力

ArcReel 的强项在后端工程链路：

- `generation_tasks.py` 有 provider resolver、backend cache、custom provider、ARK/GEMINI/GROK/KLING/OPENAI/VIDU 等供应商分发。
- 任务执行会读取项目、payload、model、capability，失败原因由 resolver/backend 透传。
- storyboard sequence 支持 previous storyboard reference，服务于镜头连续性。
- `jianying_draft_service.py` 能把完成的视频片段、字幕、音频、转场收集为剪映草稿 ZIP，并处理路径安全和坏数据跳过。

### 绘影已落地点

| ArcReel 能力 | 绘影当前落点 | 当前状态 |
| --- | --- | --- |
| BYOK/供应商配置 | `src/lib/byok-provider.ts`、settings/BYOK、Ark API route | 已能配置和真实调用 Ark；历史已做 5s 和 60s 验证 |
| 分段任务计划 | `src/lib/production-assembly-plan.ts` | 已能生成 assemblyPlan.segments |
| 子任务队列 | `/api/production/assembly-plan/queue`、`segment/start`、`segment/retry` | 已有子任务排队、启动、重试雏形 |
| 任务中心回看 | `src/components/task-center.tsx` | 已显示 assemblyPlan、segment 状态、失败恢复按钮 |
| 合成 | `/api/video/merge`、`local-video-merge.ts` | 已有本地合成路径，但仍需真实长短剧稳定验证 |

### 仍缺什么

1. 缺 provider registry 级别的抽象：绘影当前以 Ark/BYOK 为主，供应商能力、模型能力、时长上限、费用风险还没形成统一表。
2. 缺真正 worker/DB 队列：现在任务仍以本地任务文件为主，容易受多 Node/dev 进程和 QA 并发影响。
3. 缺剪映/导出包：ArcReel 已经有 draft ZIP，绘影目前只到视频合成和结果复用，还未形成可交付剪辑工程。
4. 缺片段成功资产库：成功片段 URL 应进入素材/首页案例/画布节点，而不是只留在任务结果里。

### 下一步改造

优先围绕 60s+ 短剧做工程闭环：

- 真实生成不要先追求更长，先用 10s/30s 片段验证短剧情节质量，再合成 60s+。
- 每个 segment 成功后立即写入 `assets.videoSegment`，并在任务中心、画布、首页案例三处可见。
- 合成失败时保留每段结果，不允许把第一段伪装成成片。
- 增加导出计划：先生成 `cut-draft-json`，再考虑剪映 ZIP。

## 绘影相比最初版本已经优化了什么

| 方向 | 当前优化 |
| --- | --- |
| 从工具集合到项目雏形 | 新增 `ProductionProject`、`storyBible`、资产、阶段、graph、storyboard、output |
| 从普通 prompt 到短剧结构 | `storyBible` 已覆盖主角、欲望、阻碍、冲突、转折、结尾钩子、情绪弧线 |
| 从普通助手到导演链 | `smart-director-chain.ts` 已拆为导演/编剧/制片/镜头设计四角色 |
| 从单视频任务到分段计划 | `assemblyPlan` 已按 storyboard 生成 segment，含 prompt、duration、recovery |
| 从结果孤岛到画布展示 | `productionCanvas` 可展示脚本、分镜、角色、场景、视频片段和 agent 节点 |
| 从无反馈到任务中心 | task center 已能看到 assemblyPlan、segment 队列、失败原因和恢复入口 |
| 从假能力到真实测试 | 已做 Ark 5s、60s 相关真实验证和 61s 失败复盘，后续要继续以真实产物为准 |

## 当前最大结构性不足

1. **项目不够持久**：生产项目更多是任务结果，不是用户可长期编辑的制作工程。
2. **Agent 不够真实**：导演链没有 tool loop、memory、revision、supervision，仍偏规则引擎。
3. **资产不可复用**：角色图、场景图、道具图、成功片段没有统一资产库和引用关系。
4. **画布不可编辑**：节点可看但不能作为真正制作台写回后端。
5. **60s+ 成片质量不稳定**：已有长时长验证背景，但短剧内容质量、片段一致性、合成可回看还要继续打磨。
6. **导出交付不足**：缺剪辑工程或标准导出包，尚未达到 ArcReel 的交付完整度。

## 后续改造优先级

### P0：先保证 60s+ 短剧真实闭环

参考 ArcReel 的队列恢复和 ViMax 的剧情产物分层，完成：

1. 用 `storyBible` 生成 6-8 个有剧情推进的 segments。
2. 每段真实生成后写回父任务 `assemblyPlan.segments[index].videoUrl`。
3. 每段同步写入项目资产库和画布节点。
4. 合成后解析实际媒体时长，失败则保留成功片段并给出重试入口。
5. 首页画廊只展示真实生成过的片段/成片，不放重复假画布。

### P1：把画布变成制作台

参考 Toonflow-app：

1. 建立项目级 assets/storyboard API。
2. 画布节点支持编辑字段和写回。
3. 角色、场景、道具、分镜、视频片段之间的引用关系持久化。

### P2：把导演链变成可执行 Agent 工作流

参考 ViMax：

1. 每个 Agent 输出独立 artifact。
2. 加入 revision/supervision 状态。
3. 角色一致性资产和首尾帧作为工具输入。
4. Agent 事件进入 SSE/任务中心，而不是只返回一次性 JSON。

### P3：导出交付

参考 ArcReel：

1. 先输出 `cut-draft-json`。
2. 再输出剪映/通用剪辑工程 ZIP。
3. 导出包包含视频、字幕、镜头表、资产引用和失败片段说明。

## 本轮结论

后续自动化或人工迭代不应再只说“参考 ViMax/Toonflow/ArcReel”。每轮必须落在以下格式：

```text
参考项目能力 -> 绘影模块 -> 代码/接口/页面改造 -> 真实验证证据
```

下一步最具体建议：选择 P0，跑一个“有剧情的 60s+ 短剧”闭环。先不追更长，先保证每段有剧情目的、每段可回看、合成产物实际时长达标，成功片段能进入首页案例和画布资产。
