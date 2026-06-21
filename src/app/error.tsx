'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-500">出错了</h1>
        <h2 className="mt-4 text-xl font-medium text-muted-foreground">
          页面加载时发生了错误
        </h2>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          重试
        </button>
      </div>
    </div>
  );
}
