'use client';

import React from 'react';

export function ConsoleTypeButton({
  active,
  onClick,
  onDoubleClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleClick?.();
      }}
      className={`flex min-h-11 min-w-[calc(50%-0.1875rem)] items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all sm:min-w-[104px] sm:px-4 ${
        active
          ? 'bg-gradient-to-r from-[#4F6CFF] to-[#8B5CF6] text-white shadow-md shadow-[#4F6CFF]/25'
          : 'bg-secondary text-foreground/70 hover:bg-accent'
      }`}
      title="单击切换 | 双击进入全屏"
      aria-pressed={active}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
