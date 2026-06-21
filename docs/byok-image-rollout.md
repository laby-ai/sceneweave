# 绘影工作室图片 BYOK 覆盖与放开顺序

数据日期：2026-06-16  
目标：在不删除现有能力、不误触发高成本批量任务的前提下，把用户填写的 `API Base` / `API Key` 逐步接入图片生成链路。

## 本轮质量门

- 当前目录 `work/project/projects` 不是 git 仓库，不能用 `git diff` 作为审计依据；本轮用文件内容、命令输出和浏览器入口验证作为证据。
- 已读取 `docs/product-function-retention.md` 和 `docs/yh-v1-reference-mapping.md`；后续仍必须保留 `home`、`video`、`image`、`smart`、`media`、`film`、`tasks`、`/node-editor`、`/research`、`settings/BYOK`。
- 上一轮已完成 `/api/image/generate` 的请求级 BYOK 最小适配，并用 dummy Ark key 验证命中 `images/generations` 认证错误路径；未使用真实密钥，未产生费用。

## 当前已接入

| 层级 | 文件 | 状态 | 说明 |
| --- | --- | --- | --- |
| 后端 provider | `src/lib/byok-provider.ts` | 已接入 | `imageWithBYOK` 走 OpenAI 兼容 `images/generations`。 |
| 服务适配层 | `src/lib/ai-service-adapter.ts` | 已接入 | `generateImage` 检测到 BYOK 后优先调用用户供应商，失败不静默回退默认服务。 |
| 图片 API | `src/app/api/image/generate/route.ts` | 已接入 | 同步和后台任务均读取请求头中的 BYOK 配置。 |
| 图片主入口 | `src/components/image-creation-panel.tsx` | 已接入 | 主要图像创作请求带 `getBYOKRequestHeaders()`。 |
| 图文图片表单 | `src/components/image-generation-form.tsx` | 已接入 | 图文/素材侧的直接图片请求带 `getBYOKRequestHeaders()`。 |
| 批量素材生成 | `src/components/asset-workshop.tsx` | 已接入并加确认 | 资产工坊会按选中资产循环生成参考图，已在触发前显示预计张数与 BYOK 额度提示。 |
| 单张设计变体/控制台图片 | `src/components/image-annotation-viewer.tsx`、`src/components/generation-console.tsx` | 已接入 | 覆盖用户主动触发、生成张数明确的 P1 图片入口。 |
| 平台图文封面/配图 | `src/components/xiaohongshu-generation.tsx`、`src/components/wechat-generation.tsx` | 已接入 | 只在用户未上传图片时生成 1 张，并在进度文案中显示预计张数。 |
| 绘影精灵导演工作流 | `src/components/smart-assistant-panel.tsx` | 部分接入 | 确认分镜后批量生成角色、场景、分镜图前会提示预计张数，并携带 BYOK 请求头。 |
| 绘影精灵确认卡/调整图 | `src/components/smart-assistant-panel.tsx` | 已接入 | 多待生成项确认卡会提示预计张数；确认卡与调整图请求携带 BYOK 请求头，并使用统一供应商错误文案。 |
| 绘影精灵自动内联分镜 | `src/components/smart-assistant-panel.tsx` | 已接入 | 自动规划后最多 6 张分镜图会先提示预计张数，图片请求携带 BYOK 请求头，失败时回显供应商错误。 |

## 待接入调用点分级

| 优先级 | 调用点 | 代表文件 | 放开建议 | 原因 |
| --- | --- | --- | --- | --- |
| P2 | 绘影精灵手动资产生成 | `src/components/smart-assistant-panel.tsx` | 核心生图分支已接入，后续只做回归巡检 | 已覆盖确认分镜、确认卡、调整图和自动内联分镜生成；后续重点转向短视频/画布/影视创作批量入口。 |
| P2 | 快速视频/短视频前置图 | `src/components/ai-video-creation-panel.tsx`、`src/components/short-video-panel.tsx` | 需先加成本确认 | 可能按脚本帧数循环生成多张，是短剧链路核心但成本不低。 |
| P3 | 影视创作批量分镜 | `src/components/film-creation-panel.tsx` | 必须先做任务队列和费用提示 | 有起始帧、结束帧、九宫格、桥接帧、角色图、场景图等批量调用，最容易误消耗用户额度。 |
| P3 | 工作流画布节点生成 | `src/app/node-editor/page.tsx` | 必须先做节点级任务状态和费用提示 | Toonflow 参考价值高，但画布节点可能链式触发，应该和任务中心绑定后再放开。 |
| P3 | 后端内部转发 | `src/app/api/film/generate-assets/route.ts`、`src/app/api/smart/skill-call/route.ts` | 暂缓 | 服务端内部调用目前不会天然携带浏览器 localStorage，需先设计项目级/请求级密钥传递边界。 |

## 放开规则

1. 直接入口优先：只接入用户主动点击、生成张数明确、失败能在当前页面展示的调用点。
2. 批量入口后置：涉及分镜循环、九宫格、首尾帧、节点链式触发的入口，必须先显示预计张数并经过用户确认；资产工坊已通过 `confirmImageGenerationPlan` 接入此规则。
3. 任务中心绑定：超过 1 张图片的生成应进入 `tasks`，记录状态、失败原因、重试入口和结果复用路径。
4. BYOK 失败不降级：用户显式填写 API Key 后，失败应提示用户配置问题，不应自动改用平台默认服务；已接入图片入口统一使用 `formatProviderError` 展示供应商配置错误。
5. 不记录密钥：日志、文档、最终回复和任务记录不得写入真实 API Key。

## 下一轮建议切片

1. 为 `src/components/ai-video-creation-panel.tsx` 和 `src/components/short-video-panel.tsx` 的短视频前置配图加预计张数确认、BYOK 请求头和错误展示。
2. 为 P3 影视创作和画布批量入口设计“预计生成张数 + 费用确认 + 进入任务中心”轻量组件。
3. 设计项目级 BYOK 传递边界，再处理服务端内部转发入口。
