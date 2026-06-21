'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  Download, 
  Loader2, 
  Music, 
  Video,
  Volume2,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// ★ v2.0: BGM类型已迁移到 @/constants/bgm-types，此处使用集中定义
import { BGM_TYPES_V2, getBgmTypeList, type BgmTypeId } from '@/constants/bgm-types';

// 向后兼容：从集中定义提取旧格式
const BGM_TYPES: Record<string, { name: string; description: string }> = {};
for (const bgm of getBgmTypeList()) {
  if (!['electronic', 'jazz', 'classical', 'rock', 'acoustic', 'ambient', 'suspense', 'comedy', 'corporate', 'lofi', 'world', 'holiday'].includes(bgm.id)) {
    BGM_TYPES[bgm.id] = { name: bgm.name, description: bgm.description };
  }
}

interface BgmItem {
  type: string;
  name: string;
  fileName: string;
  url: string;
}

interface Props {
  videoUrl?: string;
  onSelectBgm?: (bgm: BgmItem) => void;
  onExport?: (videoUrl: string, bgmUrl: string) => void;
}

export default function BgmPlayer({ videoUrl, onSelectBgm, onExport }: Props) {
  const [bgmList, setBgmList] = useState<BgmItem[]>([]);
  const [selectedBgm, setSelectedBgm] = useState<BgmItem | null>(null);
  const [currentType, setCurrentType] = useState<string>('relaxed');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 加载BGM列表
  const loadBgmList = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bgm/list?type=${currentType}`);
      const data = await res.json();
      
      if (data.success) {
        setBgmList(data.list || []);
      } else {
        console.error('加载BGM失败:', data.error);
      }
    } catch (error) {
      console.error('加载BGM失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 初始化BGM（同步到对象存储）
  const initBgm = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/bgm/init?action=init');
      const data = await res.json();
      console.log('BGM初始化结果:', data);
      setIsInitialized(data.success);
      
      if (data.success) {
        await loadBgmList();
      }
    } catch (error) {
      console.error('BGM初始化失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 播放BGM预览
  const playBgm = (bgm: BgmItem) => {
    setSelectedBgm(bgm);
    if (audioRef.current) {
      audioRef.current.src = bgm.url;
      audioRef.current.play();
      setIsPlaying(true);
    }
    onSelectBgm?.(bgm);
  };

  // 停止BGM
  const stopBgm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  // 导出带BGM的视频
  const handleExport = async () => {
    if (!videoUrl || !selectedBgm) return;

    setIsExporting(true);
    setExportProgress('正在合并音视频...');

    try {
      const res = await fetch('/api/bgm/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl,
          audioUrl: selectedBgm.url,
          outputName: `video-with-${selectedBgm.fileName}`,
        }),
      });

      const data = await res.json();
      
      if (data.success) {
        setExportProgress('导出成功!');
        onExport?.(data.url, selectedBgm.url);
        
        // 自动下载
        const a = document.createElement('a');
        a.href = data.url;
        a.download = `video-with-${selectedBgm.fileName}.mp4`;
        a.click();
      } else {
        setExportProgress(`导出失败: ${data.error}`);
      }
    } catch (error: any) {
      setExportProgress(`导出失败: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Web Audio API 混音播放（前端实时混音）
  const [webAudioPlaying, setWebAudioPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const startWebAudioMix = async () => {
    if (!videoUrl || !selectedBgm) return;

    try {
      // 创建AudioContext
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      // 获取视频和音频源
      const videoElement = document.querySelector('video') as HTMLVideoElement;
      if (!videoElement) return;

      videoElementRef.current = videoElement;

      // 连接视频音频
      const videoSource = audioContextRef.current.createMediaElementSource(videoElement);
      videoSource.connect(audioContextRef.current.destination);

      // 创建BGM音频源
      const bgmAudio = new Audio(selectedBgm.url);
      bgmAudio.loop = true;
      const bgmSource = audioContextRef.current.createMediaElementSource(bgmAudio);
      
      // 创建增益节点（控制BGM音量）
      const bgmGain = audioContextRef.current.createGain();
      bgmGain.gain.value = 0.3; // BGM音量设为30%
      
      bgmSource.connect(bgmGain);
      bgmGain.connect(audioContextRef.current.destination);

      // 播放
      videoElement.play();
      bgmAudio.play();

      setWebAudioPlaying(true);

      // 监听结束
      videoElement.onended = () => {
        bgmAudio.pause();
        setWebAudioPlaying(false);
      };
    } catch (error) {
      console.error('Web Audio混音失败:', error);
    }
  };

  const stopWebAudioMix = () => {
    if (videoElementRef.current) {
      videoElementRef.current.pause();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setWebAudioPlaying(false);
  };

  useEffect(() => {
    return () => {
      stopBgm();
      stopWebAudioMix();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* BGM初始化 */}
      <Card className="bg-black/20 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Music className="w-5 h-5 text-red-400" />
            背景音乐设置
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            选择背景音乐，支持预览和导出
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 初始化按钮 */}
          {!isInitialized && (
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
              <p className="text-foreground/70 text-sm mb-3">
                BGM资源尚未初始化，是否立即下载到本地存储？
              </p>
              <Button
                onClick={initBgm}
                disabled={isLoading}
                size="sm"
                className="bg-red-600 hover:bg-red-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    初始化中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    初始化BGM
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 音乐类型选择 */}
          {isInitialized && (
            <>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                {getBgmTypeList().map((bgm) => (
                  <button
                    key={bgm.id}
                    onClick={() => {
                      setCurrentType(bgm.id);
                      loadBgmList();
                    }}
                    title={`${bgm.name}: ${bgm.description}`}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all ${
                      currentType === bgm.id
                        ? `${bgm.bgColor} ${bgm.color} border ${bgm.borderColor}`
                        : 'bg-accent/30 text-muted-foreground hover:bg-accent border border-border'
                    }`}
                  >
                    <span className="text-sm">{bgm.icon}</span>
                    <span>{bgm.name}</span>
                  </button>
                ))}
              </div>

              {/* BGM列表 */}
              <div className="space-y-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-red-400" />
                  </div>
                ) : bgmList.length > 0 ? (
                  bgmList.map((bgm) => (
                    <div
                      key={bgm.fileName}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedBgm?.fileName === bgm.fileName
                          ? 'bg-red-500/20 border-red-500'
                          : 'bg-accent/30 border-border hover:border-red-500/50'
                      }`}
                      onClick={() => playBgm(bgm)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isPlaying && selectedBgm?.fileName === bgm.fileName) {
                                stopBgm();
                              } else {
                                playBgm(bgm);
                              }
                            }}
                            className="p-2 rounded-full bg-red-500/30 hover:bg-red-500/50"
                          >
                            {isPlaying && selectedBgm?.fileName === bgm.fileName ? (
                              <Pause className="w-4 h-4 text-white" />
                            ) : (
                              <Play className="w-4 h-4 text-white" />
                            )}
                          </button>
                          <div>
                            <p className="text-white font-medium">{bgm.name}</p>
                            <p className="text-muted-foreground text-xs">{bgm.fileName}</p>
                          </div>
                        </div>
                        
                        {selectedBgm?.fileName === bgm.fileName && (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        )}
                      </div>
                      
                      {selectedBgm?.fileName === bgm.fileName && (
                        <audio
                          ref={audioRef}
                          src={bgm.url}
                          className="w-full mt-2"
                          onEnded={() => setIsPlaying(false)}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>该类型暂无BGM</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 播放模式选择 */}
      {selectedBgm && (
        <Card className="bg-black/20 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Video className="w-5 h-5 text-green-400" />
              播放模式
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 预览模式说明 */}
            <div className="p-3 bg-accent/30 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-500/20 rounded">
                  <Volume2 className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-medium">预览模式</p>
                  <p className="text-muted-foreground text-sm">
                    视频和音频同时播放，快速预览效果
                  </p>
                </div>
              </div>
            </div>

            {/* 导出说明 */}
            <div className="p-3 bg-accent/30 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/20 rounded">
                  <Download className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-medium">导出模式</p>
                  <p className="text-muted-foreground text-sm">
                    将BGM合并到视频中，生成可下载的最终视频
                  </p>
                </div>
              </div>
            </div>

            {/* 导出按钮 */}
            {videoUrl && (
              <div className="space-y-3">
                <Button
                  onClick={handleExport}
                  disabled={isExporting || !videoUrl}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {exportProgress || '导出中...'}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      导出带BGM的视频
                    </>
                  )}
                </Button>
                
                {exportProgress && (
                  <p className={`text-sm text-center ${
                    exportProgress.includes('成功') ? 'text-green-400' : 
                    exportProgress.includes('失败') ? 'text-red-400' : 'text-muted-foreground'
                  }`}>
                    {exportProgress}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
