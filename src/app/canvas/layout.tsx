import type { ReactNode } from 'react';
import './icanvas.css';
import { CanvasProviders } from './canvas-providers';

export default function CanvasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh overflow-hidden bg-background text-foreground">
      <CanvasProviders>{children}</CanvasProviders>
    </div>
  );
}
