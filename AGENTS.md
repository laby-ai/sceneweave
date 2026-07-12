# 项目上下文

## 项目简介
绘影工作室 — AI 创作平台，提供视频生成、AI短视频、图片生成、数字人、图文创作、字幕编辑等功能。

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **主题**: 双色主题（默认亮色 + 可选暗色），主色 #EF4444（赤焰红/Red）

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── page.tsx        # 首页（挂载 DreamboxHome）
│   │   ├── DreamboxHome.tsx # 主页面组件（侧边栏+多Section切换+全屏模块）
│   │   ├── Providers.tsx   # Context Providers 聚合
│   │   ├── api/            # API 路由
│   │   ├── node-editor/    # 节点编辑器页面
│   │   ├── subtitle-chat/  # 绘影精灵对话页
│   │   ├── subtitle-editor/ # 字幕编辑器页面
│   │   ├── templates/      # 模板页面
│   │   ├── social/         # 社交发布页面
│   │   ├── profile/        # 个人设置页面
│   │   └── skills/         # 技能页面
│   ├── components/         # 业务组件
│   │   ├── ui/             # Shadcn UI 组件库
│   │   ├── avatar/         # 数字人相关组件
│   │   ├── generation-console/ # 生成控制台子组件
│   │   ├── film-creation-panel.tsx  # 影视创作三栏面板(BigBanana关键帧驱动/九宫格构图/衣橱系统/提示词管理/网格工作台)
│   │   ├── image-creation-panel.tsx # AI图像创作三栏面板
│   │   ├── smart-assistant-panel.tsx # 绘影精灵三栏面板
│   │   ├── short-video-panel.tsx # AI短视频三栏面板(Pixelle风格)
│   │   ├── task-progress-card.tsx   # 任务监测进度卡片
│   │   └── ...             # 其他业务组件
│   ├── contexts/           # React Context（Theme/Auth/Language/Template/Community/Task）
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库与业务逻辑
│   │   ├── video-production/ # 视频生产引擎(v3.2)
│   │   ├── video-monitor/    # AI视频监测系统
│   │   ├── video-generation-pipeline.ts # 视频生成管线(T2I2V/MotionScore/OscillationGuidance)
│   │   ├── ai-service-adapter.ts # AI服务统一适配器（BYOK）
│   │   ├── provider-api.ts   # Ark/OpenAI-compatible 文本与多模态封装
│   │   ├── minimax-client.ts # Minimax API客户端（全能力）
│   │   ├── model-router.ts   # 模型路由与降级链配置
│   │   └── ...               # 其他工具库
│   ├── constants/          # 常量定义
│   ├── types/              # TypeScript 类型定义
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 核心页面结构

### DreamboxHome 主页面
- 左侧可折叠导航栏（8个主要入口：首页/视频/绘影精灵/节点编辑器/数字人/图文/任务中心/平台研究/设置）
- 顶部 72px 导航条
- 内容区按 activeSection 切换不同功能模块
- 底部创作控制台含4个Tab入口：AI视频(inline，含专业视频+AI短视频双模式)/AI图像(全屏)/绘影精灵(全屏)/影视创作(全屏，左侧面板含创作流程+资产工坊双模式)

### 全屏三栏模块（点击Tab后跳转，含返回按钮）
- **影视创作** (FilmCreationPanel): 左-服务配置/中-可编辑输出/右-对话助手
  - **左侧面板统一**: 故事文本输入+资产卡片(角色橙/场景蓝/镜头绿)+类型筛选+批量生图+折叠式服务配置+智能增强按钮
  - **BigBanana关键帧驱动流程**: 起始帧→结束帧→插值视频的三阶段链路
  - **九宫格构图选择**: 9候选视角选择最佳构图作为首帧
  - **网格工作台视图**: 全景网格管理所有镜头(缩略图+状态指示+悬停操作)
  - **关键帧视图**: 详细展示每个镜头的起始帧/结束帧/视频+状态机
  - **衣橱系统**: 角色多套造型管理，切换造型自动注入后续镜头
  - **提示词管理中心**: 集中检索/编辑/版本回滚所有实体提示词
- **AI图像创作** (ImageCreationPanel): 左-模型风格尺寸/中-图片画廊/右-对话助手
- **绘影精灵** (SmartAssistantPanel): 左-工具历史/中-对话区/右-参考素材
- **AI短视频**: 已合并至AI视频面板，通过"专业视频/AI短视频"模式切换

### 任务中心（双视图）
- 列表视图(TaskCenter) + 监控视图(TaskProgressCard)
- 监控视图展示实时进度/状态机/暂停恢复/重试机制

### 平台研究页面（/research）
- AIGC长视频平台TOP排名与能力矩阵（7大平台含Open-Sora 2.0）
- 6大商业平台详细对比(Kling/Seedance/Veo3/Runway/Luma/Vidu)
- Open-Sora 2.0 开源架构解析(T2I2V管线/VBench评测/成本分析/6大核心创新)
- Wan 2.1 人物一致性体系(FLF2V首尾帧管线/VACE全能模型/4层一致性防线/剪辑合成管线)
- 生产管线5步流程可视化
- 人物一致性6种方法论(视觉锚点/FLF2V/Grid Prompt/参考图链/穿搭锁定/一致性校验)
- 最佳实践参数推荐

### 主要 API 路由
- `/api/tasks` - 任务管理（含监测数据/配置快照/操作日志）
- `/api/video/*` - 视频生成相关
- `/api/video/consistency-check` - 人物一致性校验(网格提示词/锚点生成/模式选择/提示词扩展)
- `/api/video/plot-analysis` - 剧情剪辑分析(剧情拆分/字幕分析/过渡建议)
- `/api/video/compose` - 视频合成(FFmpeg参数/时间线预览/时长估算)
- `/api/prompt/video-refine` - 视频提示词精炼(T2V/I2V/T2I/Motion Score 4模式)
- `/api/film/creation-plan` - 创作规划生成(根据对话内容生成完整创作方案，含标题/风格/角色/场景/分镜)
- `/api/image/*` - 图片生成相关
- `/api/bgm/*` - 背景音乐相关
- `/api/subtitle/*` - 字幕相关
- `/api/storyboard/*` - 故事板相关
- `/api/film/auto-director` - 影视创作自动导演流水线(v3.2)
- `/api/film/bible` - 角色圣经/场景圣经/镜头表CRUD
- `/api/film/character-prompt` - LLM提取角色描述
- `/api/film/character-views` - 生成角色三视图
- `/api/film/scene-generate` - LLM提取场景+AI生成图
- `/api/film/prop-generate` - LLM提取道具+AI生成图
- `/api/film/chat` - SSE流式对话+参数抽取
- `/api/short-video/generate-script` - AI短视频文案生成(AI生成模式/固定文案模式/15+视觉风格预设)
- `/api/avatar/*` - 数字人相关
- `/api/prompt/enhance` - 通用提示词增强
- `/api/prompt/video-refine` - 视频提示词精炼(Open-Sora T2V/I2V/T2I三模式+Motion Score预测)

### 核心业务库
- `src/lib/video-production/` - 视频生产引擎(v3.3): 编剧/导演/调度/模型路由/提示词/质检/DAG/输出
- `src/lib/video-production/character-consistency-engine.ts` - 人物一致性引擎(v3.3): 视觉锚点/多场景变装/网格提示词生成器/FLF2V首尾帧/一致性校验/提示词扩展
- `src/lib/video-monitor/` - AI视频监测系统: 状态机/任务监测/内容安全/重试容错/错误处理/Outbox事件
- `src/lib/ai-service-adapter.ts` - AI服务统一适配器: 请求级 BYOK 文本与图像调用，缺配置时明确失败
- `src/lib/provider-api.ts` - Ark/OpenAI-compatible 文本与多模态调用封装
- `src/lib/minimax-client.ts` - Minimax API客户端: 视频生成(Video-01)、图像生成、LLM对话(abab6.5s)、TTS语音合成
- `src/lib/model-router.ts` - 模型路由配置: 4类服务(video/image/llm/tts)×3级降级链
- `src/lib/video-production/platform-capabilities.ts` - 7大平台能力矩阵(Kling/Seedance/Veo3/Runway/Luma/Open-Sora/Vidu): API参数/能力标签/价格/最佳实践/T2I2V管线/FLF2V管线/VACE能力/MotionScore/AestheticScore/Wan提示词扩展
- `src/lib/video-generation-pipeline.ts` - 视频生成管线架构: T2I2V两阶段管线/MotionScore运动评估/OscillationGuidance/分桶系统/管线编排
- `src/lib/video-production/character-consistency-engine.ts` - 人物一致性引擎: 4维锚点(面部/身形/发型/服装)/网格提示词生成器(3模式)/FLF2V首尾帧管线/一致性校验/提示词扩展(Wan2.1风格)
- `src/components/smart-assistant-panel.tsx` - 绘影精灵: 引导式5步创作流程(创意→角色→场景→分镜→生成)/创作参数自动提取/一键生成跳转/步骤进度条/创作规划侧边栏
- `src/components/short-video-panel.tsx` - AI短视频(Pixelle风格): 一键生成管线(文案→配图→语音→合成)/15+视觉风格预设(卡通/优雅/治愈/霓虹/复古等)/TTS语音配置/BGM选择/分镜预览/固定文案+AI生成双模式

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. 禁止使用 head 标签，优先使用 metadata
3. 三方 CSS、字体等资源可在 globals.css 中顶部通过 @import 引入或使用 next/font
4. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 shadcn/ui，位于 src/components/ui/ 目录下
- 项目采用双色主题（默认亮色 + 可选暗色），主色 #EF4444
- 亮色背景 #f5f5f7，暗色背景 #030712，通过 CSS 自定义变量 + `.dark` class 级联切换
- ColorModeContext 管理主题状态，默认亮色，localStorage 持久化
