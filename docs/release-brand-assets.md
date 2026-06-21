# 绘影工作室发布品牌资产

本页记录当前公网发布所用的 Logo / favicon / PWA 图标资产。更换 Logo 时应成组替换，避免页面导航、浏览器标签、收藏夹和移动端安装图标不一致。

## 当前资产

| 用途 | 路径 | 尺寸 |
| --- | --- | --- |
| 页面导航 Logo | `public/logo-icon-galaxy.png` | 源图，当前左侧导航使用 |
| 品牌源图 | `public/brand/huiying-logo-icon.png` | 512 x 512 |
| 浏览器 favicon | `src/app/favicon.ico` | 16 / 32 / 48 |
| Next App Router icon | `src/app/icon.png` | 512 x 512 |
| Next App Router Apple icon | `src/app/apple-icon.png` | 180 x 180 |
| PWA icon | `public/icon-192.png` | 192 x 192 |
| PWA icon | `public/icon-512.png` | 512 x 512 |
| Apple touch icon | `public/apple-touch-icon.png` | 180 x 180 |
| PNG favicon | `public/favicon-16x16.png` | 16 x 16 |
| PNG favicon | `public/favicon-32x32.png` | 32 x 32 |
| Web App Manifest | `public/site.webmanifest` | 引用 192 / 512 图标 |

## Metadata 入口

`src/app/layout.tsx` 的 `metadata.icons`、`metadata.appleWebApp` 和 `metadata.manifest` 已统一指向上述资产。后续如果替换品牌图，优先替换源图并重新导出同名尺寸，减少代码改动。

## 发布检查

- 打开首页后，左侧导航栏顶部显示 `public/logo-icon-galaxy.png`。
- 浏览器标签页 favicon 使用新的星系镜头 Logo。
- `GET /site.webmanifest` 返回 200，且 `icons` 中的 `/icon-192.png` 和 `/icon-512.png` 可访问。
- 移动端添加到主屏幕后显示 `apple-touch-icon.png` 或 manifest 图标。
