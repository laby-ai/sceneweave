'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Play, 
  RotateCcw, 
  Clock, 
  Zap, 
  AlertCircle,
  ChevronRight,
  Settings
} from 'lucide-react';
import { SegmentStrategyMode } from '@/lib/video-segment-strategy';

interface DetectionStep {
  duration: number;
  status: 'pending' | 'testing' | 'success' | 'failed' | 'skipped';
  error?: string;
  videoUrl?: string;
  taskId?: string;
  startTime?: number;
  endTime?: number;
  durationSeconds?: number;
}

interface DetectionResult {
  detectedMaxDuration: number | null;
  recommendedStrategy: SegmentStrategyMode;
  steps: DetectionStep[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface SDKDetectorProps {
  onDetectionComplete?: (result: DetectionResult) => void;
  onStrategyRecommend?: (strategy: SegmentStrategyMode) => void;
  onStrategySelect?: (strategy: SegmentStrategyMode) => void;
  className?: string;
}

export function SDKDetector({ 
  onDetectionComplete, 
  onStrategyRecommend,
  onStrategySelect,
  className = '' 
}: SDKDetectorProps) {
  const [sessionId, setSessionId] = useState<string>(() => 
    `detect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const [detection, setDetection] = useState<DetectionResult>({
    detectedMaxDuration: null,
    recommendedStrategy: 'conservative',
    steps: [],
    status: 'idle'
  });
  const [isPolling, setIsPolling] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 计算进度
  const progress = detection.steps.length > 0 
    ? Math.round((detection.steps.filter(s => 
        s.status === 'success' || s.status === 'failed' || s.status === 'skipped'
      ).length / detection.steps.length) * 100)
    : 0;

  // 生成唯一sessionId
  const generateSessionId = useCallback(() => {
    return `detect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // 开始检测
  const startDetection = useCallback(async () => {
    try {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      
      // 重置状态
      setDetection({
        detectedMaxDuration: null,
        recommendedStrategy: 'conservative',
        steps: [],
        status: 'running',
        startTime: Date.now()
      });

      // 启动无费用 readiness 检测
      const response = await fetch('/api/video/detect-sdk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: newSessionId,
          maxTestDuration: 30, // 最多测试到30秒
          skipExisting: true
        })
      });

      if (!response.ok) {
        throw new Error('启动检测失败');
      }

      // 开始轮询状态
      startPolling(newSessionId);

    } catch (error) {
      console.error('[SDK Detector] 启动检测失败:', error);
      setDetection(prev => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : '启动检测失败'
      }));
    }
  }, [generateSessionId]);

  // 轮询状态
  const startPolling = useCallback((currentSessionId: string) => {
    setIsPolling(true);
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/video/detect-sdk?sessionId=${currentSessionId}`);
        
        if (!response.ok) {
          throw new Error('获取状态失败');
        }

        const data = await response.json();
        setDetection(data.session);

        // 如果检测完成或失败，停止轮询
        if (data.session.status === 'completed' || data.session.status === 'failed') {
          setIsPolling(false);
          
          if (data.session.status === 'completed') {
            onDetectionComplete?.(data.session);
            onStrategyRecommend?.(data.session.recommendedStrategy);
          }
          return;
        }

        // 继续轮询
        setTimeout(poll, 2000);

      } catch (error) {
        console.error('[SDK Detector] 轮询失败:', error);
        setIsPolling(false);
        setDetection(prev => ({
          ...prev,
          status: 'failed',
          error: error instanceof Error ? error.message : '获取状态失败'
        }));
      }
    };

    poll();
  }, [onDetectionComplete, onStrategyRecommend]);

  // 重置检测
  const resetDetection = useCallback(() => {
    setDetection({
      detectedMaxDuration: null,
      recommendedStrategy: 'conservative',
      steps: [],
      status: 'idle'
    });
    setSessionId(generateSessionId());
    setIsPolling(false);
  }, [generateSessionId]);

  // 获取状态图标
  const getStatusIcon = (status: DetectionStep['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'testing':
        return <Loader2 className="w-4 h-4 text-red-500 animate-spin" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-foreground/70" />;
      default:
        return <Clock className="w-4 h-4 text-foreground/70" />;
    }
  };

  // 获取状态标签
  const getStatusBadge = (status: DetectionStep['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">成功</Badge>;
      case 'failed':
        return <Badge variant="destructive">失败</Badge>;
      case 'testing':
        return <Badge variant="default" className="bg-red-500">测试中</Badge>;
      case 'skipped':
        return <Badge variant="secondary">跳过</Badge>;
      default:
        return <Badge variant="outline">等待中</Badge>;
    }
  };

  // 获取策略说明
  const getStrategyDescription = (strategy: SegmentStrategyMode) => {
    switch (strategy) {
      case 'conservative':
        return {
          name: '保守策略',
          description: '最稳定，避免单片段过长可能失败的风险',
          icon: <Settings className="w-5 h-5" />
        };
      case 'balanced':
        return {
          name: '平衡策略',
          description: '兼顾稳定性和API调用效率，适合大多数场景',
          icon: <Zap className="w-5 h-5" />
        };
      case 'aggressive':
        return {
          name: '激进策略',
          description: '最大程度节省API配额，但20秒+单片段可能失败',
          icon: <Zap className="w-5 h-5" />
        };
    }
  };

  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-red-500" />
          Ark 生成能力检查
        </CardTitle>
        <CardDescription>
          检查 Ark/Seedance BYOK 配置与推荐分段策略，不触发真实视频生成
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 检测状态 */}
        {detection.status === 'idle' && (
          <div className="text-center py-8 space-y-4">
            <Zap className="w-12 h-12 text-foreground/70 mx-auto" />
            <div className="space-y-2">
              <p className="text-foreground/70">点击下方按钮检查 Ark/Seedance 配置</p>
              <p className="text-sm text-muted-foreground">
                仅做本地 readiness 判断，不会消耗真实视频额度
              </p>
            </div>
            <Button onClick={startDetection} className="gap-2">
              <Play className="w-4 h-4" />
              开始检查
            </Button>
          </div>
        )}

        {/* 检测进行中 */}
        {(detection.status === 'running' || isPolling) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                <span className="font-medium">Ark readiness 检查中...</span>
              </div>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-foreground/70">
              正在检查 {detection.steps.find(s => s.status === 'testing')?.duration || '...'}秒分段策略
            </p>
          </div>
        )}

        {/* 检测完成 */}
        {detection.status === 'completed' && (
          <div className="space-y-6">
            {/* 检测结果 */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <h3 className="font-semibold text-green-900">检测完成！</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-green-700 mb-1">最大支持时长</p>
                  <p className="text-2xl font-bold text-green-900">
                    {detection.detectedMaxDuration}秒
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-700 mb-1">推荐策略</p>
                  <p className="text-lg font-semibold text-green-900">
                    {getStrategyDescription(detection.recommendedStrategy).name}
                  </p>
                </div>
              </div>
            </div>

            {/* 策略推荐详情 */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                {getStrategyDescription(detection.recommendedStrategy).icon}
                推荐策略说明
              </h4>
              <p className="text-sm text-foreground/70">
                {getStrategyDescription(detection.recommendedStrategy).description}
              </p>
              
              {onStrategySelect && (
                <Button 
                  className="mt-3 w-full"
                  onClick={() => onStrategySelect(detection.recommendedStrategy)}
                >
                  应用此策略
                </Button>
              )}
              {!onStrategySelect && onStrategyRecommend && (
                <Button 
                  className="mt-3 w-full"
                  onClick={() => onStrategyRecommend(detection.recommendedStrategy)}
                >
                  应用此策略
                </Button>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3">
              <Button 
                variant="secondary" 
                onClick={resetDetection}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                重新检测
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setShowDetails(!showDetails)}
                className="gap-2"
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
                {showDetails ? '隐藏详情' : '查看详情'}
              </Button>
            </div>

            {/* 详细步骤 */}
            {showDetails && (
              <div className="border rounded-lg divide-y">
                {detection.steps.map((step, index) => (
                  <div key={index} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(step.status)}
                      <div>
                        <p className="font-medium">{step.duration}秒视频</p>
                        {step.durationSeconds && (
                          <p className="text-sm text-muted-foreground">
                            耗时: {step.durationSeconds.toFixed(1)}秒
                          </p>
                        )}
                        {step.error && (
                          <p className="text-sm text-red-600">{step.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {step.videoUrl && (
                        <a 
                          href={step.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-red-600 hover:underline text-sm"
                        >
                          查看视频
                        </a>
                      )}
                      {getStatusBadge(step.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 检测失败 */}
        {detection.status === 'failed' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-900">检测失败</h3>
                  <p className="text-red-700">{detection.error}</p>
                </div>
              </div>
            </div>
            <Button onClick={resetDetection} variant="secondary" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              重新检测
            </Button>
          </div>
        )}

        {/* 提示信息 */}
        <div className="bg-red-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              检测过程会消耗API配额，建议仅在首次使用或遇到问题时运行。
              检测完成后可以随时重新运行以验证SDK能力变化。
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
