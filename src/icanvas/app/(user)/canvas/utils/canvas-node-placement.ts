import type { Position } from "../types";

type NodeSize = {
    width: number;
    height: number;
};

type NodeBounds = NodeSize & {
    position: Position;
};

const NODE_PLACEMENT_GAP = 32;

function overlaps(candidate: NodeBounds, existing: NodeBounds): boolean {
    return candidate.position.x < existing.position.x + existing.width + NODE_PLACEMENT_GAP
        && candidate.position.x + candidate.width + NODE_PLACEMENT_GAP > existing.position.x
        && candidate.position.y < existing.position.y + existing.height + NODE_PLACEMENT_GAP
        && candidate.position.y + candidate.height + NODE_PLACEMENT_GAP > existing.position.y;
}

export function findUnoccupiedNodePosition(
    preferred: Position,
    size: NodeSize,
    existingNodes: NodeBounds[],
): Position {
    const stepX = size.width + NODE_PLACEMENT_GAP;
    const stepY = size.height + NODE_PLACEMENT_GAP;
    const maxRing = Math.max(existingNodes.length + 1, 2);

    const candidates: Position[] = [{ ...preferred }];
    for (let ring = 1; ring <= maxRing; ring += 1) {
        candidates.push(
            { x: preferred.x + ring * stepX, y: preferred.y },
            { x: preferred.x, y: preferred.y + ring * stepY },
            { x: preferred.x - ring * stepX, y: preferred.y },
            { x: preferred.x, y: preferred.y - ring * stepY },
            { x: preferred.x + ring * stepX, y: preferred.y + ring * stepY },
            { x: preferred.x - ring * stepX, y: preferred.y + ring * stepY },
            { x: preferred.x - ring * stepX, y: preferred.y - ring * stepY },
            { x: preferred.x + ring * stepX, y: preferred.y - ring * stepY },
        );
    }

    return candidates.find((position) => {
        const candidate = { position, ...size };
        return existingNodes.every((node) => !overlaps(candidate, node));
    }) || { x: preferred.x + maxRing * stepX, y: preferred.y + maxRing * stepY };
}
