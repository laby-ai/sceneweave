# 创作智能体完整迁移上下文（2026-07-21）

> 本文用于把当前开发会话迁移给下一位维护者或新的 Codex 会话。它记录产品决策、稳定主链、已吸收的开源能力、正式发布状态、质量证据和下一步工作。本文不包含 API Key、Cookie、Token、私有用户数据或临时签名媒体 URL。

## 1. 一句话结论

当前产品不是一套新建的 AIGC Demo，而是在 SceneWeave 原有成熟 ViMAX 短剧生成链上持续补强的“创作智能体”。正式短剧默认执行已经升级为：

1. 规划模型产生剧本、资产、分镜和连续性约束；
2. Qwen Image 2.0 根据批准资产、当前分镜和上一镜尾帧编译每个镜头的 canonical 首帧；
3. 所有镜头统一交给 HappyHorse 1.1 I2V；
4. 逐镜任务、provider task ID、状态、结果 URL 和 artifact version 立即持久化；
5. 最后按当前 artifact version 合成、质检、播放和下载。

原有 R2V 路线没有删除，保留为显式兼容或人工选择路线；默认自动执行不再让规划模型在 I2V/R2V 之间随机选择。

## 2. 不可漂移的产品决策

### 2.1 产品定位

- `paper-web` 的宿主导航可以继续叫“科教”。
- 进入 SceneWeave 后，用户只看到“创作智能体”或“创作工作台”。
- 页面内部不以“科教、教学、课堂”为产品定位。
- 行业场景由 Skill 承接：短剧、电商、广告、艺术、图像、视频、分镜等。
- 当前第一优先级是专业短剧生产，不是继续扩张更多行业按钮。

### 2.2 交互与视觉

- 浅色、留白、轻边框和结果流参考即梦的视觉语言，但不复制品牌或私有资产。
- 首页结构参考 LibTV Agent：中央复合输入器、快捷 Skill、最近项目网格。
- 不设置左侧历史栏；项目历史放在首页下方。
- 进入项目后保持绘影/即梦式对话任务流。
- 不采用拖拉拽节点作为主要创作流程。
- 百炼连接入口放在右上角；对话框下方不再放 API Host、Key 或模型选择。

### 2.3 实现边界

唯一稳定运行主链是：

```text
src/components/generate/generate-workspace.tsx
  -> src/lib/skills/vimax-short-drama/use-vimax-short-drama-skill.ts
  -> src/app/api/smart/vimax-agent-step/route.ts
  -> productionPlan / project / task / asset / storyboard / segment / assembly / export
```

约束：

- ViMAX 是成熟内核，默认不删、不重写、不回退已经通过的行为。
- 新能力必须复用同一 SceneWeave runtime、同一项目状态和既有 route/module。
- 禁止第二套运行时、通用 `/api/skills/execute`、旁路 Demo、独立 Harness 产品或节点拖拽主流程。
- 保持 KnowTrail、guest/workspace 隔离、`postMessage`、`hideVirtualClassroom` 和返回平台契约。
- 用户界面不得泄漏 ViMAX、OpenMontage、Toonflow、ArcReel、LibTV 等内部来源名。

## 3. 当前 Git 与正式发布基线

### 3.1 GitHub

- Repository: `https://github.com/laby-ai/sceneweave`
- 工作分支：`codex/vimax-skill-release-20260717`
- 分支基线：`origin/codex/sync-huiying-prod-20260629`
- 当前分支相对基线：116 个 runtime/迭代提交；加入本文档提交后为 117 个，基线没有额外提交。
- 当前 runtime HEAD：`7b4397cc4d05b4b825856c02f5f62615f447b692`
- 最新提交：`feat(creation): compile canonical frames for i2v`

### 3.2 正式域

- 正式入口：`http://ucas.sitianai.com/sceneweave/`
- 创作工作台：`/sceneweave/embed/creation-agent`
- current release：`sceneweave-creation-canonical-i2v-20260721-012846`
- previous release：`sceneweave-creation-bailian-strict-20260720-230159`
- current commit：`7b4397cc4d05b4b825856c02f5f62615f447b692`
- manifest：`dirty=false`
- `/sceneweave/`、embed、health：正式验证均为 HTTP 200。
- systemd 服务 active；切换后服务日志没有 4xx/5xx 或 error 记录。

正式发布采用 standby 候选实例、健康检查、manifest 校验、软链接原子切换和自动回滚。生产 release 根目录是 `/opt/sceneweave`；任何新会话都应先读取现场 current/previous/manifest，再相信本文的时间点状态。

## 4. 当前前端能力

### 4.1 无历史侧栏首页

`generate-workspace.tsx` 已成为正式创作智能体页面，由 `dreambox-main-content.tsx` 加载：

- 浅色通用 AIGC 首页；
- 中央复合输入器；
- Skill、主体、附件、生成参数入口；
- 最近项目网格；
- 新建、重开、重命名、两步删除；
- 最近更新时间排序；
- guest/workspace 隔离；
- 项目页不显示左侧历史栏。

### 4.2 项目与结果流

- 新建项目 -> 返回首页 -> 从项目卡重开 -> 刷新恢复；
- 多项目切换不串会话；
- 增量阶段通过 SSE 展示；
- 取消、失败和重试不会覆盖最后成功结果；
- 已完成结果可以“继续编辑/再生成”，旧成功版本继续保留；
- 最后成功结果可播放、下载和导出剪辑草稿；
- 计划、分镜、参考素材、分段视频、合成结果使用同一项目上下文。

### 4.3 百炼模型设置

当前界面只支持阿里云百炼连接：

- API Base 固定在应用内，不让用户填写；
- 用户只填写 API Key，不要求业务空间 ID；默认使用百炼公共域名，旧 workspace 配置继续兼容；
- 登录成员的 Key 由账号服务按 tenant/member 加密保存，读取接口只返回掩码；
- Key 不进入 prompt、项目状态、日志、截图、文档或 Git；
- Base URL 默认为中国公共 DashScope，规划模型固定 `qwen3.7-plus`；旧 `workspace_id` 不再影响模型或请求端点；
- 图像固定 `qwen-image-3.0-pro`，通过百炼原生 multimodal-generation 接口生成或编辑；
- 视频默认固定 `happyhorse-1.1-i2v`；
- 不允许静默降级到其他模型；
- 连接验证失败不会覆盖之前的有效连接；
- 规划失败必须在视频付费调用前 fail-closed，并保留输入和项目。

任何曾在聊天中明文出现的 Key 都应视为已暴露并轮换，禁止从聊天记录复制进仓库。

## 5. 当前后端与生产能力

### 5.1 权威 production plan

服务端按 `skillId` 权威解析预设、能力和执行顺序，忽略客户端伪造的 capability IDs、scene type、style 或 operation order。

`productionPlan` 已覆盖：

- preset/Skill 语义；
- 模型、比例、分辨率；
- 素材清单与资产版本；
- readiness 和 provider capability；
- 成本边界与用户决定；
- human checkpoint、暂停和恢复；
- stage dependency；
- artifact version；
- last successful result；
- render/export 交付锁。

### 5.2 资产与分镜

- 角色、场景、道具资产可以加载、编辑并通过既有 PATCH route 写回；
- 修改刷新后保持；
- 失败编辑不覆盖最后成功版本；
- 资产存在父版本、派生版本、批准版本和 shot 绑定；
- 指定镜头只使用其批准的资产版本；
- `artStyle`、`directorManual` 和服务端权威模型/模式贯穿 reference/video payload；
- 主体注册表支持角色参考、视图与项目隔离；
- 多候选首帧和首帧选择器已经进入稳定链；
- camera tree 和 transition/continuity 信息写回 storyboard。

既有写回 API：

```text
/api/production/projects/[taskId]/assets/[assetId]
/api/production/projects/[taskId]/storyboard/[shotId]
```

### 5.3 分段生产与恢复

- storyboard segment 保存 `previousShotId`、dependency group/index 和 artifact version；
- queue 按依赖顺序推进；
- worker 原子领取任务；
- provider task ID 在任务创建后立即持久化；
- provider status、video URL、tail frame 和错误状态随转移更新；
- 服务重启后按已知 provider task ID 恢复，不重新生成；
- 孤儿任务可以恢复；
- 失败镜头单独重试，不重跑成功镜头；
- 取消后迟到事件不能覆盖当前任务；
- 当前版本可以 assembly，并输出剪辑草稿。

### 5.4 会话与交付

- task SSE 支持 `afterSeq` 增量恢复与去重；
- 项目切换重置/隔离事件 cursor；
- 刷新只恢复当前 workspace + project；
- 批量交付只包含 artifact version 匹配的 last successful result；
- pending、failed、cancelled、stale 结果不能覆盖最后成功结果；
- 异 guest/workspace 结果不可见；
- 长视频提交快速返回稳定 background task ID，避免 Nginx 同步超时；
- 最终视频存储、播放、下载和剪辑草稿复用既有 final-video/assembly/export 能力。

### 5.5 当前 canonical-I2V 默认路线

核心文件：

```text
src/lib/skills/vimax-short-drama/vimax-canonical-first-frame.ts
src/lib/skills/vimax-short-drama/vimax-shot-generation-route.ts
src/lib/production-segment-start.ts
src/lib/production-assembly-plan.ts
src/lib/byok-client.ts
src/lib/skills/vimax-short-drama/vimax-generation-preferences.ts
```

默认行为：

1. 第一个镜头以主体、场景、道具、shot reference 和 production plan continuity 生成 canonical 首帧；
2. 后续镜头再加入上一镜最后成功尾帧；
3. canonical 首帧使用既有 `imageWithBYOK` 和 `qwen-image-3.0-pro` 生成；
4. 首帧状态保存 version、status、artifactVersion、image URL、来源尾帧、来源参考图、模型、完成时间或错误；
5. 缺上一镜尾帧、缺批准参考图、artifact version 过期或来源变化时，视频提交前阻断；
6. 所有自动镜头 route 为 `first-frame`，模型为 `happyhorse-1.1-i2v`；
7. 显式 `legacy-dual-route` 仍可执行原 R2V/I2V 兼容逻辑。

这解决了旧“双路由由规划模型选择”的不稳定性：连续性工程固定在 canonical 首帧编译器，视频模型只负责 I2V。

## 6. 五个开源项目的真实吸收情况

研究树均保留完整 Git 历史和 origin，位于 SceneWeave 同级的 `work/open-source-video-research/`。外部仓库只用于源码研究，不承载 SceneWeave 业务修改。

| 项目 | 研究 SHA | License | 在本系统中的角色 | 已落地能力 |
| --- | --- | --- | --- | --- |
| HKUDS/ViMax | `0cf9f71f668ea7ca44e6bcf3fdf7ca7432adee49` | MIT | 唯一原生成熟内核 | script-to-video、角色注册、参考图、多候选首帧选择、camera tree、连续性与生成主链 |
| OpenMontage | `af87fc1337254ec1978e6333b5acbbb5ffb9a3d0` | AGPL-3.0 | 行为契约参考，净室实现 | pipeline director、provider readiness、成本、checkpoint/edit decision、artifact version、render QA、交付锁 |
| Toonflow-app | `bc61ec7a1b5df31293b286981a5f4ad4635464ee` | Apache-2.0 | 可模块化资产生产参考 | shot 资产绑定、角色/场景/道具派生版本、批准版本、制作方向和 PATCH 后影响后续 payload |
| ArcReel | `014464113afb0a1841f444deeeffbccced2fab6a` | AGPL-3.0 | 行为契约参考，净室实现 | previous-shot dependency、queue/worker、恢复、失败镜单重试、assembly 和剪辑草稿导出 |
| LibTV Skills | `c609246c1eca69f6bc129bcbb5d64c36734e4a4a` | MIT | 项目会话和交付契约参考 | create/query/change-project、afterSeq 增量事件、项目 cursor 隔离、批量最后成功结果交付 |

许可证边界：

- MIT/Apache-2.0 项目可以在保留归属与许可证声明的前提下提取或改写模块；
- OpenMontage 与 ArcReel 为 AGPL-3.0，当前没有把其源码直接复制进生产；只根据公开契约和状态机在现有 SceneWeave 接口上净室实现；
- 不复制外部品牌、私有网页实现、账号数据、媒体资产或密钥。

## 7. 能力包与创作预设

内部已经标准化五个能力包，它们不是五套后端，也不是五个前台品牌按钮：

1. `director-artifacts`：计划、参考素材和视频主链；
2. `project-asset-workbench`：项目资产、分镜编辑与写回；
3. `segmented-production`：分段队列、失败段重试与导出；
4. `production-governance`：readiness、成本、checkpoint、render 锁；
5. `session-delivery`：项目会话、SSE、取消/重试、上传/下载。

六个用户预设共享同一运行时：短剧、电商商品片、品牌概念片、艺术实验影像、游戏实机 PV、分镜导演。服务端按 `skillId` 权威组合能力；纯分镜预设不得进入视频阶段，媒体预设保留 provider 和费用门禁。

当前应继续优先做短剧全链，不要再把能力拆成更多静态注册表或小卡片。

## 8. 关键运行状态与安全边界

### 8.1 已验证

- canonical 路由 fixture：三镜全部 `first-frame`；
- 默认视频模型：三镜全部 `happyhorse-1.1-i2v`；
- canonical 首帧 fixture：image provider stub 1 次、video provider 0 次、费用 0；
- `pnpm ts-check` 通过；
- 改动文件 ESLint 通过；
- architecture guard 与 spaghetti growth guard 通过；
- `/sceneweave` production build 通过；
- 正式 standby、embed、health、原子切换与回滚指针通过；
- 1440px 正式页面加载中央输入器、快捷 Skill 和最近项目。

### 8.2 不应误报为当前回归的既有债务

- 全仓 lint 仍有约 425 个旧错误，集中在历史 iCanvas/film 模块；当前改动没有混修这些债务。
- 某个旧 multisegment fixture 在 segment retry 后仍有 boundary bridge readiness 断点；它不是 canonical-I2V 变更引入，但后续完整真实短剧回归应覆盖该边界。

### 8.3 外部条件

- 对象存储配置曾缺少 `HUIYING_OBJECT_STORAGE_*`；不要在配置无变化时重复探针。
- 生产已有 public-frame handoff 和 base64 handoff，健康检查报告 real segment handoff ready。
- final video store 和 subject store ready。
- 任何真实图像/视频调用都可能产生费用，自动化和 CI 不得调用真实 provider。
- 真实 provider task ID 和结果 URL 必须即时持久化，不能再只保存在进程内。

## 9. 关键代码导航

### 页面与宿主

```text
src/components/generate/generate-workspace.tsx
src/components/home/dreambox-main-content.tsx
src/components/generate/bailian-connection-control.tsx
src/components/generate/planning-connection-control.tsx
src/components/generate/vimax-production-plan-card.tsx
```

### ViMAX Skill 与规划

```text
src/lib/skills/vimax-short-drama/use-vimax-short-drama-skill.ts
src/app/api/smart/vimax-agent-step/route.ts
src/lib/skills/vimax-short-drama/vimax-agent-contract.ts
src/lib/skills/vimax-short-drama/vimax-production-plan.ts
src/lib/skills/vimax-short-drama/vimax-production-governance.ts
src/lib/skills/vimax-short-drama/vimax-skill-presets.ts
src/lib/skills/vimax-short-drama/vimax-skill-runtime-binding.ts
```

### 连续性、参考图与路由

```text
src/lib/skills/vimax-short-drama/vimax-continuity-contract.ts
src/lib/skills/vimax-short-drama/vimax-canonical-stage-input.ts
src/lib/skills/vimax-short-drama/vimax-canonical-first-frame.ts
src/lib/skills/vimax-short-drama/vimax-first-frame-selector.ts
src/lib/skills/vimax-short-drama/vimax-camera-tree.ts
src/lib/skills/vimax-short-drama/vimax-reference-assets.ts
src/lib/skills/vimax-short-drama/vimax-video-reference-assets.ts
src/lib/skills/vimax-short-drama/vimax-shot-generation-route.ts
src/lib/skills/vimax-short-drama/happyhorse-vimax-video.ts
src/lib/skills/vimax-short-drama/happyhorse-r2v-reference-manifest.ts
```

### 项目、资产、分段与交付

```text
src/lib/production-project.ts
src/lib/production-asset-writeback.ts
src/lib/production-storyboard-writeback.ts
src/lib/production-segment-start.ts
src/lib/production-segment-retry.ts
src/lib/production-segment-provider-recovery.ts
src/lib/production-segment-tail-recovery.ts
src/lib/production-assembly-plan.ts
src/lib/production-assembly-queue.ts
src/lib/final-videos/member-final-video-store.ts
src/app/api/tasks/[taskId]/events/route.ts
src/app/api/final-videos/[id]/route.ts
```

### 核心无付费 QA

```text
scripts/qa-vimax-canonical-first-frame.ts
scripts/qa-vimax-shot-generation-route.ts
scripts/test-vimax-bailian-connection.ts
scripts/test-vimax-generation-preferences.ts
scripts/qa-production-segment-start-service.ts
scripts/qa-production-segment-provider-recovery.ts
scripts/qa-production-segment-tail-recovery-service.ts
scripts/qa-production-assembly-plan.mjs
scripts/qa-member-final-video-e2e.mjs
scripts/test-paper-host-creation-agent.ts
```

## 10. 下一会话的执行顺序

### P0：重新核验现场，不从旧摘要盲目开工

1. 读取 Git branch/status/HEAD、origin 和相对默认分支提交范围；
2. 读取正式 current/previous/release-manifest、health 和 embed；
3. 确认工作树中的 `outputs/` 仍是未跟踪测试产物，不清理、不提交；
4. 确认没有任何 Key、签名 URL 或用户媒体进入 diff。

### P1：canonical-I2V 真实短剧集成验收

只有用户当轮再次明确授权费用并提供有效连接时才执行：

```text
新建短剧
-> K3/Qwen 规划
-> productionPlan 确认与费用决定
-> 批准角色/场景/道具版本
-> 编辑分镜并刷新恢复
-> 每镜编译 canonical 首帧
-> HappyHorse I2V 严格串行生成
-> provider task ID 立即持久化
-> SSE 进度、取消/失败镜单重试、重启恢复
-> 当前 artifactVersion assembly
-> render QA
-> 正式页面播放、刷新、最后成功下载和剪辑草稿
```

验收重点不是单镜审美，而是：

- 身份与服饰一致；
- 场景和道具状态连续；
- 上一镜动作终态与下一镜动作起态衔接；
- 空间方向、景别节奏、色调光线一致；
- 声音/画面切点和叙事因果成立；
- 输入约束在刷新、失败和重试后不丢失；
- assembly 使用正确 artifact version。

### P2：只修真实断点

如果真实链失败，优先按以下层级定位：

1. canonical 首帧是否成功且引用正确资产版本；
2. 上一镜 `lastFrame` 是否来自最后成功结果；
3. I2V payload 是否只携带批准的 canonical 首帧；
4. provider task ID 是否在返回后立即落盘；
5. 重试是否只作用于失败镜；
6. assembly 是否拒绝 stale/pending/failed 或 artifact version 不匹配结果；
7. 项目/guest/workspace 是否隔离。

禁止退回到改文案、加卡片、扩注册表或重新制造第二套 runtime。

## 11. 反漂移循环规则

- 每轮先看上一轮最后一个真实 runtime commit/release 和现场 current/previous。
- 一次只保留一个 WIP。
- 完成必须同时具备：运行代码 diff、实际既有 route/module、无付费 fixture 或正式完整用户路径。
- 测试数、文档、HTTP 200、PARTIAL 和 DONE-NO-CODE 不算主要进展。
- 同一细节最多一轮，同一能力最多两轮；没有用户能力增量时必须升维到完整路径或跨模块工作流。
- 每四轮至少关闭两个用户可见路径，其中一个必须从输入到交付。
- 微视觉和文案最多占一轮的 20%，除非直接阻断主路径。
- provider、付费、对象存储、外部推送和不可逆操作只阻塞对应验收；记录后立即转无付费主线。

## 12. 新会话可直接使用的启动提示

```text
先阅读 docs/handoffs/creation-agent-context-20260721.md，并以现场 Git、正式 current/previous/manifest 和 health 为准覆盖旧时间点信息。

产品是 SceneWeave 内置“创作智能体”，ViMAX 是稳定内核，不删、不重写、不另建运行时。唯一主链是 generate-workspace.tsx -> use-vimax-short-drama-skill.ts -> /api/smart/vimax-agent-step -> productionPlan/project/task/asset/storyboard/segment/assembly/export。

当前默认视频策略是 canonical-I2V：Qwen Image 2.0 用批准资产、分镜约束和上一镜尾帧编译每镜 canonical 首帧，所有镜头固定 HappyHorse 1.1 I2V；R2V 仅保留显式 legacy 兼容。HappyHorse 1.1 单段时长按官方契约限制为 3 至 15 秒。规划模型负责剧本和连续性，不选择视频路由。严禁静默降级。

先跑无付费 canonical/route/segment/recovery/assembly QA。只有用户在当前轮明确授权费用且有效百炼连接通过后，才能运行一次有界真实短剧全链。provider task ID、status、video URL、artifactVersion 和 lastSuccessfulResult 必须即时持久化；pending/error/cancel/stale 不得覆盖最后成功结果。

继续工作的第一目标是 canonical-I2V 真实短剧集成验收，只修整链暴露的真实断点。不要回到卡片、字段、文案、注册表或旁路 Demo。
```

## 13. 安全清单

- [ ] 不提交 `outputs/`。
- [ ] 不提交 API Key、Cookie、Token、`.env.production`、签名 URL 或用户媒体。
- [ ] 不从聊天记录复制 Key；明文出现过的 Key 应轮换。
- [ ] 不自动执行付费生成。
- [ ] 不删除用户未跟踪产物。
- [ ] 不使用 `reset --hard`、`checkout --`、`clean`、force push、rebase 或历史重写。
- [ ] 发布前检查 manifest `dirty=false`，候选健康、正式 1440px、console/API、刷新和 guest 隔离。
- [ ] 保留 previous release 和自动回滚路径。
