'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface RemixButtonProps {
  onClick: () => void;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
  className?: string;
}

export function RemixButton({ 
  onClick, 
  size = 'sm', 
  variant = 'secondary',
  className = ''
}: RemixButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      className={`group relative overflow-hidden ${className}`}
    >
      <span className="relative z-10 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
        <span>仿写</span>
      </span>
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Button>
  );
}
