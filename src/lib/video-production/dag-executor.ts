/**
 * DAG 工作流编排器 (v3.1)
 * 有向无环图编排 + 多 Agent 协同 + 拓扑排序 + 并行执行
 */

import type { DAGNode, DAGNodeStatus, DAGExecutionLog, DAGExecutionResult } from './types';

/** Agent 执行函数类型 */
export type AgentExecutor = (node: DAGNode, context: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** DAG 构建配置 */
export interface DAGBuildConfig {
  storyboard: Record<string, unknown>;
  workers?: number;
  parallelStages?: string[];
  confirmBeforeGeneration?: boolean;
  costLimit?: number;
}

/**
 * DAG 执行器
 * 基于 Kahn 算法的拓扑排序 + 并行组执行
 */
export class DAGExecutor {
  private nodes: Map<string, DAGNode> = new Map();
  private executionLog: DAGExecutionLog[] = [];
  private maxWorkers: number;

  constructor(maxWorkers: number = 3) {
    this.maxWorkers = maxWorkers;
  }

  /**
   * 添加节点
   */
  addNode(node: DAGNode): void {
    this.nodes.set(node.nodeId, { ...node });
  }

  /**
   * 根据分镜构建默认 DAG
   */
  buildDefaultDAG(config: DAGBuildConfig): DAGNode[] {
    const { storyboard } = config;
    const shots = (storyboard.shots as Array<Record<string, unknown>>) || [];
    const nodes: DAGNode[] = [];

    // 阶段1: 脚本生成
    nodes.push({
      nodeId: 'n_script',
      name: '脚本生成',
      agent: 'creative_agent',
      dependencies: [],
      status: 'pending',
    });

    // 阶段2: 配音合成
    nodes.push({
      nodeId: 'n_tts',
      name: '配音合成',
      agent: 'tts_agent',
      dependencies: ['n_script'],
      parallelGroup: 'audio',
      status: 'pending',
    });

    // 阶段3: 素材匹配
    nodes.push({
      nodeId: 'n_asset',
      name: '素材匹配',
      agent: 'asset_agent',
      dependencies: ['n_script'],
      parallelGroup: 'asset',
      status: 'pending',
    });

    // 阶段4: 风格参考
    nodes.push({
      nodeId: 'n_style_ref',
      name: '风格参考',
      agent: 'style_agent',
      dependencies: ['n_script'],
      parallelGroup: 'asset',
      status: 'pending',
    });

    // 阶段5: 视频生成 (每个分镜一个节点)
    for (let i = 0; i < shots.length; i++) {
      const shotId = (shots[i].shotId as string) || `s_${i + 1}`;
      nodes.push({
        nodeId: `n_video_${shotId}`,
        name: `视频生成-${shotId}`,
        agent: 'video_agent',
        dependencies: ['n_asset', 'n_tts', 'n_style_ref'],
        parallelGroup: 'video',
        status: 'pending',
      });
    }

    // 阶段6: 字幕合成
    const videoDeps = shots.map((_, i) => {
      const shotId = (shots[i].shotId as string) || `s_${i + 1}`;
      return `n_video_${shotId}`;
    });
    nodes.push({
      nodeId: 'n_subtitle',
      name: '字幕合成',
      agent: 'subtitle_agent',
      dependencies: videoDeps,
      parallelGroup: 'post',
      status: 'pending',
    });

    // 阶段7: 合规审核
    nodes.push({
      nodeId: 'n_compliance',
      name: '内容审核',
      agent: 'compliance_agent',
      dependencies: ['n_subtitle'],
      parallelGroup: 'post',
      status: 'pending',
    });

    // 阶段8: 特效合成
    nodes.push({
      nodeId: 'n_effects',
      name: '特效合成',
      agent: 'effects_agent',
      dependencies: ['n_subtitle'],
      parallelGroup: 'post',
      status: 'pending',
    });

    // 阶段9: 最终渲染
    nodes.push({
      nodeId: 'n_render',
      name: '最终渲染',
      agent: 'render_agent',
      dependencies: ['n_compliance', 'n_effects'],
      status: 'pending',
    });

    // 阶段10: AI质量评估
    nodes.push({
      nodeId: 'n_qa',
      name: 'AI质量评估',
      agent: 'qa_agent',
      dependencies: ['n_render'],
      status: 'pending',
    });

    // 注册到 executor
    nodes.forEach((n) => this.addNode(n));
    return nodes;
  }

  /**
   * 拓扑排序 (Kahn 算法)
   */
  topologicalSort(): string[] {
    const inDegree: Map<string, number> = new Map();
    const adjacency: Map<string, string[]> = new Map();

    // 初始化
    for (const [nodeId] of this.nodes) {
      inDegree.set(nodeId, 0);
      adjacency.set(nodeId, []);
    }

    // 计算入度和邻接表
    for (const [, node] of this.nodes) {
      for (const dep of node.dependencies) {
        if (this.nodes.has(dep)) {
          adjacency.get(dep)!.push(node.nodeId);
          inDegree.set(node.nodeId, (inDegree.get(node.nodeId) || 0) + 1);
        }
      }
    }

    // 找到所有入度为 0 的节点
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      for (const neighbor of adjacency.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return result;
  }

  /**
   * 获取就绪节点 (依赖已完成)
   */
  getReadyNodes(): DAGNode[] {
    const ready: DAGNode[] = [];
    for (const [, node] of this.nodes) {
      if (node.status !== 'pending') continue;
      const depsComplete = node.dependencies.every(
        (dep) => this.nodes.get(dep)?.status === 'completed'
      );
      if (depsComplete) {
        ready.push({ ...node, status: 'ready' });
      }
    }
    return ready;
  }

  /**
   * 模拟执行 DAG (dryRun)
   */
  executeDryRun(): DAGExecutionResult {
    const dagId = `dag_${Date.now()}`;
    const startTime = Date.now();
    const logs: DAGExecutionLog[] = [];
    const order = this.topologicalSort();

    // 重置所有节点
    for (const [, node] of this.nodes) {
      node.status = 'pending';
    }

    // 按拓扑顺序模拟执行
    for (const nodeId of order) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      node.status = 'running';
      const nodeStart = Date.now();

      // 模拟执行 (实际环境中调用 agent executor)
      node.status = 'completed';
      node.result = { dryRun: true, agent: node.agent };
      const nodeEnd = Date.now();

      logs.push({
        nodeId: node.nodeId,
        agent: node.agent,
        status: 'completed',
        startTime: nodeStart,
        endTime: nodeEnd,
        duration: nodeEnd - nodeStart,
      });
    }

    const completedCount = Array.from(this.nodes.values()).filter((n) => n.status === 'completed').length;

    return {
      dagId,
      status: completedCount === this.nodes.size ? 'success' : 'partial',
      nodes: Array.from(this.nodes.values()),
      logs,
      totalDuration: Date.now() - startTime,
      completedCount,
      failedCount: 0,
    };
  }

  /**
   * 获取 DAG 可视化描述
   */
  getVisualization(): string {
    const order = this.topologicalSort();
    const lines: string[] = ['DAG 工作流:'];

    for (const nodeId of order) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;
      const deps = node.dependencies.length > 0 ? ` (depends: ${node.dependencies.join(', ')})` : '';
      const parallel = node.parallelGroup ? ` [group: ${node.parallelGroup}]` : '';
      lines.push(`  ${nodeId}: ${node.name} -> ${node.agent}${deps}${parallel}`);
    }

    return lines.join('\n');
  }

  /**
   * 获取并行执行计划
   */
  getParallelPlan(): string[][] {
    const stages: string[][] = [];
    const completed = new Set<string>();

    while (completed.size < this.nodes.size) {
      const stage: string[] = [];
      for (const [nodeId, node] of this.nodes) {
        if (completed.has(nodeId)) continue;
        const depsReady = node.dependencies.every((d) => completed.has(d));
        if (depsReady) {
          stage.push(nodeId);
        }
      }
      if (stage.length === 0) break; // 防止死循环
      stage.forEach((id) => completed.add(id));
      stages.push(stage);
    }

    return stages;
  }
}

/** 创建 DAG 执行器 */
export function createDAGExecutor(maxWorkers?: number): DAGExecutor {
  return new DAGExecutor(maxWorkers);
}
