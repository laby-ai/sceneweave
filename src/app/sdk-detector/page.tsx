'use client';

import { SDKDetector } from '@/components/sdk-detector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SDKDetectorPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">SDK能力检测</CardTitle>
            <CardDescription>
              自动检测SDK支持的最长视频时长，为您推荐最佳分段策略
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SDKDetector 
              onStrategyRecommend={(strategy) => {
                console.log('推荐策略:', strategy);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
            <CardDescription>
              了解SDK检测功能的工作原理和注意事项
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">工作原理</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-white/70">
                <li>系统会尝试生成不同时长的测试视频（5秒、10秒、15秒...）</li>
                <li>记录每个时长的生成是否成功</li>
                <li>根据成功的最大时长推荐最佳分段策略</li>
                <li>连续失败2次后自动停止检测</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">注意事项</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-white/70">
                <li>检测过程会消耗API配额，建议仅在首次使用时运行</li>
                <li>完整检测大约需要3-5分钟时间</li>
                <li>检测完成后可以随时重新运行以验证SDK能力变化</li>
                <li>检测结果仅供参考，实际使用时可根据需要调整策略</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">策略说明</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">保守策略</span>
                  <span className="text-white/70">最稳定，15秒单片段</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">平衡策略</span>
                  <span className="text-white/70">兼顾稳定和效率，20秒单片段</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">激进策略</span>
                  <span className="text-white/70">节省配额，30秒单片段</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
