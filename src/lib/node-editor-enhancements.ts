/**
 * 节点编辑器增强功能
 * 
 * 功能：
 * 1. 状态持久化（刷新后保持页面状态）
 * 2. 清空画布功能
 * 3. 初始页面只保留剧本节点
 */

import { Node, Edge, Viewport } from 'reactflow';

// LocalStorage 键名
const STORAGE_KEY = 'node-editor-state';

// 保存的状态类型
interface SavedState {
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  timestamp: number;
}

/**
 * 保存节点编辑器状态到 localStorage
 */
export function saveNodeEditorState(
  nodes: Node[],
  edges: Edge[],
  viewport: Viewport
): void {
  if (typeof window === 'undefined') return;
  
  try {
    const state: SavedState = {
      nodes,
      edges,
      viewport,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log('[Node Editor] 状态已保存');
  } catch (error) {
    console.error('[Node Editor] 保存状态失败:', error);
  }
}

/**
 * 从 localStorage 恢复节点编辑器状态
 */
export function loadNodeEditorState(): SavedState | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    
    const state: SavedState = JSON.parse(saved);
    
    // 检查是否过期（7天）
    const isExpired = Date.now() - state.timestamp > 7 * 24 * 60 * 60 * 1000;
    if (isExpired) {
      console.log('[Node Editor] 保存的状态已过期，已清除');
      clearNodeEditorState();
      return null;
    }
    
    console.log('[Node Editor] 状态已恢复');
    return state;
  } catch (error) {
    console.error('[Node Editor] 恢复状态失败:', error);
    return null;
  }
}

/**
 * 清除节点编辑器状态
 */
export function clearNodeEditorState(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Node Editor] 状态已清除');
  } catch (error) {
    console.error('[Node Editor] 清除状态失败:', error);
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 创建初始状态（只保留剧本节点）
 */
export function createInitialState(
  scriptNode: Node,
  defaultViewport: Viewport = { x: 0, y: 0, zoom: 1 }
): { nodes: Node[]; edges: Edge[]; viewport: Viewport } {
  return {
    nodes: [scriptNode],
    edges: [],
    viewport: defaultViewport,
  };
}

/**
 * 清空画布（只保留剧本节点）
 */
export function clearCanvas(
  allNodes: Node[],
  scriptNodeId: string = 'script-1'
): { nodes: Node[]; edges: Edge[] } {
  // 只保留剧本节点
  const keptNodes = allNodes.filter(node => node.id === scriptNodeId);
  
  return {
    nodes: keptNodes,
    edges: [],
  };
}
