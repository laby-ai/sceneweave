'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  label?: string;
};

type State = { error: Error | null };

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      this.props.onError?.(error, info);
      const tag = this.props.label || 'canvas-subtree';
      console.warn(`[CanvasErrorBoundary:${tag}]`, error.message, info.componentStack?.slice(0, 200));
    } catch {
      // 静默，绝不向上抛。
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: '100%', minHeight: 120, padding: 16, color: '#f87171', fontSize: 12, textAlign: 'center' }}>
        <span>这一块暂时没加载出来。</span>
        <button type="button" onClick={this.reset} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid currentColor', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 11 }}>
          重试
        </button>
      </div>
    );
  }
}
