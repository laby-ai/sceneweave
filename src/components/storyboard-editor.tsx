'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Image as ImageIcon, 
  Film, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  PlayCircle,
  Sparkles as SparklesIcon,
  X,
  Music,
  Upload,
  Library,
  Headphones,
  Volume2
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { StoryboardShot, Storyboard } from '@/types/storyboard';
import { VideoPromptGenerator } from './video-prompt-generator';
import { BGM_TYPES_V2, getBgmTypeList, type BgmTypeId } from '@/constants/bgm-types';
import { SFX_CATEGORIES, getSfxByCategory, type SfxId } from '@/constants/sfx-types';
import MusicLibraryBrowser from '@/components/music-library-browser';
import type { LibraryTrack } from '@/constants/music-library';

// 音频设置类型
export interface AudioSettings {
  enableVoiceNarration: boolean;
  voiceNarrationText: string;
  backgroundBgm: string;
  customAudio?: {
    url: string;
    name: string;
    size?: number;
  } | null;
  libraryTrack?: {    // ★ 音乐库曲目
    id: string;
    title: string;
    artist: string;
    url: string;
    duration: number;
  } | null;
}

// 使用特殊分隔符存储多张图片（避免base64中的逗号干扰）
const IMAGE_SEP = '|||IMAGE_SEP|||';

interface StoryboardEditorProps {
  storyboard?: Storyboard;
  onStoryboardChange?: (storyboard: Storyboard) => void;
  onGenerate?: () => void;
  onAudioSettingsChange?: (settings: AudioSettings) => void;
  onSfxBindingsChange?: (bindings: Array<{ sfxId: SfxId; shotIndex: number; timeOffset: number }>) => void; // ★ 特效音绑定回调
  isGenerating?: boolean;
}

export function StoryboardEditor({ 
  storyboard: initialStoryboard, 
  onStoryboardChange,
  onGenerate,
  onAudioSettingsChange,
  onSfxBindingsChange,
  isGenerating = false
}: StoryboardEditorProps) {
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  
  // 音频设置状态
  const [enableVoiceNarration, setEnableVoiceNarration] = useState(true); // 默认启用语音旁白
  const [voiceNarrationText, setVoiceNarrationText] = useState(''); // 自定义旁白文本
  const [backgroundBgm, setBackgroundBgm] = useState<string>('none'); // 背景音乐
  const [customAudio, setCustomAudio] = useState<{ url: string; name: string; size: number } | null>(null); // 自定义音频
  const [isUploadingAudio, setIsUploadingAudio] = useState(false); // 上传状态

  // ★ 公开音乐库相关状态
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<LibraryTrack | null>(null);

  // ★ 特效音(SFX)镜头级绑定状态
  const [shotSfxMap, setShotSfxMap] = useState<Map<number, { sfxId: SfxId; timeOffset: number }>>(new Map());
  const [showSfxPickerForShot, setShowSfxPickerForShot] = useState<number | null>(null);
  
  // 使用ref存储回调函数，避免useEffect依赖变化导致无限循环
  const onStoryboardChangeRef = useRef(onStoryboardChange);
  useEffect(() => {
    onStoryboardChangeRef.current = onStoryboardChange;
  }, [onStoryboardChange]);
  
  // 音频设置ref，用于在生成时获取最新值
  const audioSettingsRef = useRef({ enableVoiceNarration, backgroundBgm, voiceNarrationText, customAudio });
  useEffect(() => {
    audioSettingsRef.current = { enableVoiceNarration, backgroundBgm, voiceNarrationText, customAudio };
  }, [enableVoiceNarration, backgroundBgm, voiceNarrationText, customAudio]);

  // ★ 特效音绑定变更通知父组件
  useEffect(() => {
    if (onSfxBindingsChange) {
      const bindings = Array.from(shotSfxMap.entries()).map(([shotIndex, val]) => ({
        sfxId: val.sfxId,
        shotIndex,
        timeOffset: val.timeOffset,
      }));
      onSfxBindingsChange(bindings);
    }
  }, [shotSfxMap, onSfxBindingsChange]);
  
  const [shots, setShots] = useState<StoryboardShot[]>(() => {
    if (initialStoryboard?.shots) {
      return initialStoryboard.shots;
    }
    return [{
      id: `shot-${Date.now()}`,
      index: 0,
      prompt: '20岁东亚女生在海边沙滩上散步，海风轻轻吹起长发，阳光洒在脸上，面带微笑看向远方',
      duration: 8, // 优化：默认从5s提升到8s，减少镜头数降低成本
      nineGridImages: [],
      status: 'pending'
    }];
  });

  // ★ 当外部传入的 storyboard 变化时（如点击"应用分镜头"），同步 shots 到本地状态
  useEffect(() => {
    if (initialStoryboard?.shots && initialStoryboard.shots.length > 0) {
      // 检查是否真的需要更新（避免无限循环）
      const incomingIds = initialStoryboard.shots.map(s => s.id).join(',');
      const currentIds = shots.map(s => s.id).join(',');
      if (incomingIds !== currentIds) {
        console.log(`[StoryboardEditor] 📥 外部同步 ${initialStoryboard.shots.length} 个镜头（含时长更新）`);
        setShots(initialStoryboard.shots);
      }
    }
  }, [initialStoryboard?.shots]); // 仅当 shots 引用变化时触发

  const [title, setTitle] = useState(initialStoryboard?.title || '未命名分镜头视频');

  const totalDuration = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const isDurationValid = totalDuration > 10;

  // 同步shots变化到父组件 - 使用ref调用，避免依赖回调函数本身
  useEffect(() => {
    console.log('[StoryboardEditor] useEffect triggered, shots count:', shots.length);
    if (onStoryboardChangeRef.current) {
      // 确保 Date 对象被正确序列化
      const createdAt = initialStoryboard?.createdAt 
        ? (initialStoryboard.createdAt instanceof Date ? initialStoryboard.createdAt : new Date(initialStoryboard.createdAt))
        : new Date();
        
      const updatedStoryboard: Storyboard = {
        id: initialStoryboard?.id || `storyboard-${Date.now()}`,
        title: title,
        totalDuration,
        shots,
        status: 'draft',
        createdAt: createdAt,
        updatedAt: new Date(),
      };
      console.log('[StoryboardEditor] Calling onStoryboardChange with', shots.length, 'shots');
      onStoryboardChangeRef.current(updatedStoryboard);
    } else {
      console.log('[StoryboardEditor] onStoryboardChange is not defined');
    }
  }, [shots, totalDuration, title, initialStoryboard?.id]); // 移除onStoryboardChange依赖

  const addShot = useCallback(() => {
    const defaultPrompts = [
      '主体在优美的环境中自然地展示动作',
      '镜头聚焦于细节，展现精致的构图',
      '全景展示场景，营造氛围',
      '特写镜头捕捉表情和情感',
      '中景展示主体与环境的关系',
      '缓慢移动镜头，创造流畅的视觉体验'
    ];
    const randomPrompt = defaultPrompts[shots.length % defaultPrompts.length];
    
    const newShot: StoryboardShot = {
      id: `shot-${Date.now()}`,
      index: shots.length,
      prompt: randomPrompt,
      duration: 5,
      referenceImage: undefined,
      nineGridImages: [],
      status: 'pending'
    };
    setShots(prev => [...prev, newShot]);
  }, [shots.length]);

  const handlePromptGenerated = useCallback((generatedPrompt: string) => {
    console.log('=== 开始解析提示词 ===');
    console.log('原始输入:', generatedPrompt);
    
    // 尝试按常见的分隔符拆分
    const newShots: StoryboardShot[] = [];
    
    // 强力清理函数，去掉所有镜头前缀
    const cleanPromptText = (text: string): string => {
      let cleanText = text;
      
      // 清理所有可能的镜头前缀格式
      const prefixPatterns = [
        /^镜头\d+[：:]\s*/g,           // 镜头1：
        /^镜头\d+-\s*/g,              // 镜头1-
        /^镜头\d+\s*/g,               // 镜头1 
        /^\[\s*镜头\d+\s*\]\s*/g,       // [镜头1]
        /^\[\s*镜头\d+\s*-\s*\d+\s*秒?\s*\]\s*/g, // [镜头1 - 5秒]
        /^\[\s*镜头\d+[：:]\s*/g,        // [镜头1：
        /^\[\s*镜头\d+\s*/g,           // [镜头1
        /^镜头\d+/g,                   // 镜头1
      ];
      
      prefixPatterns.forEach(pattern => {
        cleanText = cleanText.replace(pattern, '');
      });
      
      // 清理行首的空格和换行
      cleanText = cleanText.trim();
      
      // 如果清理后为空，返回原文本
      return cleanText || text.trim();
    };
    
    // 方法1: 尝试按行解析，识别"镜头X："格式
    const lines = generatedPrompt.split(/\n/);
    console.log('按行拆分结果:', lines);
    
    const lensLineRegex = /^镜头\d+[：:\-\s]/;
    const hasLensFormat = lines.some(line => lensLineRegex.test(line.trim()));
    
    if (hasLensFormat) {
      console.log('识别到镜头格式，按镜头解析');
      
      let currentShotText = '';
      
      lines.forEach((line) => {
        const trimmedLine = line.trim();
        
        if (lensLineRegex.test(trimmedLine)) {
          // 新镜头开始 - 如果有之前的镜头内容，先保存
          if (currentShotText.trim()) {
            const cleanText = cleanPromptText(currentShotText);
            if (cleanText.trim()) {
              newShots.push({
                id: `shot-${Date.now()}-${newShots.length}`,
                index: shots.length + newShots.length,
                prompt: cleanText,
                duration: 5,
                nineGridImages: [],
                status: 'pending'
              });
            }
          }
          currentShotText = trimmedLine;
        } else if (trimmedLine) {
          // 继续当前镜头
          currentShotText = currentShotText 
            ? (currentShotText + '\n' + trimmedLine) 
            : trimmedLine;
        }
      });
      
      // 保存最后一个镜头
      if (currentShotText.trim()) {
        const cleanText = cleanPromptText(currentShotText);
        if (cleanText.trim()) {
          newShots.push({
            id: `shot-${Date.now()}-${newShots.length}`,
            index: shots.length + newShots.length,
            prompt: cleanText,
            duration: 5,
            nineGridImages: [],
            status: 'pending'
          });
        }
      }
    } 
    
    // 方法2: 如果没有识别到镜头格式，尝试按空行分组
    if (newShots.length === 0) {
      console.log('未识别到镜头格式，按段落解析');
      
      const paragraphs: string[] = [];
      let currentPara = '';
      
      lines.forEach(line => {
        if (line.trim()) {
          currentPara = currentPara 
            ? (currentPara + '\n' + line) 
            : line;
        } else if (currentPara.trim()) {
          paragraphs.push(currentPara);
          currentPara = '';
        }
      });
      
      if (currentPara.trim()) {
        paragraphs.push(currentPara);
      }
      
      if (paragraphs.length > 1) {
        paragraphs.forEach((para, idx) => {
          const cleanText = cleanPromptText(para);
          if (cleanText.trim()) {
            newShots.push({
              id: `shot-${Date.now()}-${idx}`,
              index: shots.length + idx,
              prompt: cleanText,
              duration: 5,
              nineGridImages: [],
              status: 'pending'
            });
          }
        });
      }
    }
    
    // 方法3: 如果还是没有分镜头，直接单个镜头
    if (newShots.length === 0) {
      console.log('使用单个镜头模式');
      const cleanText = cleanPromptText(generatedPrompt);
      newShots.push({
        id: `shot-${Date.now()}`,
        index: shots.length,
        prompt: cleanText,
        duration: 5,
        nineGridImages: [],
        status: 'pending'
      });
    }
    
    console.log('最终解析结果:');
    console.log('分镜头数量:', newShots.length);
    newShots.forEach((shot, idx) => {
      console.log(`分镜头${idx + 1}:`, shot.prompt);
    });
    
    setShots(prev => [...prev, ...newShots]);
    setShowPromptGenerator(false);
  }, [shots.length]);

  const removeShot = useCallback((shotId: string) => {
    if (shots.length <= 1) return;
    setShots(prev => {
      const filtered = prev.filter(s => s.id !== shotId);
      return filtered.map((shot, index) => ({ ...shot, index }));
    });
  }, [shots.length]);

  const updateShot = useCallback((shotId: string, updates: Partial<StoryboardShot>) => {
    setShots(prev => prev.map(shot => 
      shot.id === shotId ? { ...shot, ...updates } : shot
    ));
  }, []);

  const handleImageUpload = useCallback((shotId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log('[ImageUpload] 开始处理图片上传');
    console.log('[ImageUpload] 文件数量:', files.length);
    
    // 获取当前分镜头数据
    const currentShot = shots.find(s => s.id === shotId);
    if (!currentShot) return;

    console.log('[ImageUpload] 当前已有图片:', currentShot.referenceImage?.length || 0, '字节');

    // 检查数量限制（最多9张）
    if (currentShot?.useReferenceAsNineGrid && currentShot.referenceImage) {
      alert('已启用"使用此图片代替九宫格"模式，请先关闭开关或删除所有图片');
      return;
    }

    const existingImages = currentShot?.referenceImage ? currentShot.referenceImage.split(IMAGE_SEP).filter(Boolean) : [];
    console.log('[ImageUpload] 现有图片数量:', existingImages.length);
    const remainingSlots = 9 - existingImages.length;
    
    // 转换为数组并限制数量
    const filesArray = Array.from(files);
    console.log('[ImageUpload] 本次选择文件数量:', filesArray.length);
    const filesToUpload = filesArray.length > remainingSlots ? filesArray.slice(0, remainingSlots) : filesArray;
    
    if (filesArray.length > remainingSlots) {
      alert(`最多只能上传${remainingSlots}张图片（已有${existingImages.length}张，最多9张）`);
    }

    // 验证并读取所有图片
    const newImages: string[] = [];
    let loadedCount = 0;
    let hasUpdated = false; // 防止重复更新
    const totalToLoad = filesToUpload.length;

    filesToUpload.forEach((file, idx) => {
      console.log(`[ImageUpload] 准备读取第${idx + 1}个文件:`, file.name, file.size, 'bytes');
      
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        console.error('文件不是图片文件');
        return;
      }

      // 验证文件大小（最大5MB）
      if (file.size > 5 * 1024 * 1024) {
        console.error('图片大小超过5MB');
        return;
      }

      const reader = new FileReader();
      
      reader.onload = (e) => {
        // 防止重复处理
        if (hasUpdated) {
          console.log('[ImageUpload] 跳过重复更新');
          return;
        }
        
        const imageUrl = e.target?.result as string;
        console.log(`[ImageUpload] 第${idx + 1}个文件读取完成，长度:`, imageUrl?.length || 0);
        
        if (imageUrl) {
          newImages.push(imageUrl);
        }
        loadedCount++;
        console.log(`[ImageUpload] 已读取 ${loadedCount}/${totalToLoad}`);

        // 所有图片读取完成后再更新
        if (loadedCount === totalToLoad) {
          hasUpdated = true;
          const allImages = [...existingImages, ...newImages].slice(0, 9);
          console.log('[ImageUpload] 上传完成，总共', allImages.length, '张图片');
          console.log('[ImageUpload] 每张图片长度:', allImages.map(img => img.length));
          updateShot(shotId, { referenceImage: allImages.join(IMAGE_SEP) });
        }
      };

      reader.onerror = () => {
        console.error(`[ImageUpload] 第${idx + 1}个图片读取失败`);
        loadedCount++;
        if (loadedCount === totalToLoad && !hasUpdated) {
          hasUpdated = true;
          if (newImages.length > 0) {
            const allImages = [...existingImages, ...newImages].slice(0, 9);
            updateShot(shotId, { referenceImage: allImages.join(IMAGE_SEP) });
          }
        }
      };

      reader.readAsDataURL(file);
    });
  }, [shots, updateShot]);

  const handleRemoveImage = useCallback((shotId: string, imageIndex: number) => {
    const currentShot = shots.find(s => s.id === shotId);
    if (!currentShot?.referenceImage) return;

    const images = currentShot.referenceImage.split(IMAGE_SEP);
    
    if (images.length === 1) {
      // 如果只剩一张图片，清空整个字段
      updateShot(shotId, { 
        referenceImage: undefined,
        useReferenceAsNineGrid: false 
      });
    } else {
      // 移除指定索引的图片
      images.splice(imageIndex, 1);
      updateShot(shotId, { referenceImage: images.join(IMAGE_SEP) });
    }
  }, [shots, updateShot]);

  const moveShot = useCallback((fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= shots.length) return;
    setShots(prev => {
      const newShots = [...prev];
      const [movedShot] = newShots.splice(fromIndex, 1);
      newShots.splice(toIndex, 0, movedShot);
      return newShots.map((shot, index) => ({ ...shot, index }));
    });
  }, [shots.length]);

  const getStatusText = (status?: StoryboardShot['status']) => {
    if (!status) return '待生成';
    const statusMap: Record<string, string> = {
      pending: '等待生成',
      'generating-images': '生成九宫格中',
      'images-generated': '九宫格已生成',
      'images_generated': '九宫格已生成',
      'generating-video': '生成视频中',
      'video_generated': '视频已生成',
      completed: '已完成',
      failed: '生成失败'
    };
    return statusMap[status] || status;
  };

  const renderShotCard = (shot: StoryboardShot, index: number) => {
    const isFirst = index === 0;
    const isLast = index === shots.length - 1;
    
    // 将参考图片字符串转换为数组
    const referenceImages = shot.referenceImage ? shot.referenceImage.split(IMAGE_SEP).filter(Boolean) : [];
    
    return (
      <Card key={shot.id} className="border-border bg-accent/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 bg-[#EF4444] text-black rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                {!isFirst && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-foreground/70 hover:text-foreground"
                    onClick={() => moveShot(index, index - 1)}
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </Button>
                )}
                {!isLast && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-foreground/70 hover:text-foreground"
                    onClick={() => moveShot(index, index + 1)}
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </Button>
                )}
              </div>
              <div className="flex-1">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  分镜头 {index + 1}
                  <span className="text-xs px-2 py-0.5 bg-accent/50 rounded-full text-muted-foreground">
                    {shot.duration}秒
                  </span>
                  {shot.status !== 'pending' && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      shot.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      shot.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {shot.status === 'completed' && <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
                      {shot.status === 'failed' && <AlertCircle className="w-3 h-3 mr-1 inline" />}
                      {shot.status === 'generating-images' && <RefreshCw className="w-3 h-3 mr-1 inline animate-spin" />}
                      {shot.status === 'generating-video' && <Film className="w-3 h-3 mr-1 inline animate-spin" />}
                      {shot.status === 'images-generated' && <ImageIcon className="w-3 h-3 mr-1 inline" />}
                      {getStatusText(shot.status)}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-xs mt-1">
                  {!isFirst && '首帧与前一段尾帧一致 · '}
                  {shot.nineGridImages?.length ? `${shot.nineGridImages.length}张九宫格图片` : '待生成九宫格图片'}
                  {referenceImages.length > 0 && ` · ${referenceImages.length}张参考图片`}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground/70 hover:text-foreground"
                disabled={isGenerating}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground/70 hover:text-red-400"
                onClick={() => removeShot(shot.id)}
                disabled={isGenerating || shots.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground/70 text-sm">分镜头描述</Label>
            <Textarea
              placeholder="描述这个分镜头的内容..."
              value={shot.prompt}
              onChange={(e) => updateShot(shot.id, { prompt: e.target.value })}
              className="h-24 bg-black/30 border-border"
              disabled={isGenerating}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                时长（秒）
              </Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={shot.duration}
                onChange={(e) => {
                  const duration = Math.min(15, Math.max(1, parseInt(e.target.value) || 8)); // 优化：上限从10s提升到15s
                  updateShot(shot.id, { duration });
                }}
                className="bg-black/30 border-border"
                disabled={isGenerating}
              />
              <p className="text-xs text-muted-foreground">单段时长不超过10秒</p>
            </div>

            {/* ★ 镜头级特效音选择 */}
            <div className="space-y-2">
              <Label className="text-foreground/70 text-sm flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                特效音（可选）
              </Label>
              {shotSfxMap.has(index) ? (
                <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                  {(() => {
                    const selected = shotSfxMap.get(index)!;
                    const sfxDef = SFX_CATEGORIES.flatMap(c => getSfxByCategory(c.id)).find(s => s.id === selected.sfxId);
                    return (
                      <>
                        <span className="text-xs">{sfxDef?.icon || '🔊'}</span>
                        <span className="text-xs font-medium text-red-300 flex-1 truncate">{sfxDef?.name || selected.sfxId}</span>
                        <span className="text-[10px] text-foreground/70">+{selected.timeOffset}s</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newMap = new Map(shotSfxMap);
                            newMap.delete(index);
                            setShotSfxMap(newMap);
                          }}
                          className="w-5 h-5 rounded bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] hover:bg-red-500/30"
                        >
                          ×
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSfxPickerForShot(showSfxPickerForShot === index ? null : index)}
                  className="w-full text-xs text-muted-foreground border-white/20 hover:text-red-400 hover:border-red-500/30"
                >
                  + 为此镜头添加特效音
                </Button>
              )}

              {/* ★ 特效音选择弹窗 */}
              {showSfxPickerForShot === index && (
                <div className="space-y-2 p-3 bg-black/40 border border-border rounded-lg">
                  <div className="text-[10px] text-foreground/70 mb-1">选择一个特效音绑定到镜头 {index + 1}</div>
                  <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {SFX_CATEGORIES.map(cat => (
                      getSfxByCategory(cat.id).slice(0, 4).map(sfx => (
                        <button
                          key={sfx.id}
                          type="button"
                          onClick={() => {
                            setShotSfxMap(prev => new Map(prev).set(index, { sfxId: sfx.id, timeOffset: 0 }));
                            setShowSfxPickerForShot(null);
                          }}
                          className={`p-1.5 rounded border text-left transition-all ${
                            shotSfxMap.get(index)?.sfxId === sfx.id
                              ? 'border-red-500/50 bg-red-500/15'
                              : 'border-border bg-accent/30 hover:bg-accent'
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-[10px]">{sfx.icon}</span>
                            <span className="text-[10px] font-medium text-foreground/70 truncate">{sfx.name}</span>
                          </div>
                          <div className="text-[9px] text-foreground/25 line-clamp-1">{sfx.description}</div>
                        </button>
                      ))
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSfxPickerForShot(null)}
                      className="h-6 text-[10px] text-foreground/70"
                    >
                      关闭
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-foreground/70 text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              参考图片（可选）
            </Label>
            {!shot.referenceImage ? (
              <div className="border-2 border-dashed border-white/20 rounded-lg p-6 hover:border-[#EF4444] transition-colors">
                <label className="flex flex-col items-center justify-center cursor-pointer">
                  <ImageIcon className="w-8 h-8 text-foreground/70 mb-2" />
                  <span className="text-sm text-muted-foreground">点击上传参考图片</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(shot.id, e)}
                    disabled={isGenerating}
                    multiple
                  />
                </label>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {/* 显示已上传的图片 */}
                  {referenceImages.length > 0 && referenceImages.map((imageUrl, imgIndex) => {
                    // 调试：检查图片URL格式
                    const isDataUrl = imageUrl && imageUrl.startsWith('data:image');
                    console.log(`[ImageDisplay] 图片${imgIndex + 1}:`, isDataUrl ? '是DataURL, 长度:' + imageUrl.length : imageUrl);
                    return (
                    <div key={imgIndex} className="relative aspect-video rounded-lg overflow-hidden border border-border">
                      {isDataUrl ? (
                        <img
                          src={imageUrl}
                          alt={`参考图片${imgIndex + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-accent/50">
                          <span className="text-xs text-muted-foreground">图片格式不支持</span>
                        </div>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => handleRemoveImage(shot.id, imgIndex)}
                        disabled={isGenerating}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )})}
                  
                  {/* 上传更多图片的按钮 */}
                  {referenceImages.length > 0 && referenceImages.length < 9 && (
                    <div className="border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center hover:border-[#EF4444] transition-colors cursor-pointer">
                      <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                        <Plus className="w-6 h-6 text-foreground/70 mb-1" />
                        <span className="text-xs text-muted-foreground">添加更多</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(shot.id, e)}
                          disabled={isGenerating}
                          multiple
                        />
                      </label>
                    </div>
                  )}
                </div>
                
                {/* 开关控件 */}
                {referenceImages.length > 0 && (
                  <div className="flex items-center justify-between bg-accent/30 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">使用此图片代替九宫格</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {shot.useReferenceAsNineGrid 
                          ? '直接使用上传的图片作为视频素材' 
                          : '以上传图片为参考生成9张九宫格'}
                      </p>
                    </div>
                    <Switch
                      checked={shot.useReferenceAsNineGrid || false}
                      onCheckedChange={(checked) => updateShot(shot.id, { useReferenceAsNineGrid: checked })}
                      disabled={isGenerating}
                    />
                  </div>
                )}
                
                {shot.useReferenceAsNineGrid && referenceImages.length > 0 && (
                  <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3">
                    <p className="text-xs text-[#EF4444]">
                      <strong>提示：</strong>您可以直接上传9张图片，或者只上传1张让系统基于它生成连贯的9张图片。
                      {referenceImages.length < 9 && ` 还需要上传${9 - referenceImages.length}张。`}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {shot.nineGridImages && shot.nineGridImages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground/70 text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  九宫格图片
                </Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {shot.nineGridImages.map((imageUrl, imgIndex) => (
                  <div key={imgIndex} className="relative">
                    <div className="aspect-square bg-black rounded-lg overflow-hidden border border-border">
                      <img
                        src={imageUrl}
                        alt={`分镜头${index + 1} - 图片${imgIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {shot.videoUrl && (
            <div className="space-y-2">
              <Label className="text-foreground/70 text-sm flex items-center gap-2">
                <Film className="w-4 h-4" />
                生成的视频
              </Label>
              <div className="aspect-video bg-black rounded-lg overflow-hidden border border-border">
                <video src={shot.videoUrl} controls className="w-full h-full" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-gradient-to-r from-[#EF4444]/10 to-[#B4E22F]/10">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-white flex items-center gap-2">
                <Film className="w-6 h-6 text-[#EF4444]" />
                分镜头视频编辑器
              </CardTitle>
              <CardDescription>
                创建分镜头提示词，每段不超过10秒，最后组合成超过10秒的视频
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={`text-lg font-bold ${isDurationValid ? 'text-[#EF4444]' : 'text-red-400'}`}>
                <Clock className="w-5 h-5 inline mr-1" />
                {totalDuration}秒
              </div>
              <div className={`text-xs ${isDurationValid ? 'text-green-400' : 'text-red-400'}`}>
                {isDurationValid ? '✓ 总时长超过10秒' : '✗ 总时长需要超过10秒'}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-foreground/70 text-sm">项目名称</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入分镜头视频项目名称..."
                className="bg-black/30 border-border"
                disabled={isGenerating}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={addShot}
                disabled={isGenerating}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                添加分镜头
              </Button>
              <Button
                variant="default"
                onClick={() => setShowPromptGenerator(true)}
                disabled={isGenerating}
                className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0"
              >
                <SparklesIcon className="w-4 h-4 mr-2" />
                提示词助手
              </Button>
              {onGenerate && (
                <Button
                  className="flex-1 bg-gradient-to-r from-[#EF4444] to-[#B4E22F] hover:opacity-90 text-black"
                  onClick={() => {
                    if (!isDurationValid) {
                      alert(`总时长不足10秒（当前${totalDuration}秒），请调整分镜头时长`);
                      return;
                    }
                    // 传递音频设置到父组件
                    if (onAudioSettingsChange) {
                      onAudioSettingsChange({
                        enableVoiceNarration,
                        voiceNarrationText,
                        backgroundBgm,
                        customAudio,
                        libraryTrack: backgroundBgm === 'library' ? selectedLibraryTrack : undefined,  // ★ 音乐库曲目
                      });
                    }
                    onGenerate();
                  }}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      生成分镜头视频
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {/* 音频设置面板 */}
            <div className="mt-4 p-4 bg-accent/30 rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Music className="w-4 h-4 text-[#EF4444]" />
                <span className="text-sm font-medium text-white">音频设置</span>
                <span className="text-xs text-muted-foreground ml-auto">语音旁白默认开启</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 背景音乐选择 — v2.0 卡片式选择器 */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-foreground/70">背景音乐</Label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 max-h-[140px] overflow-y-auto pr-0.5">
                    <button
                      type="button"
                      onClick={() => setBackgroundBgm('none')}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded border transition-all text-[10px] ${
                        backgroundBgm === 'none'
                          ? 'bg-secondary/20 border-gray-400/50 ring-1 ring-gray-400/30'
                          : 'bg-accent/30 border-border hover:bg-accent'
                      }`}
                    >
                      <span>🔇</span><span>无</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackgroundBgm('custom')}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded border transition-all text-[10px] ${
                        backgroundBgm === 'custom'
                          ? 'bg-red-500/20 border-red-400/50 ring-1 ring-blue-400/30'
                          : 'bg-accent/30 border-border hover:bg-accent'
                      }`}
                    >
                      <span>📁</span><span>自定义</span>
                    </button>
                    {getBgmTypeList().map((bgm) => (
                      <button
                        key={bgm.id}
                        type="button"
                        onClick={() => setBackgroundBgm(bgm.id)}
                        title={`${bgm.name}: ${bgm.description}`}
                        className={`flex flex-col items-center gap-0.5 p-1.5 rounded border transition-all text-[10px] ${
                          backgroundBgm === bgm.id
                            ? `${bgm.bgColor} ${bgm.borderColor} ring-1 ring-current/20`
                            : 'bg-accent/30 border-border hover:bg-accent'
                        }`}
                      >
                        <span>{bgm.icon}</span>
                        <span className="truncate w-full text-center">{bgm.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* ★ 公开音乐库入口 */}
                  <button
                    type="button"
                    onClick={() => setShowMusicLibrary(true)}
                    className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all mt-1 ${
                      selectedLibraryTrack
                        ? 'bg-red-500/15 border border-red-500/30 text-red-300'
                        : 'bg-accent/30 border border-border text-muted-foreground hover:bg-accent hover:text-foreground/70'
                    }`}
                  >
                    <Library className="w-3.5 h-3.5" />
                    {selectedLibraryTrack ? (
                      <span className="truncate">已选: {selectedLibraryTrack.title}</span>
                    ) : (
                      <>从音乐库选择</>
                    )}
                  </button>
                </div>
                {/* 语音旁白设置 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-foreground/70">语音旁白</Label>
                    <Switch
                      checked={enableVoiceNarration}
                      onCheckedChange={setEnableVoiceNarration}
                      className="scale-75"
                    />
                  </div>
                  {enableVoiceNarration && (
                    <Textarea
                      placeholder="自定义旁白内容（留空则自动基于分镜头描述生成）"
                      value={voiceNarrationText}
                      onChange={(e) => setVoiceNarrationText(e.target.value)}
                      className="h-16 bg-black/30 border-white/20 text-sm"
                    />
                  )}
                </div>

                {/* 自定义音频上传 */}
                {backgroundBgm === 'custom' && (
                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <Label className="text-xs text-foreground/70 flex items-center gap-2">
                      <Upload className="w-3 h-3" />
                      上传自定义音频
                    </Label>
                    {customAudio ? (
                      <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-[#EF4444]/30">
                        <div className="flex-1">
                          <p className="text-sm text-white truncate">{customAudio.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(customAudio.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <audio 
                          src={customAudio.url} 
                          controls 
                          className="h-8 w-40"
                        />
                        <button
                          onClick={() => setCustomAudio(null)}
                          className="p-2 text-red-400 hover:text-red-300 transition-colors"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:border-[#EF4444]/50 transition-colors">
                        <input
                          type="file"
                          id="custom-audio-storyboard"
                          accept="audio/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/aac'];
                            if (!validTypes.includes(file.type)) {
                              alert('请上传音频文件（支持 MP3、WAV、OGG、M4A、AAC 格式）');
                              return;
                            }
                            
                            if (file.size > 50 * 1024 * 1024) {
                              alert('音频文件大小不能超过 50MB');
                              return;
                            }
                            
                            setIsUploadingAudio(true);
                            try {
                              const formData = new FormData();
                              formData.append('file', file);
                              formData.append('type', 'audio');
                              
                              const response = await fetch('/api/upload', {
                                method: 'POST',
                                body: formData,
                              });
                              
                              const data = await response.json();
                              if (data.success && data.url) {
                                setCustomAudio({
                                  url: data.url,
                                  name: file.name,
                                  size: file.size,
                                });
                              } else {
                                alert(data.error || '音频上传失败');
                              }
                            } catch (error) {
                              console.error('音频上传失败:', error);
                              alert('音频上传失败，请重试');
                            } finally {
                              setIsUploadingAudio(false);
                            }
                          }}
                          disabled={isGenerating || isUploadingAudio}
                          className="hidden"
                        />
                        <label
                          htmlFor="custom-audio-storyboard"
                          className={`cursor-pointer ${isGenerating || isUploadingAudio ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isUploadingAudio ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-6 h-6 border-2 border-[#EF4444] border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm text-muted-foreground">上传中...</span>
                            </div>
                          ) : (
                            <>
                              <Upload className="w-6 h-6 mx-auto mb-2 text-foreground/70" />
                              <span className="text-sm text-muted-foreground">点击上传音频文件</span>
                              <p className="text-xs text-foreground/70 mt-1">支持 MP3、WAV、OGG、M4A、AAC（最大50MB）</p>
                            </>
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#EF4444]" />
            分镜头列表 ({shots.length})
          </h3>
          <p className="text-sm text-muted-foreground">每段分镜头先生成九宫格图片，然后生成视频</p>
        </div>
        {shots.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            还没有分镜头，请点击上方"添加分镜头"按钮开始创建
          </div>
        )}
        <div className="grid gap-4">
          {shots.map((shot, index) => {
            console.log('[StoryboardEditor] Rendering shot', index + 1, 'id:', shot.id);
            return renderShotCard(shot, index);
          })}
        </div>
        <Button
          variant="secondary"
          onClick={addShot}
          disabled={isGenerating}
          className="w-full border-dashed border-2"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加分镜头
        </Button>
      </div>

      <Dialog open={showPromptGenerator} onOpenChange={setShowPromptGenerator}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <SparklesIcon className="w-6 h-6 text-[#EF4444]" />
              视频提示词生成助手
            </DialogTitle>
            <DialogDescription>
              基于专业的视频提示词方法库和100个运镜方法，帮助您快速生成高质量提示词
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <VideoPromptGenerator 
              onPromptGenerated={handlePromptGenerated}
              subtitleSegments={shots.map(s => ({
                id: s.id,
                text: s.prompt,
                startTime: 0, // 分镜编辑器中不需要精确时间
                endTime: s.duration,
              }))}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ★ 公开音乐库浏览器 */}
      <MusicLibraryBrowser
        open={showMusicLibrary}
        onClose={() => setShowMusicLibrary(false)}
        onSelectTrack={(track) => {
          setSelectedLibraryTrack(track);
          setBackgroundBgm('library');
          setShowMusicLibrary(false);
        }}
        selectedId={selectedLibraryTrack?.id}
      />
    </div>
  );
}
