import { nanoid } from "nanoid";

import { getNodeSpec } from "../constants";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type CanvasNodeMetadata, type ViewportTransform } from "../types";

export type CanvasAgentOp =
    | { type: "add_node"; id?: string; nodeType?: CanvasNodeType; title?: string; position?: { x: number; y: number }; x?: number; y?: number; width?: number; height?: number; metadata?: CanvasNodeMetadata }
    | { type: "update_node"; id: string; patch?: Partial<CanvasNodeData>; metadata?: CanvasNodeMetadata }
    | { type: "delete_node"; id?: string; ids?: string[]; nodeType?: CanvasNodeType }
    | { type: "delete_connections"; id?: string; ids?: string[]; all?: boolean }
    | { type: "connect_nodes"; id?: string; fromNodeId: string; toNodeId: string }
    | { type: "set_viewport"; viewport: ViewportTransform }
    | { type: "select_nodes"; ids: string[] }
    | { type: "run_generation"; nodeId: string; mode?: "text" | "image" | "video" | "audio"; prompt?: string };

export type CanvasAgentSnapshot = {
    projectId: string;
    title: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    selectedNodeIds: string[];
    viewport: ViewportTransform;
};

export type CanvasAgentViewportSize = {
    width: number;
    height: number;
};

export function summarizeCanvasAgentOps(ops?: CanvasAgentOp[]) {
    const counts = completeShortDramaPlanOps(Array.isArray(ops) ? ops : []).reduce<Record<string, number>>((acc, op) => {
        if (!op?.type) return acc;
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([type, count]) => `${opLabel(type)} ${count}`)
        .join("，");
}

export function applyCanvasAgentOps(snapshot: CanvasAgentSnapshot, ops?: CanvasAgentOp[], viewportSize?: CanvasAgentViewportSize) {
    let nodes = snapshot.nodes;
    let connections = snapshot.connections;
    let selectedNodeIds = snapshot.selectedNodeIds;
    let viewport = snapshot.viewport;
    const addedNodeIds: string[] = [];
    let hasViewportOp = false;
    const safeOps = completeShortDramaPlanOps(Array.isArray(ops) ? ops : []);

    safeOps.forEach((op, index) => {
        if (!op?.type) return;
        if (op.type === "add_node") {
            const nodeType = Object.values(CanvasNodeType).includes(op.nodeType as CanvasNodeType) ? op.nodeType! : CanvasNodeType.Text;
            const spec = getNodeSpec(nodeType);
            const node: CanvasNodeData = {
                id: op.id || `${nodeType}-${Date.now()}-${index}`,
                type: nodeType,
                title: op.title || spec.title,
                position: op.position || { x: op.x ?? index * 36, y: op.y ?? index * 36 },
                width: op.width || spec.width,
                height: op.height || spec.height,
                metadata: { ...spec.metadata, ...op.metadata },
            };
            nodes = [...nodes, node];
            selectedNodeIds = [node.id];
            addedNodeIds.push(node.id);
        }
        if (op.type === "update_node") {
            if (!op.id) return;
            nodes = nodes.map((node) => (node.id === op.id ? { ...node, ...op.patch, metadata: { ...node.metadata, ...op.patch?.metadata, ...op.metadata } } : node));
        }
        if (op.type === "delete_node") {
            const ids = new Set(op.ids || (op.id ? [op.id] : op.nodeType ? nodes.filter((node) => node.type === op.nodeType).map((node) => node.id) : []));
            nodes = nodes.filter((node) => !ids.has(node.id));
            connections = connections.filter((conn) => !ids.has(conn.fromNodeId) && !ids.has(conn.toNodeId));
            selectedNodeIds = selectedNodeIds.filter((id) => !ids.has(id));
        }
        if (op.type === "delete_connections") {
            const ids = new Set(op.ids || (op.id ? [op.id] : []));
            connections = op.all ? [] : connections.filter((conn) => !ids.has(conn.id));
        }
        if (op.type === "connect_nodes") {
            if (!op.fromNodeId || !op.toNodeId) return;
            const exists = connections.some((conn) => conn.fromNodeId === op.fromNodeId && conn.toNodeId === op.toNodeId);
            const hasNodes = nodes.some((node) => node.id === op.fromNodeId) && nodes.some((node) => node.id === op.toNodeId);
            if (!exists && hasNodes) connections = [...connections, { id: op.id || nanoid(), fromNodeId: op.fromNodeId, toNodeId: op.toNodeId }];
        }
        if (op.type === "set_viewport" && op.viewport) {
            viewport = op.viewport;
            hasViewportOp = true;
        }
        if (op.type === "select_nodes") selectedNodeIds = (op.ids || []).filter((id) => nodes.some((node) => node.id === id));
    });

    const normalized = normalizeShortDramaCanvas(nodes, connections, selectedNodeIds);
    nodes = normalized.nodes;
    connections = normalized.connections;
    selectedNodeIds = normalized.selectedNodeIds;

    const fitNodeIds = normalized.changed ? normalized.focusNodeIds : addedNodeIds;
    if (!hasViewportOp && fitNodeIds.length >= 4) {
        viewport = fitViewportToNodes(
            nodes.filter((node) => fitNodeIds.includes(node.id)),
            viewportSize,
        ) || viewport;
    }

    return { ...snapshot, nodes, connections, selectedNodeIds, viewport };
}

function completeShortDramaPlanOps(ops: CanvasAgentOp[]) {
    const addNodes = ops.filter((op): op is Extract<CanvasAgentOp, { type: "add_node" }> => op.type === "add_node");
    if (addNodes.length < 8 || !looksLikeThirtySecondDrama(addNodes)) return ops;

    const clipNumbers = numberedNodes(addNodes, "clip");
    const refNumbers = numberedNodes(addNodes, "reference");
    const finalNode = addNodes.find((op) => /合成|成片|最终|final/i.test(opText(op)));
    const hasFinal = Boolean(finalNode);
    if (!hasFinal) return ops;

    const { x, y } = nextShortDramaPosition(addNodes);
    const selectedOps: CanvasAgentOp[] = [];
    const meaningfulNodes = addNodes.filter((op) => !/^\s*(双击编辑文字|文本)?\s*$/i.test(opText(op)));
    const finalPlan = meaningfulNodes.find((op) => /合成|成片|最终|final/i.test(opText(op))) || finalNode || addNodes[addNodes.length - 1];
    const clipCandidates = meaningfulNodes.filter((op) => op !== finalPlan && !/参考|reference|prompt|图/i.test(opText(op)));
    const refCandidates = meaningfulNodes.filter((op) => /参考|reference|prompt|图/i.test(opText(op)));
    const clipWidth = addNodes.find((op) => clipNumbers.has(nodeNumber(op, "clip") || 0))?.width || 220;
    const clipHeight = addNodes.find((op) => clipNumbers.has(nodeNumber(op, "clip") || 0))?.height || 140;
    const refWidth = addNodes.find((op) => refNumbers.has(nodeNumber(op, "reference") || 0))?.width || 220;
    const refHeight = addNodes.find((op) => refNumbers.has(nodeNumber(op, "reference") || 0))?.height || 140;

    for (let index = 1; index <= 6; index += 1) {
        const clipId = `clip-${index}`;
        const refId = `ref-${index}`;
        const colX = x + (index - 1) * 260;
        const existingClip = addNodes.find((op) => nodeNumber(op, "clip") === index) || clipCandidates[index - 1];
        const existingRef = addNodes.find((op) => nodeNumber(op, "reference") === index) || refCandidates[index - 1];
        selectedOps.push(
            existingClip
                ? { ...existingClip, id: clipId, title: existingClip.title || `Clip ${index}`, position: existingClip.position || { x: colX, y } }
                : {
                type: "add_node",
                id: clipId,
                nodeType: CanvasNodeType.Text,
                title: `Clip ${index}`,
                position: { x: colX, y },
                width: clipWidth,
                height: clipHeight,
                metadata: { content: `第 ${index} 个 5 秒镜头：补齐短剧节奏，延续前序剧情并完成 30 秒结构。`, status: "success", fontSize: 14, autoCompleted: true },
            },
        );
        selectedOps.push(
            existingRef
                ? { ...existingRef, id: refId, title: existingRef.title || `参考图 ${index}`, position: existingRef.position || { x: colX, y: y + clipHeight + 36 } }
                : {
                type: "add_node",
                id: refId,
                nodeType: CanvasNodeType.Text,
                title: `参考图 ${index}`,
                position: { x: colX, y: y + clipHeight + 36 },
                width: refWidth,
                height: refHeight,
                metadata: { content: `参考图 ${index}：延续全片视觉风格，服务 Clip ${index} 的关键画面。`, status: "success", fontSize: 14, autoCompleted: true },
            },
        );
    }

    selectedOps.push({ ...finalPlan, id: "final-video-plan", title: finalPlan.title || "最终视频合成规划", position: finalPlan.position || { x: x + 6 * 260, y } });

    const normalizedIds = new Set(selectedOps.filter((op): op is Extract<CanvasAgentOp, { type: "add_node" }> => op.type === "add_node").map((op) => op.id).filter((id): id is string => Boolean(id)));
    const connections: CanvasAgentOp[] = [];
    for (let index = 1; index <= 6; index += 1) {
        connections.push({ type: "connect_nodes", fromNodeId: `clip-${index}`, toNodeId: `ref-${index}` });
        if (index < 6) connections.push({ type: "connect_nodes", fromNodeId: `clip-${index}`, toNodeId: `clip-${index + 1}` });
    }
    connections.push({ type: "connect_nodes", fromNodeId: "clip-6", toNodeId: "final-video-plan" });

    return [...ops.filter((op) => op.type !== "add_node" && op.type !== "connect_nodes" && op.type !== "select_nodes"), ...selectedOps, ...connections.filter((op) => op.type === "connect_nodes" && normalizedIds.has(op.fromNodeId) && normalizedIds.has(op.toNodeId)), { type: "select_nodes", ids: ["final-video-plan"] }];
}

function looksLikeThirtySecondDrama(ops: Extract<CanvasAgentOp, { type: "add_node" }>[]) {
    const text = ops.map(opText).join(" ");
    return /(30\s*秒|30s|三十秒)/i.test(text) && /(clip|镜头|分镜|短剧)/i.test(text) && /(参考|reference|prompt|图)/i.test(text);
}

function numberedNodes(ops: Extract<CanvasAgentOp, { type: "add_node" }>[], kind: "clip" | "reference") {
    const numbers = new Set<number>();
    ops.forEach((op) => {
        const value = nodeNumber(op, kind);
        if (value) numbers.add(value);
    });
    return numbers;
}

function nodeNumber(op: Extract<CanvasAgentOp, { type: "add_node" }>, kind: "clip" | "reference") {
    const text = opText(op);
    const pattern = kind === "clip" ? /(?:clip|镜头|分镜)\D{0,12}([1-6])|第\s*([1-6])\s*个\s*5\s*秒/i : /(?:参考图|参考|reference|ref|prompt)\D{0,16}([1-6])/i;
    const match = text.match(pattern);
    return Number(match?.[1] || match?.[2] || 0) || null;
}

function opText(op: Extract<CanvasAgentOp, { type: "add_node" }>) {
    return [op.title, op.metadata?.content, op.metadata?.prompt, op.metadata?.composerContent].filter((item): item is string => typeof item === "string").join(" ");
}

function nextShortDramaPosition(ops: Extract<CanvasAgentOp, { type: "add_node" }>[]) {
    const positions = ops.map((op) => op.position || { x: op.x || 0, y: op.y || 0 });
    const minX = positions.length ? Math.min(...positions.map((pos) => pos.x)) : 80;
    const minY = positions.length ? Math.min(...positions.map((pos) => pos.y)) : 80;
    return { x: minX, y: minY };
}

function fitViewportToNodes(nodes: CanvasNodeData[], viewportSize?: CanvasAgentViewportSize): ViewportTransform | null {
    if (!nodes.length || !viewportSize || viewportSize.width < 320 || viewportSize.height < 240) return null;

    const minX = Math.min(...nodes.map((node) => node.position.x));
    const minY = Math.min(...nodes.map((node) => node.position.y));
    const maxX = Math.max(...nodes.map((node) => node.position.x + node.width));
    const maxY = Math.max(...nodes.map((node) => node.position.y + node.height));
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const centerX = minX + boundsWidth / 2;
    const centerY = minY + boundsHeight / 2;
    const padding = 96;
    const availableWidth = Math.max(160, viewportSize.width - padding * 2);
    const availableHeight = Math.max(160, viewportSize.height - padding * 2);
    const scale = Math.min(1, Math.max(0.22, Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight)));

    return {
        x: roundViewportNumber(viewportSize.width / 2 - centerX * scale),
        y: roundViewportNumber(viewportSize.height / 2 - centerY * scale),
        k: roundViewportNumber(scale),
    };
}

function roundViewportNumber(value: number) {
    return Math.round(value * 100) / 100;
}

function normalizeShortDramaCanvas(nodes: CanvasNodeData[], connections: CanvasConnection[], selectedNodeIds: string[]) {
    const clipNodes = numberedCanvasNodes(nodes, "clip");
    const refNodes = numberedCanvasNodes(nodes, "reference");
    const finalNode = nodes.find(isFinalPlanNode);
    if (clipNodes.length !== 6 || refNodes.length !== 6 || finalNode) return { nodes, connections, selectedNodeIds, changed: false, focusNodeIds: [] };

    const summaryNode = nodes.find((node) => !clipNodes.some((item) => item.id === node.id) && !refNodes.some((item) => item.id === node.id) && isSummaryNode(node));
    const textSpec = getNodeSpec(CanvasNodeType.Text);
    const anchor = clipNodes[5] || refNodes[5] || nodes[nodes.length - 1];
    const finalId = nodes.some((node) => node.id === "final-video-plan") ? `final-video-plan-${nanoid(5)}` : "final-video-plan";
    const finalPlan: CanvasNodeData = {
        id: finalId,
        type: CanvasNodeType.Text,
        title: "最终视频合成规划",
        position: { x: (anchor?.position.x || 0) + (anchor?.width || textSpec.width) + 80, y: anchor?.position.y || 0 },
        width: textSpec.width,
        height: textSpec.height,
        metadata: {
            ...textSpec.metadata,
            content: "最终合成规划：6 个 5 秒 clip 按序拼接，统一雨夜科幻调色、glitch 转场、环境雨声与低频配乐，输出 30 秒成片。",
            status: "success",
            fontSize: 14,
            autoCompleted: true,
        },
    };
    const removedIds = new Set(summaryNode ? [summaryNode.id] : []);
    const normalizedNodes = [...nodes.filter((node) => !removedIds.has(node.id)), finalPlan];
    const linkedIds = new Set([...clipNodes.map((node) => node.id), ...refNodes.map((node) => node.id), finalId, ...removedIds]);
    const normalizedConnections = connections.filter((conn) => !linkedIds.has(conn.fromNodeId) && !linkedIds.has(conn.toNodeId));
    for (let index = 0; index < 6; index += 1) {
        normalizedConnections.push({ id: nanoid(), fromNodeId: clipNodes[index].id, toNodeId: refNodes[index].id });
        if (index < 5) normalizedConnections.push({ id: nanoid(), fromNodeId: clipNodes[index].id, toNodeId: clipNodes[index + 1].id });
    }
    normalizedConnections.push({ id: nanoid(), fromNodeId: clipNodes[5].id, toNodeId: finalId });

    return { nodes: normalizedNodes, connections: normalizedConnections, selectedNodeIds: [finalId], changed: true, focusNodeIds: [...clipNodes.map((node) => node.id), ...refNodes.map((node) => node.id), finalId] };
}

function numberedCanvasNodes(nodes: CanvasNodeData[], kind: "clip" | "reference") {
    return nodes
        .map((node) => ({ node, number: canvasNodeNumber(node, kind) }))
        .filter((item): item is { node: CanvasNodeData; number: number } => Boolean(item.number))
        .sort((a, b) => a.number - b.number)
        .filter((item, index, items) => items.findIndex((other) => other.number === item.number) === index)
        .map((item) => item.node);
}

function canvasNodeNumber(node: CanvasNodeData, kind: "clip" | "reference") {
    const text = canvasNodeText(node);
    const pattern = kind === "clip" ? /(?:clip|镜头|分镜)\D{0,12}([1-6])|第\s*([1-6])\s*个\s*5\s*秒/i : /(?:参考图|参考|reference|ref|prompt)\D{0,16}([1-6])/i;
    const match = text.match(pattern);
    return Number(match?.[1] || match?.[2] || 0) || null;
}

function isFinalPlanNode(node: CanvasNodeData) {
    return /final-video-plan|最终|合成|成片/i.test([node.id, canvasNodeText(node)].join(" "));
}

function isSummaryNode(node: CanvasNodeData) {
    const text = canvasNodeText(node);
    return /总纲|标题|项目|主题|结构|风格|摘要|说明/i.test(text) && !canvasNodeNumber(node, "clip") && !canvasNodeNumber(node, "reference");
}

function canvasNodeText(node: CanvasNodeData) {
    return [node.id, node.title, node.metadata?.content, node.metadata?.prompt, node.metadata?.composerContent].filter((item): item is string => typeof item === "string").join(" ");
}

function opLabel(type: string) {
    if (type === "add_node") return "新增节点";
    if (type === "update_node") return "更新节点";
    if (type === "delete_node") return "删除节点";
    if (type === "delete_connections") return "删除连线";
    if (type === "connect_nodes") return "连接";
    if (type === "set_viewport") return "调整视图";
    if (type === "select_nodes") return "选择节点";
    if (type === "run_generation") return "触发生成";
    return type;
}
