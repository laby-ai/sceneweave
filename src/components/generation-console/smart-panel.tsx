'use client';

import React, { useRef } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';

interface SmartMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SmartPanelProps {
  open: boolean;
  messages: SmartMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function SmartPanel({
  open,
  messages,
  input,
  onInputChange,
  onSend,
  onClose,
  isLoading,
}: SmartPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="mb-3 bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="w-4 h-4 text-red-500" />
          <span>绘影精灵</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg">
          <X className="w-4 h-4 text-foreground/70" />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-foreground/70 text-center py-4">
            输入您的创作需求，绘影精灵将为您智能匹配最佳方案
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5 text-red-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-red-600 text-white rounded-br-md'
                  : 'bg-secondary text-foreground rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="描述您的需求..."
            className="flex-1 px-3 py-2 bg-card rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500/20"
          />
          <button
            onClick={onSend}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
