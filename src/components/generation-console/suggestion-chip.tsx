'use client';

import React from 'react';

export function SuggestionChip({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border/80 text-sm text-foreground hover:border-red-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <Icon className="w-4 h-4 text-red-500" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
