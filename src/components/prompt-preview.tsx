'use client';

import React, { useState, useCallback } from 'react';
import {
  X,
  Eye,
  Pencil,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wand2,
} from 'lucide-react';

export interface PromptData {
  /** 原始用户输入 */
  original: string;
  /** AI 优化后提示词（可选） */
  enhanced?: string;
  /** 负面提示词（可选） */
  negative?: string;
  /** 生成参数 */
  params?: {
    duration?: string;
    aspectRatio?: string;
    style?: string;
    model?: string;
    [key: string]: string | undefined;
  };
  /** 类型：video / image / film */
  type: 'video' | 'image' | 'film';
  /** 关联的媒体 URL（可选，用于预览） */
  mediaUrl?: string;
  /** 媒体类型 */
  mediaType?: 'video' | 'image';
}

interface PromptPreviewProps {
  open: boolean;
  data: PromptData | null;
  onClose: () => void;
  /** 提交修改后的提示词 */
  onApply?: (modified: string, negativeModified?: string) => void;
  /** 触发 AI 重新优化 */
  onReEnhance?: (prompt: string) => void;
}

export function PromptPreview({ open, data, onClose, onApply, onReEnhance }: PromptPreviewProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [editedNegative, setEditedNegative] = useState('');
  const [copied, setCopied] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const displayPrompt = data?.enhanced || data?.original || '';

  const handleOpenEdit = useCallback(() => {
    if (data) {
      setEditedPrompt(displayPrompt);
      setEditedNegative(data.negative || '');
      setEditMode(true);
    }
  }, [data, displayPrompt]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setEditedPrompt('');
    setEditedNegative('');
  }, []);

  const handleApply = useCallback(() => {
    if (onApply) {
      onApply(editedPrompt, editedNegative);
    }
    setEditMode(false);
  }, [editedPrompt, editedNegative, onApply]);

  const handleCopy = useCallback(async () => {
    const text = editMode ? editedPrompt : displayPrompt;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
    }
  }, [editMode, editedPrompt, displayPrompt]);

  const handleReEnhance = useCallback(() => {
    if (onReEnhance) {
      onReEnhance(editMode ? editedPrompt : displayPrompt);
    }
  }, [editMode, editedPrompt, displayPrompt, onReEnhance]);

  if (!open || !data) return null;

  const typeLabel = data.type === 'video' ? 'AI 视频' : data.type === 'image' ? 'AI 图像' : '影视创作';
  const typeColor = data.type === 'video' ? 'violet' : data.type === 'image' ? 'emerald' : 'amber';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 主面板 */}
      <div className="relative w-full max-w-2xl mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg bg-${typeColor}-100 flex items-center justify-center`}>
              <Eye className={`w-4 h-4 text-${typeColor}-600`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">查看提示词</h3>
              <span className={`text-[11px] text-${typeColor}-600 font-medium`}>{typeLabel}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-accent flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 媒体预览（如有） */}
          {data.mediaUrl && (
            <div className="rounded-xl overflow-hidden bg-secondary aspect-video">
              {data.mediaType === 'video' ? (
                <video src={data.mediaUrl} className="w-full h-full object-contain" controls muted />
              ) : (
                <img src={data.mediaUrl} alt="preview" className="w-full h-full object-contain" />
              )}
            </div>
          )}

          {/* 提示词区域 */}
          {!editMode ? (
            <div className="space-y-3">
              {/* 查看模式 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {data.enhanced ? 'AI 优化后提示词' : '提示词'}
                  </label>
                  <div className="flex items-center gap-1">
                    {data.enhanced && (
                      <button
                        onClick={() => setShowOriginal(!showOriginal)}
                        className="text-[11px] text-foreground/70 hover:text-muted-foreground px-2 py-0.5 rounded hover:bg-accent/50 transition-colors"
                      >
                        {showOriginal ? '隐藏原文' : '查看原文'}
                      </button>
                    )}
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-[11px] text-foreground/70 hover:text-muted-foreground px-2 py-0.5 rounded hover:bg-accent/50 transition-colors"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {displayPrompt}
                </div>
              </div>

              {/* 原始提示词（折叠） */}
              {data.enhanced && showOriginal && (
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">原始提示词</label>
                  <div className="px-4 py-3 rounded-xl bg-card border border-border text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {data.original}
                  </div>
                </div>
              )}

              {/* 负面提示词 */}
              {data.negative && (
                <div>
                  <label className="text-xs font-medium text-foreground/70 mb-1.5 block">负面提示词</label>
                  <div className="px-4 py-3 rounded-xl bg-red-50/50 border border-red-100/70 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {data.negative}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 编辑模式 */
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">编辑提示词</label>
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground/80 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-red-300 transition-all min-h-[120px]"
                  placeholder="输入你的提示词..."
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground/70 mb-1.5 block">负面提示词</label>
                <textarea
                  value={editedNegative}
                  onChange={(e) => setEditedNegative(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-red-50/30 border border-red-100/50 text-sm text-muted-foreground leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-200 transition-all min-h-[60px]"
                  placeholder="不想出现的内容..."
                />
              </div>
            </div>
          )}

          {/* 生成参数 */}
          {data.params && Object.keys(data.params).length > 0 && (
            <div>
              <button
                onClick={() => setShowParams(!showParams)}
                className="flex items-center gap-1 text-xs text-foreground/70 hover:text-muted-foreground transition-colors"
              >
                {showParams ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                生成参数
              </button>
              {showParams && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Object.entries(data.params).map(([key, value]) => (
                    value ? (
                      <div key={key} className="px-3 py-2 rounded-lg bg-accent/30 border border-border">
                        <span className="text-[10px] text-foreground/70 block">{key}</span>
                        <span className="text-xs text-foreground/70 font-medium">{value}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="px-5 py-3.5 border-t border-border bg-accent/30/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!editMode ? (
              <>
                <button
                  onClick={handleOpenEdit}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-foreground/70 bg-card border border-border hover:border-white/20 hover:bg-accent/50 transition-all"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  修改提示词
                </button>
                <button
                  onClick={handleReEnhance}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-red-700 bg-red-50 border border-violet-200 hover:bg-red-100 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI 重新优化
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent/50 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  取消
                </button>
                <button
                  onClick={handleApply}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-foreground bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  应用修改
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground/70 hover:bg-accent transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
