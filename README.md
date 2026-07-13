# SceneWeave

SceneWeave is an AIGC short-film studio for story-aware segmented video generation, frame handoff, audio continuity, and recoverable production workflows.

它面向短剧、预告片和商业短片制作，把剧本、角色、场景、道具、分镜、尾帧承接、声音状态、任务恢复和成片交付收束到同一条可审计的制作链路。当前内部产品代号仍保留为“绘影”，仓库品牌与对外介绍使用 SceneWeave，便于后续归档到 `laby-ai/sceneweave`。

Suggested GitHub About:

- Description: `AIGC short-film studio for story-aware segmented video generation, frame handoff, audio continuity, and recoverable production workflows.`
- Topics: `aigc`, `ai-video`, `short-film`, `storyboard`, `video-generation`, `frame-handoff`, `seedance`, `nextjs`

这是一个基于 [Next.js 16](https://nextjs.org) + [shadcn/ui](https://ui.shadcn.com) 的全栈应用项目。

## 快速开始

## 产品化优化约束

- 修改 Film、Canvas、任务、provider、媒体或 compose 边界前，先阅读 [架构 owner 与依赖图](docs/architecture-ownership.md)。架构方向和既有大文件增长预算由 CI 强制检查。
- StoneAI 四个工程基础仓与产品边界见 [平台仓库地图](docs/platform-repositories.md)。
- 生产发布使用 [Linux 原子发布与回滚手册](docs/deployment-runbook.md)，候选不得携带环境密钥或 release-local 用户产物。
- 功能保全清单见 [docs/product-function-retention.md](docs/product-function-retention.md)。后续前端改版可以调整信息架构和视觉表达，但必须保留 AI 视频、图片生成、绘影精灵、图文/素材、影视创作、任务中心、工作流画布、研究页和设置/BYOK 等入口。
- 设置页提供用户自带密钥模式：用户填写 `API Base` / `API Key` / 默认模型后保存在当前浏览器，并通过 `/api/provider/test` 验证 OpenAI-compatible 服务。
- 长耗时生成必须进入任务系统，不允许按钮无限 loading。前端应优先使用 `GET /api/tasks/{taskId}/events` 读取任务事件流；不支持 SSE 时退回 `GET /api/tasks/{taskId}` 轮询。

### BYOK 与长任务发布契约

| 能力 | 接口/入口 | 发布要求 |
| --- | --- | --- |
| 供应商连接测试 | 设置页、`POST /api/provider/test` | API Key 不写入代码、文档或日志；`testMode=models` 只测模型列表，`testMode=chat` 发起 1 token 文本探针，`testMode=image` 发起最小图片生成探针；无 key、缺模型、非法 URL、内网 URL 都必须返回可读错误 |
| 任务列表 | `GET /api/tasks` | 返回 `cleanupCount`，打开任务中心时能恢复超时任务，不让历史任务永远运行中 |
| 单任务状态 | `GET /api/tasks/{taskId}` | 返回 `status`、`progress`、`stage`、`message`、`error/result`，用于轮询 fallback |
| 长任务事件流 | `GET /api/tasks/{taskId}/events` | 返回 `text/event-stream`，包含 `waitingHint`、`nextPollMs` 和 2 秒重连建议，用于 1 分钟以上视频任务的等待反馈 |
| 取消/重试 | `DELETE /api/tasks/{taskId}`、`POST /api/tasks/{taskId}` + `{ "action": "retry" }` | 生成中可取消，失败或取消后可复用配置重试 |

1 分钟以上视频生成必须先通过低成本阶梯验证：路由/dry-run -> 最小文本 -> 最小图片 -> 5s -> 10s -> 15s -> 30s -> 60s -> 60s+。未获得用户明确授权时，不运行可能产生视频费用的真实任务。

视频能力不能只看任务状态或请求里的 `duration` 字段，必须下载或探测结果文件并解析实际媒体时长。对本地或远程 mp4 可运行：

```bash
pnpm run qa:video-duration -- artifacts/huiying-ark-61s.mp4
```

BYOK 视频路由发布前应先运行无真实密钥探针：

```bash
pnpm run qa:video-byok
```

该命令使用 dummy key 验证 Ark Plan 路由、内网 API Base 拦截、缺少视频模型时的可读错误和任务文件恢复，不会调用真实供应商或产生费用。

真实分段连续性发布前应先运行上线 readiness 探针：

```bash
pnpm run qa:production-readiness
```

该命令读取 `GET /api/health`，只检查是否具备真实分段 handoff 所需的对象存储配置，不读取或输出密钥值，不调用供应商、不产生费用。`runtimeReadiness.realSegmentHandoff.ready=false` 时，绘影只能验证队列、资产写回和任务恢复，不能宣称多段视频画面连续性已闭环。

分段长视频发布前还应验证“合成失败不假成功、片段资产不丢”：

```bash
pnpm run qa:video-recovery
```

该命令只注入本地临时任务，不调用供应商；它会模拟已生成两个片段后合成失败，确认任务状态为 `failed`，同时 `result.segments` 仍保留可恢复的片段 URL。

真实 Ark 视频发布门控应使用顺序脚本，避免多个 QA 同时抢占任务文件锁：

```bash
pnpm run qa:real-video-gate
```

默认情况下，该命令只顺序运行 `qa:video-byok`、`qa:video-recovery` 和历史产物时长解析，不读取真实密钥、不调用供应商、不产生费用。若要执行真实 Ark 视频阶梯测试，必须通过私有环境变量显式提供：

需要提供的私有环境变量为 `HUIYING_REAL_ARK_API_BASE`、`HUIYING_REAL_ARK_API_KEY`、`HUIYING_REAL_ARK_VIDEO_MODEL`、`HUIYING_REAL_VIDEO_SECONDS`、`HUIYING_REAL_VIDEO_MAX_SECONDS` 和 `HUIYING_ALLOW_REAL_VIDEO_COST`。60s 回归还必须额外设置 `HUIYING_ALLOW_REAL_60S_REGRESSION=true`，并且先有 5s smoke、2 段 handoff 和对象存储 readiness 证据。请只在本机 shell、CI secret 或部署平台 secret 中设置真实值，然后运行：

```bash
pnpm run qa:real-video-gate
```

脚本会提交真实分段视频任务、轮询任务中心、下载结果 mp4，并用 `qa:video-duration` 解析实际媒体时长。`HUIYING_REAL_VIDEO_SECONDS` 应按 5 -> 10 -> 30 -> 60 -> 60+ 逐级推进；任一级失败就先修复任务状态、片段持久化或合成恢复，不继续加时长。不要把 API Key 写入 `.env.example`、README、代码、日志或自动化 prompt。

分段短剧连续性发布前还应验证“上一段尾帧能成为下一段首帧参考”：

```bash
pnpm run qa:real-segment-handoff
```

该命令会创建一个 2 段真实 production assembly 队列，先生成第 1 段，再断言第 1 段 `lastFrameUrl` 已写入第 2 段 `expectedInputs.firstFrameUrl`，最后才启动第 2 段。它会调用真实 Ark 视频模型并产生费用，必须同时配置 `HUIYING_REAL_ARK_API_BASE`、`HUIYING_REAL_ARK_API_KEY`、`HUIYING_REAL_ARK_VIDEO_MODEL`、`HUIYING_ALLOW_REAL_VIDEO_COST=true`。此外还必须提供一个供应商可访问的尾帧 URL 通道：推荐配置 `HUIYING_OBJECT_STORAGE_ENDPOINT_URL`、`HUIYING_OBJECT_STORAGE_BUCKET_NAME`、`HUIYING_OBJECT_STORAGE_ACCESS_KEY_ID` 和 `HUIYING_OBJECT_STORAGE_SECRET_ACCESS_KEY`；没有对象存储时，可配置 `HUIYING_PUBLIC_ASSET_BASE_URL`，让本地 ffmpeg 抽出的尾帧写入 `public/generated/frames` 并通过 HTTPS 公网地址回传。`localhost` 或内网地址不会被视为真实 handoff ready。

长任务发布前应先运行任务可靠性探针：

```bash
pnpm run qa:tasks
```

该命令会在本地任务文件中临时注入 `codex-f4-qa-*` 探针任务，验证任务列表、单任务详情、SSE 等待安抚、取消、重试和探针恢复；不会使用真实 API Key，也不会调用供应商产生费用。默认探测 `http://localhost:5000`，如需切换端点可设置 `HUIYING_BASE_URL`。

制作全流程发布前还应运行 dry-run 探针：

```bash
pnpm run qa:flow
```

该命令会请求 `POST /api/production/dry-run`，用本地分镜引擎把一个 60 秒短片创意拆成项目、视觉锚点、字幕/旁白、镜头列表，并写入任务中心成为可回看的 `storyboard` 任务；脚本结束后会恢复本地任务文件。该探针不使用真实 API Key、不调用供应商、不产生费用，用于验证“创意/剧本 -> 分镜/镜头 -> 任务中心”的最低闭环。

`qa:tasks` 和 `qa:flow` 都会临时改写本地任务文件，脚本内置 `.qa.lock` 互斥锁；发布检查时应顺序执行，不要并行运行。

### 启动开发服务器

```bash
pnpm dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

开发服务器支持热更新，修改代码后页面会自动刷新。

### 构建生产版本

```bash
pnpm build
```

### 启动生产服务器

```bash
pnpm start
```

## 项目结构

```
src/
├── app/                      # Next.js App Router 目录
│   ├── layout.tsx           # 根布局组件
│   ├── page.tsx             # 首页
│   ├── globals.css          # 全局样式（包含 shadcn 主题变量）
│   └── [route]/             # 其他路由页面
├── components/              # React 组件目录
│   └── ui/                  # shadcn/ui 基础组件（优先使用）
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
├── lib/                     # 工具函数库
│   └── utils.ts            # cn() 等工具函数
└── hooks/                   # 自定义 React Hooks（可选）

server/
├── index.ts                 # 自定义服务器入口
├── tsconfig.json           # Server TypeScript 配置
└── dist/                    # 编译输出目录（自动生成）
```

## 核心开发规范

### 1. 组件开发

**优先使用 shadcn/ui 基础组件**

本项目已预装完整的 shadcn/ui 组件库，位于 `src/components/ui/` 目录。开发时应优先使用这些组件作为基础：

```tsx
// ✅ 推荐：使用 shadcn 基础组件
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>标题</CardHeader>
      <CardContent>
        <Input placeholder="输入内容" />
        <Button>提交</Button>
      </CardContent>
    </Card>
  );
}
```

**可用的 shadcn 组件清单**

- 表单：`button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`
- 布局：`card`, `separator`, `tabs`, `accordion`, `collapsible`, `scroll-area`
- 反馈：`alert`, `alert-dialog`, `dialog`, `toast`, `sonner`, `progress`
- 导航：`dropdown-menu`, `menubar`, `navigation-menu`, `context-menu`
- 数据展示：`table`, `avatar`, `badge`, `hover-card`, `tooltip`, `popover`
- 其他：`calendar`, `command`, `carousel`, `resizable`, `sidebar`

详见 `src/components/ui/` 目录下的具体组件实现。

### 2. 路由开发

Next.js 使用文件系统路由，在 `src/app/` 目录下创建文件夹即可添加路由：

```bash
# 创建新路由 /about
src/app/about/page.tsx

# 创建动态路由 /posts/[id]
src/app/posts/[id]/page.tsx

# 创建路由组（不影响 URL）
src/app/(marketing)/about/page.tsx

# 创建 API 路由
src/app/api/users/route.ts
```

**页面组件示例**

```tsx
// src/app/about/page.tsx
import { Button } from '@/components/ui/button';

export const metadata = {
  title: '关于我们',
  description: '关于页面描述',
};

export default function AboutPage() {
  return (
    <div>
      <h1>关于我们</h1>
      <Button>了解更多</Button>
    </div>
  );
}
```

**动态路由示例**

```tsx
// src/app/posts/[id]/page.tsx
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <div>文章 ID: {id}</div>;
}
```

**API 路由示例**

```tsx
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}
```

### 3. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 4. 样式开发

**使用 Tailwind CSS v4**

本项目使用 Tailwind CSS v4 进行样式开发，并已配置 shadcn 主题变量。

```tsx
// 使用 Tailwind 类名
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">
  <Button className="bg-primary text-primary-foreground">
    主要按钮
  </Button>
</div>

// 使用 cn() 工具函数合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  className
)}>
  内容
</div>
```

**主题变量**

主题变量定义在 `src/app/globals.css` 中，支持亮色/暗色模式：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 表单开发

推荐使用 `react-hook-form` + `zod` 进行表单开发：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  email: z.string().email('请输入有效的邮箱'),
});

export default function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '', email: '' },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('username')} />
      <Input {...form.register('email')} />
      <Button type="submit">提交</Button>
    </form>
  );
}
```

### 6. 数据获取

**服务端组件（推荐）**

```tsx
// src/app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'no-store', // 或 'force-cache'
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

**客户端组件**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

## 常见开发场景

### 添加新页面

1. 在 `src/app/` 下创建文件夹和 `page.tsx`
2. 使用 shadcn 组件构建 UI
3. 根据需要添加 `layout.tsx` 和 `loading.tsx`

### 创建业务组件

1. 在 `src/components/` 下创建组件文件（非 UI 组件）
2. 优先组合使用 `src/components/ui/` 中的基础组件
3. 使用 TypeScript 定义 Props 类型

### 添加全局状态

推荐使用 React Context 或 Zustand：

```tsx
// src/lib/store.ts
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 集成数据库

推荐使用 Prisma 或 Drizzle ORM，在 `src/lib/db.ts` 中配置。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **字体**: Geist Sans & Geist Mono
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x

## 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [shadcn/ui 组件文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)

## 公网发布与 API 连接

### 本地运行

默认脚本是跨平台命令，Windows、macOS、Linux 均可直接运行：

```bash
pnpm install
pnpm run dev
```

默认监听 `http://localhost:5000`。如需改端口：

```bash
PORT=5001 pnpm run dev
```

Windows PowerShell 使用：

```powershell
$env:PORT="5001"; pnpm run dev
```

Linux 部署环境如需沿用原 shell 脚本，可使用 `pnpm run dev:sh`、`pnpm run start:sh`。

### 环境变量

复制 `.env.example` 为 `.env.local`，或在 Vercel、Docker、服务器面板中配置同名环境变量。生产环境至少需要：

- `HUIYING_PROJECT_DOMAIN_DEFAULT` / `INTERNAL_API_BASE`: 公网站点地址。
- `HUIYING_OBJECT_STORAGE_*`: 素材上传、生成结果持久化和分段视频尾帧 handoff 所需对象存储。

### 用户自带密钥

设置页新增“模型连接”模块，支持用户填写：

- 服务类型：OpenAI 兼容、火山 Ark。
- `API Base`：例如 `https://api.openai.com/v1`。
- `API Key`：用户自己的密钥。
- 默认文本模型、图片模型、视频模型：可选，但真实生成时必须填写对应能力的模型名。

火山 Ark 计划接口可按 OpenAI 兼容协议填写：

- `API Base`: `https://ark.cn-beijing.volces.com/api/v3`
- 文本模型示例：`ark-code-latest`
- 图片模型示例：`doubao-seedream-*`
- 视频模型示例：`doubao-seedance-*`
- 图片/视频任务应优先走低成本验证，先测文本连通，再测最小图片请求，最后再测单镜头视频任务。

当前实现会把用户填写的连接配置保存在浏览器 `localStorage`，并通过 `/api/provider/test` 做连接验证。设置页提供三个测试入口：`测试连接` 对应 `testMode=models`，用于确认 API Base/API Key 能访问供应商模型列表；`测试文本请求` 对应 `testMode=chat`，需要填写默认文本模型，会发起 `max_tokens=1` 的最小文本请求来确认模型名和密钥真的可调用；`测试图片请求` 对应 `testMode=image`，需要填写图片模型，会发起一张最小图片生成探针来确认图片端点和模型权限，可能产生供应商最小调用费用。短剧创作里的剧本/分镜、影视对话助手、角色、场景、道具等文本 LLM 链路已支持请求级 BYOK 配置；图片生成主入口和图像创作表单已支持请求级 BYOK 最小适配，剩余图片调用点的放开顺序见 [docs/byok-image-rollout.md](docs/byok-image-rollout.md)。视频生成主入口、绘影精灵视频生成、影视创作镜头生成和分段长视频接口已支持 Ark Plan BYOK 请求级配置；缺少用户 BYOK 时直接返回可读错误，不再回退到服务端默认 legacy provider 降级链。真实 60 秒以上视频仍必须按 5s -> 10s -> 30s -> 60s 阶梯测试，并用 `qa:video-duration` 验证实际媒体时长，避免无意义地产生费用或把短片误判为长成片。

公网部署必须启用 HTTPS；服务端不要把用户密钥写入日志、数据库或环境变量。

### 发布前检查

上线前至少执行：

```bash
pnpm install
pnpm run dev
pnpm run ts-check
pnpm exec eslint src/app/api/provider/test/route.ts src/components/generation-console.tsx src/components/generation-console/console-type-button.tsx src/components/generation-console/suggestion-chip.tsx src/components/generation-console/confirmation-panel.tsx src/components/generation-console/smart-panel.tsx src/components/generation-console/task-list.tsx --quiet
```

浏览器打开 `http://localhost:5000` 后检查首页、设置页“模型连接”、连接测试、视频/图像入口和任务中心。

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **优先使用 shadcn/ui 组件** 而不是从零开发基础组件
3. **遵循 Next.js App Router 规范**，正确区分服务端/客户端组件
4. **使用 TypeScript** 进行类型安全开发
5. **使用 `@/` 路径别名** 导入模块（已配置）
