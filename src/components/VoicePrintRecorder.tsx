'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Save,
  Upload,
  FileAudio,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
  User,
  Settings,
  RefreshCw,
} from 'lucide-react';
import {
  VoicePrint,
  formatDuration,
  validateAudio,
  createVoicePrint,
  saveVoicePrintsMeta,
  SAMPLE_RATES,
  DEFAULT_RECORDING_DURATION,
  MIN_RECORDING_DURATION,
  MAX_RECORDING_DURATION,
} from '@/types/voiceprint';

interface VoicePrintRecorderProps {
  onVoicePrintSave?: (voicePrint: VoicePrint) => void;
  disabled?: boolean;
}

export function VoicePrintRecorder({
  onVoicePrintSave,
  disabled = false,
}: VoicePrintRecorderProps) {
  const [voicePrints, setVoicePrints] = useState<VoicePrint[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSampleRate, setSelectedSampleRate] = useState(44100);
  const [voicePrintName, setVoicePrintName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);

  // 开始录制
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioUrl(null);
      setVoicePrintName('');
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: selectedSampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      recordingStartRef.current = Date.now();
      
      // 开始计时
      recordingIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartRef.current) / 1000;
        setRecordingTime(elapsed);
        
        // 达到最大时长自动停止
        if (elapsed >= MAX_RECORDING_DURATION) {
          stopRecording();
        }
      }, 100);
      
    } catch (err) {
      console.error('开始录制失败:', err);
      setError('无法访问麦克风，请检查权限设置');
    }
  }, [selectedSampleRate]);

  // 停止录制
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording]);

  // 播放/暂停音频
  const togglePlayback = useCallback(() => {
    if (!audioUrl) return;

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying]);

  // 保存声纹
  const saveVoicePrint = useCallback(async () => {
    if (!audioUrl) {
      setError('请先录制音频');
      return;
    }

    if (!voicePrintName.trim()) {
      setError('请输入声纹名称');
      return;
    }

    if (recordingTime < MIN_RECORDING_DURATION) {
      setError(`录制时长至少需要 ${MIN_RECORDING_DURATION} 秒`);
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // 获取音频blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // 验证音频
      const validation = validateAudio(audioBlob);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 创建声纹对象
      const voicePrint = createVoicePrint(
        voicePrintName.trim(),
        audioBlob,
        audioUrl,
        recordingTime,
        selectedSampleRate
      );

      // 添加到列表
      const updatedList = [voicePrint, ...voicePrints];
      setVoicePrints(updatedList);
      
      // 保存元数据
      saveVoicePrintsMeta(updatedList);
      
      // 回调
      if (onVoicePrintSave) {
        onVoicePrintSave(voicePrint);
      }

      // 显示成功消息
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // 重置
      setAudioUrl(null);
      setVoicePrintName('');
      setRecordingTime(0);
      audioChunksRef.current = [];

    } catch (err) {
      console.error('保存声纹失败:', err);
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsProcessing(false);
    }
  }, [
    audioUrl,
    voicePrintName,
    recordingTime,
    selectedSampleRate,
    voicePrints,
    onVoicePrintSave,
  ]);

  // 删除声纹
  const deleteVoicePrint = useCallback((voicePrintId: string) => {
    const updatedList = voicePrints.filter(vp => vp.id !== voicePrintId);
    setVoicePrints(updatedList);
    saveVoicePrintsMeta(updatedList);
  }, [voicePrints]);

  // 清理
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* 主卡片 */}
      <Card className="border border-border bg-gradient-to-br from-[#EF4444]/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-[#EF4444]" />
            声纹录入
          </CardTitle>
          <CardDescription>
            录制您的声音，创建专属声纹用于数字人配音
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* 成功提示 */}
          {showSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm">声纹保存成功！</span>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
              <XCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Tabs defaultValue="record" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="record">
                <Mic className="w-4 h-4 mr-2" />
                录制
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" />
                上传
              </TabsTrigger>
            </TabsList>

            {/* 录制标签 */}
            <TabsContent value="record" className="space-y-4 pt-4">
              {/* 采样率选择 */}
              <div className="space-y-2">
                <Label>采样率</Label>
                <Select
                  value={selectedSampleRate.toString()}
                  onValueChange={(val) => setSelectedSampleRate(parseInt(val))}
                  disabled={isRecording || disabled}
                >
                  <SelectTrigger className="bg-accent/30 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_RATES.map((rate) => (
                      <SelectItem key={rate.value} value={rate.value.toString()}>
                        {rate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 录制控制 */}
              <div className="flex flex-col items-center gap-4 p-6 bg-black/30 rounded-lg border border-border">
                {/* 录制状态指示器 */}
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <>
                      <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-400 font-medium">正在录制</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4 text-foreground/70" />
                      <span className="text-foreground/70">等待录制</span>
                    </>
                  )}
                </div>

                {/* 计时显示 */}
                <div className="text-center">
                  <div className="text-4xl font-mono text-[#EF4444]">
                    {formatDuration(recordingTime)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {MIN_RECORDING_DURATION}s 最低 · {MAX_RECORDING_DURATION}s 最高
                  </div>
                </div>

                {/* 录制按钮 */}
                <div className="flex gap-4">
                  {isRecording ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      onClick={stopRecording}
                      className="w-32"
                    >
                      <Square className="w-5 h-5 mr-2" />
                      停止
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={startRecording}
                      disabled={disabled}
                      className="w-32 border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444]/10 hover:border-[#EF4444]"
                    >
                      <Mic className="w-5 h-5 mr-2" />
                      开始录制
                    </Button>
                  )}
                </div>

                {/* 进度条 */}
                <div className="w-full max-w-xs">
                  <div className="h-2 bg-accent/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#EF4444] transition-all duration-100"
                      style={{
                        width: `${Math.min((recordingTime / MAX_RECORDING_DURATION) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 音频预览 */}
              {audioUrl && (
                <div className="space-y-4 p-4 bg-accent/30 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <FileAudio className="w-4 h-4" />
                      录制预览
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={togglePlayback}
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    controls
                    className="w-full"
                  />
                </div>
              )}

              {/* 保存表单 */}
              {audioUrl && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="space-y-2">
                    <Label>声纹名称 <span className="text-red-500">*</span></Label>
                    <Input
                      value={voicePrintName}
                      onChange={(e) => setVoicePrintName(e.target.value)}
                      placeholder="例如：我的声音-1"
                      className="bg-accent/30 border-border"
                      disabled={isProcessing}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={saveVoicePrint}
                    disabled={isProcessing || recordingTime < MIN_RECORDING_DURATION || !voicePrintName.trim()}
                    className="w-full bg-[#EF4444] text-black hover:bg-[#EF4444]/90"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        保存声纹
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* 上传标签 */}
            <TabsContent value="upload" className="space-y-4 pt-4">
              <div className="p-6 border-2 border-dashed border-white/20 rounded-lg text-center">
                <FileAudio className="w-12 h-12 mx-auto mb-3 text-foreground/30" />
                <p className="text-muted-foreground mb-2">支持上传音频文件</p>
                <p className="text-xs text-foreground/70 mb-4">
                  格式：MP3, WAV, WEBM · 最大 50MB
                </p>
                <Input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  id="audio-upload"
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => document.getElementById('audio-upload')?.click()}
                  disabled={disabled}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  选择文件
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 声纹列表 */}
      {voicePrints.length > 0 && (
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg">我的声纹</CardTitle>
            <CardDescription>
              已保存 {voicePrints.length} 个声纹
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {voicePrints.map((voicePrint) => (
              <div
                key={voicePrint.id}
                className="flex items-center justify-between p-3 bg-accent/30 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#EF4444]/20 rounded-lg">
                    <User className="w-5 h-5 text-[#EF4444]" />
                  </div>
                  <div>
                    <div className="font-medium">{voicePrint.name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(voicePrint.duration)}
                      </span>
                      <span>{voicePrint.sampleRate} Hz</span>
                      {voicePrint.isVerified && (
                        <span className="text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          已验证
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <audio src={voicePrint.audioUrl} controls className="h-8" />
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Settings className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>声纹管理</DialogTitle>
                        <DialogDescription>
                          {voicePrint.name}
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={() => deleteVoicePrint(voicePrint.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}