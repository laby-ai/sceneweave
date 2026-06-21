# 绘影工作室功能保全清单

本清单用于约束后续产品化优化：可以重组信息架构、合并重复入口、统一黑色视觉和交互文案，但不能为了对标竞品而删除绘影已有能力。

## 保留原则

- 功能以绘影工作室现有产品能力为准，竞品只作为可读性、层级和交互节奏参考。
- 首页可以做成更聚合的创作工作台，但必须能进入所有核心能力。
- 重复功能优先合并为下拉、分组或快捷入口；只有确认无后端/前端调用链路且确实重复时才移除。
- 每轮自动化优化先检查本清单和真实页面入口，再做视觉或交互改动。

## 当前入口矩阵

| 能力 | 当前入口 | 代码证据 | 保全要求 |
| --- | --- | --- | --- |
| 首页创作工作台 | `home` | `src/app/DreamboxHome.tsx` 的 `activeSection === 'home'` | 保留聚合输入、作品预览、工具箱、优秀作品参考。 |
| AI 视频生成 | `video` | `VideoGenerationForm` / `activeSection === 'video'` | 保留提示词、参考素材、历史作品与生成链路。 |
| 图片生成 | `image` | `ImageCreationPanel` / 首页快捷入口 | 保留文生图、参考图、风格参考和图片历史。 |
| 绘影精灵/智能助手 | `smart` | `SmartAssistantPanel` / `activeSection === 'smart'` | 保留剧本、分镜、提示词协作和转入生成的能力。 |
| 图文/素材创作 | `media` | `ImageGenerationForm`、小红书/微信/抖音组件、素材入口 | 保留图文资产、平台化内容和素材管理入口。 |
| 影视创作 | `film` | `FilmCreationPanel` / `activeSection === 'film'` | 保留长流程影视创作、分镜与成片管理。 |
| 任务中心 | `tasks` | `TaskCenter` / `/api/tasks` | 保留任务状态、生成结果、打开/复用/重新生成。 |
| 工作流画布 | `/node-editor` | `src/app/node-editor/page.tsx` 使用 `reactflow` | 保留节点编排、工作流保存、导出到视频生成表单。 |
| 平台研究 | `/research` | `navItemDefs` 外链式入口 | 保留研究页入口，不应被首页视觉改造隐藏。 |
| 设置与 BYOK | `settings` | `dreambox-api-connection` localStorage 与 `/api/provider/test` | 保留 API Base、API Key、模型名、连接测试、清除配置。 |

## 自动化验收要点

- 启动服务后人工式点击或脚本点击至少覆盖：首页、AI 视频、图片生成、绘影精灵、资产/图文、影视创作、任务中心、设置、工作流画布。
- 设置页必须能看到并填写 `API Base`、`API Key`，且连接测试走 `/api/provider/test`。
- 视觉优化后不得出现“官方主体”等竞品化命名；首页文案应使用绘影自己的“工具箱、资产、剧本灵感、项目资产库”等表达。
- 如果本轮只做视觉统一，仍需说明未覆盖的深层页面和剩余旧样式风险。
