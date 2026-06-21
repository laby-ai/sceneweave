# DESIGN.md

## 气质与意象
专业影视工作室——明净界面中一抹赤焰红(EF4444)热烈跃动，如场记板上亮红灯的专注信号，既有创作的激情又有专业的严谨。切换暗色模式时回归深夜剪辑室氛围——全黑界面中红色指示灯指引创作方向。交互棱角分明、功能密集但不喧闹。

## 双色主题系统
- **默认：亮色主题**（light mode）
- **可选：暗色主题**（dark mode），顶部导航栏昼夜滑块一键切换
- 切换通过 `.dark` class 控制 CSS 自定义变量级联
- 用户偏好持久化到 localStorage，首次访问尊重系统偏好 `prefers-color-scheme`

## 配色方案

### 亮色主题（默认）
- 背景：#ffffff（纯白），主区卡片 #ffffff
- 主色/强调色：#EF4444（赤焰红/Red），用于 CTA、高亮态、进度条
- 次级背景：#f3f4f6 / #f9fafb / #e5e7eb
- 文字：#111827，次级 rgba(0,0,0,0.55)
- 边框：#e5e7eb
- 导航栏：rgba(255,255,255,0.9) 毛玻璃
- 控制台：rgba(255,255,255,0.85) 毛玻璃

### 暗色主题
- 背景：#000000（纯黑），主区卡片 #0a0a0a
- 主色/强调色：#EF4444（赤焰红/Red），与亮色保持一致
- 次级背景：#1f1f1f / #171717 / #2a2a2a
- 文字：#ffffff，次级 rgba(255,255,255,0.7)
- 边框：#333333
- 导航栏：rgba(10,10,10,0.9) 毛玻璃
- 控制台：rgba(10,10,10,0.85) 毛玻璃

### 语义 Token 映射
| Token | 亮色值 | 暗色值 |
|-------|--------|--------|
| background | #ffffff | #000000 |
| foreground | #111827 | #ffffff |
| card | #ffffff | #0a0a0a |
| secondary | #f3f4f6 | #1f1f1f |
| muted | #f9fafb | #171717 |
| accent | #e5e7eb | #2a2a2a |
| border | #e5e7eb | #333333 |
| primary | #EF4444 | #EF4444 |

### 按钮配色体系（红色系列）
| 用途 | 正常态 | Hover态 | 禁用态 | 文字色 |
|------|--------|---------|--------|--------|
| 主按钮(Primary) | bg-red-500 (#EF4444) | bg-red-600 (#DC2626) | bg-red-500/40 | white |
| 次要按钮(Secondary) | bg-red-100 + text-red-600 | bg-red-200 | bg-red-50 | red-600 |
| 轮廓按钮(Outline) | border-red-500 + text-red-500 | bg-red-500 + text-white | border-red-200 | red-500 |
| 标签/徽章 | bg-red-500/10 + text-red-400 | bg-red-500/20 | bg-red-500/5 | red-400 |
| 深色按钮(Dark) | bg-red-700 (#B91C1C) | bg-red-800 (#991B1B) | bg-red-700/40 | white |
| 渐变按钮(Gradient) | from-red-500 to-rose-500 | from-red-600 to-rose-600 | opacity-50 | white |

### 保留语义色（非品牌用途）
- **成功/完成**：green-400/500（任务完成、验证通过）
- **警告/暂停**：amber-500（暂停状态、注意提示）
- **信息/重试**：blue-500（重试按钮、信息提示）— 仅限语义状态，不用于品牌装饰

## 字体排版
- 系统字体栈：-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif
- 标题加粗，正文常规，小字用 muted-foreground 透明度降级

## 页面结构
- 左侧固定导航栏（可折叠，64px 图标态 / 256px 展开态）
  - 折叠时显示图标列 + 顶部迷你logo，hover显示tooltip
  - 展开时显示完整图标+文字
- 顶部 72px 导航条（logo图片 + 主题切换 + 设置）
  - Logo使用SVG图片（笔/场记板/灯泡+弧线+星星），亮暗色各有适配版本
- 主内容区 ml-16（折叠时）或 ml-64（展开时），pt-72px
- 亮色模式下所有页面统一使用浅色背景+深色文字

## 全屏三栏模块设计
- 点击底部控制台"生成"按钮 → 跳转全屏三栏页面并自动开始创作
- 顶部栏：返回按钮(← 主色) + 标题 + AI驱动标签(红色渐变)
- 三栏比例：左侧 ~280px / 中间 flex-1 / 右侧 ~320px
- 面板背景使用 card token，自动适配亮/暗主题
- 返回按钮点击后回到主界面

## 任务中心监控视图
- 双视图切换：列表视图 / 监控视图（Tab切换）
- 监控卡片：8种状态渲染(pending→processing→assembling→post_processing→completed/failed/paused/cancelled)
- 进度条：主色#EF4444，分步骤进度展示
- 操作按钮：暂停/恢复(red-500) / 重试(red-400) / 删除(red-600)

## 底部创作控制台
- 毛玻璃背景(console-bg token)，大圆角输入框
- 创作类型Tab：AI视频/AI图像/绘影精灵/影视创作，单击切换内联模式，双击跳转全屏
- 模型选择：横向滚动式胶囊条，左右箭头导航，选中态主题色(赤焰红)
- 参数选择：时长/比例/更多按钮
- 主CTA「生成」按钮(主色) → 跳转全屏并自动开始创作

## 动效与交互
- 导航项 hover 渐变 accent/50，选中态 bg-[#EF4444]/10 + 文字变主色
- 卡片 hover scale-[1.01] + 阴影提升
- 按钮 hover bg-[#EF4444]/80 透明度过渡
- 主题切换时 CSS 变量级联，无闪烁

## 设计禁忌
- 禁止硬编码暗色背景色(如 #0a0a0a)，必须使用语义 token
- 禁止使用纯蓝/紫渐变作为主色或品牌色
- 禁止使用 blue/violet/purple/indigo/teal/cyan 系列作为品牌装饰色
- 禁止圆角过大（最大 2xl/1.5rem）
- 禁止在暗色模式下使用浅色背景卡片，反之亦然
