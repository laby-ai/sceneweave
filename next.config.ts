import type { NextConfig } from 'next';
import path from 'path';

const icanvasDir = path.resolve(__dirname, 'src/icanvas');

// 子路径部署（如 airai.world/huiying）：设置 NEXT_PUBLIC_BASE_PATH=/huiying。
// 留空则保持根路径部署（本地开发不受影响）。
const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const basePath = rawBasePath && rawBasePath.startsWith('/') ? rawBasePath : '';

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  // Keep the Coze SDK external because its dynamic CommonJS loading cannot be
  // bundled by Turbopack. The release gate materializes Next's hashed alias.
  serverExternalPackages: ['coze-coding-dev-sdk'],
  allowedDevOrigins: ['*.dev.coze.site', 'localhost', '127.0.0.1'],
  images: {
    qualities: [54, 58, 68],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  // 把 vendored 的 basketikun/infinite-canvas 画布模块挂到 @icanvas 别名。
  // 只在打包层解析，tsc 走 ambient 声明（src/types/icanvas.d.ts），避免污染类型门禁。
  turbopack: {
    resolveAlias: {
      '@icanvas': icanvasDir,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@icanvas': icanvasDir,
    };
    return config;
  },
};

export default nextConfig;
