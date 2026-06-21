import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '页面未找到',
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-500">404</h1>
        <h2 className="mt-4 text-xl font-medium text-muted-foreground">
          页面未找到
        </h2>
        <p className="mt-2 text-sm text-muted-foreground/70">
          您访问的页面不存在或已被移除
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
