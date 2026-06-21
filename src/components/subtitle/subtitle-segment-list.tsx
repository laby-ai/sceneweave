'use client';

import { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { GripVertical, Plus, Settings, Trash2, Type, Users } from 'lucide-react';
import {
  formatTime,
  parseTime,
  SpeakerInfo,
  SubtitleConfig,
  SubtitleSegment,
} from '@/constants/subtitles';

interface SubtitleSegmentListProps {
  config: SubtitleConfig;
  disabled: boolean;
  videoDuration: number;
  showSpeakerManager: boolean;
  setShowSpeakerManager: Dispatch<SetStateAction<boolean>>;
  updateConfig: (updates: Partial<SubtitleConfig>) => void;
  updateSegment: (segmentId: string, updates: Partial<SubtitleSegment>) => void;
  deleteSegment: (segmentId: string) => void;
  handleAddSpeaker: () => void;
  handleUpdateSpeaker: (speakerId: string, field: keyof SpeakerInfo, value: string) => void;
  handleDeleteSpeaker: (speakerId: string) => void;
  handleInitDefaultSpeakers: () => void;
}

export function SubtitleSegmentList({
  config,
  disabled,
  videoDuration,
  showSpeakerManager,
  setShowSpeakerManager,
  updateConfig,
  updateSegment,
  deleteSegment,
  handleAddSpeaker,
  handleUpdateSpeaker,
  handleDeleteSpeaker,
  handleInitDefaultSpeakers,
}: SubtitleSegmentListProps) {
  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-red-500/10 to-red-500/10 border border-red-500/20">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-red-400" />
          <span className="text-xs font-medium">多人访谈模式</span>
          {config.speakers && config.speakers.length > 0 ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              已启用 ({config.speakers.length}人)
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">为每段字幕指定说话人</span>
          )}
        </div>
        <Switch
          checked={(config.speakers?.length ?? 0) > 0}
          onCheckedChange={(checked) => {
            if (checked) {
              handleInitDefaultSpeakers();
            } else {
              updateConfig({
                speakers: [],
                segments: config.segments.map(seg => ({ ...seg, speakerId: undefined })),
              });
              setShowSpeakerManager(false);
            }
          }}
          disabled={disabled}
        />
      </div>

      {config.speakers && config.speakers.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">说话人:</span>
          <div className="flex gap-1.5 flex-wrap">
            {config.speakers.map((speaker) => (
              <div
                key={speaker.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: `${speaker.color}20`,
                  color: speaker.color,
                  border: `1px solid ${speaker.color}40`,
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: speaker.color }} />
                {speaker.name}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setShowSpeakerManager(!showSpeakerManager)}
            disabled={disabled}
            title="管理说话人"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {showSpeakerManager && (
        <Card className="border border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">说话人列表</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSpeaker}
                disabled={disabled}
                className="h-7 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-300"
              >
                <Plus className="w-3 h-3 mr-1" />
                添加
              </Button>
            </div>
            {(config.speakers || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                暂无说话人，点击"添加"创建
              </p>
            ) : (
              <div className="space-y-2">
                {(config.speakers || []).map((speaker, idx) => (
                  <div key={speaker.id} className="flex items-center gap-2 p-2 rounded bg-accent/30">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: speaker.color }}
                    />
                    <Input
                      value={speaker.name}
                      onChange={(event) => handleUpdateSpeaker(speaker.id, 'name', event.target.value)}
                      className="h-7 text-xs flex-1 bg-transparent border-none px-0 focus-visible:ring-0"
                      disabled={disabled}
                      placeholder={`说话人${idx + 1}`}
                    />
                    <Select
                      value={speaker.position}
                      onValueChange={(value) => handleUpdateSpeaker(speaker.id, 'position', value as SpeakerInfo['position'])}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-7 w-20 text-xs bg-accent/30 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">左</SelectItem>
                        <SelectItem value="center">中</SelectItem>
                        <SelectItem value="right">右</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDeleteSpeaker(speaker.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {!config.speakers || config.speakers.length === 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInitDefaultSpeakers}
                disabled={disabled}
                className="w-full text-xs bg-accent/30 hover:bg-accent"
              >
                初始化默认说话人（主持人+嘉宾）
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {config.segments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Type className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>暂无字幕分段</p>
          <p className="text-sm">点击"添加分段"开始创建字幕</p>
        </div>
      ) : (
        config.segments.map((segment, index) => (
          <Card key={segment.id} className="border border-border">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">分段 {index + 1}</span>
                  {config.speakers && config.speakers.length > 0 && (
                    <Select
                      value={segment.speakerId || 'none'}
                      onValueChange={(value) => updateSegment(segment.id, { speakerId: value === 'none' ? undefined : value })}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-6 w-auto text-xs bg-accent/30 border-border px-2">
                        <SelectValue placeholder="说话人" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">无</span>
                        </SelectItem>
                        {config.speakers.map((speaker) => {
                          const isSelected = segment.speakerId === speaker.id;
                          return (
                            <SelectItem key={speaker.id} value={speaker.id}>
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: speaker.color }}
                                />
                                <span style={{ color: isSelected ? speaker.color : undefined }}>
                                  {speaker.name}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground font-mono">
                    {formatTime(segment.startTime)} → {formatTime(segment.endTime)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => deleteSegment(segment.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <Textarea
                value={segment.text}
                onChange={(event) => updateSegment(segment.id, { text: event.target.value })}
                placeholder="输入字幕内容..."
                className="min-h-[60px] resize-none bg-accent/30 border-border"
                disabled={disabled}
              />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">开始时间</Label>
                  <Input
                    value={formatTime(segment.startTime)}
                    onChange={(event) => {
                      const time = parseTime(event.target.value);
                      updateSegment(segment.id, { startTime: Math.max(0, time) });
                    }}
                    className="h-8 text-xs font-mono bg-accent/30 border-border"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">结束时间</Label>
                  <Input
                    value={formatTime(segment.endTime)}
                    onChange={(event) => {
                      const time = parseTime(event.target.value);
                      updateSegment(segment.id, { endTime: Math.min(videoDuration, time) });
                    }}
                    className="h-8 text-xs font-mono bg-accent/30 border-border"
                    disabled={disabled}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
