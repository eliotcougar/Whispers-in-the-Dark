import type { MapNode, MapEdgeData } from '../../types';
import type { EdgeChainRequest } from '../corrections/edgeFixes';
import { isEdgeConnectionAllowed } from './edgeUtils';

function getNodeDepth(node: MapNode, lookup: Map<string, MapNode>): number {
  let depth = 0;
  let current: MapNode | undefined = node;
  while (current.data.parentNodeId) {
    const parent = lookup.get(current.data.parentNodeId);
    if (!parent) break;
    depth++;
    current = parent;
  }
  return depth;
}

export function buildChainRequest(
  sourceNode: MapNode,
  targetNode: MapNode,
  edgeData: MapEdgeData,
  nodeLookup: Map<string, MapNode>,
): EdgeChainRequest {
  const chainPairs: EdgeChainRequest['pairs'] = [];
  const sourceChain: Array<MapNode> = [sourceNode];
  const targetChain: Array<MapNode> = [targetNode];
  let nodeA: MapNode = sourceNode;
  let nodeB: MapNode = targetNode;
  let attempts = 0;
  let lastKey = '';
  while (!isEdgeConnectionAllowed(nodeA, nodeB, edgeData.type, nodeLookup) && attempts < 10) {
    const stepKey = `${nodeA.id}|${nodeB.id}`;
    if (stepKey !== lastKey) {
      chainPairs.push({ sourceParent: nodeA, targetParent: nodeB });
      lastKey = stepKey;
    }
    const depthA = getNodeDepth(nodeA, nodeLookup);
    const depthB = getNodeDepth(nodeB, nodeLookup);
    if (depthA >= depthB && nodeA.data.parentNodeId) {
      const parentA = nodeLookup.get(nodeA.data.parentNodeId);
      if (parentA) {
        nodeA = parentA;
        sourceChain.push(nodeA);
      } else break;
    } else if (nodeB.data.parentNodeId) {
      const parentB = nodeLookup.get(nodeB.data.parentNodeId);
      if (parentB) {
        nodeB = parentB;
        targetChain.push(nodeB);
      } else break;
    } else {
      break;
    }
    attempts++;
  }
  if (!isEdgeConnectionAllowed(nodeA, nodeB, edgeData.type, nodeLookup)) {
    const finalKey = `${nodeA.id}|${nodeB.id}`;
    if (finalKey !== lastKey) {
      chainPairs.push({ sourceParent: nodeA, targetParent: nodeB });
    }
  }
  return {
    originalSource: sourceNode,
    originalTarget: targetNode,
    pairs: chainPairs,
    sourceChain,
    targetChain,
    edgeData,
  };
}

function buildParentChainIds(request: EdgeChainRequest): Array<string> {
  const visited = new Set<string>();
  const ordered: Array<string> = [];
  [...request.sourceChain, ...request.targetChain.slice().reverse()].forEach(p => {
    if (p.data.nodeType !== 'feature' && !visited.has(p.id)) {
      ordered.push(p.id);
      visited.add(p.id);
    }
  });
  if (ordered.length === 0) {
    if (!visited.has(request.originalSource.id)) {
      ordered.push(request.originalSource.id);
      visited.add(request.originalSource.id);
    }
    if (!visited.has(request.originalTarget.id)) {
      ordered.push(request.originalTarget.id);
    }
  }
  return ordered;
}

function isSubchain(shorter: Array<string>, longer: Array<string>): boolean {
  if (shorter.length > longer.length) return false;
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    let match = true;
    for (let j = 0; j < shorter.length; j++) {
      if (shorter[j] !== longer[i + j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export function filterEdgeChainRequests(
  requests: Array<EdgeChainRequest>,
): Array<EdgeChainRequest> {
  const filtered: Array<EdgeChainRequest> = [];
  const paths: Array<Array<string>> = [];

  requests.forEach(req => {
    const path = buildParentChainIds(req);
    const reversed = [...path].reverse();
    let skip = false;

    for (let idx = 0; idx < paths.length; idx++) {
      const existing = paths[idx];
      const existingRev = [...existing].reverse();
      const isSame =
        (path.length === existing.length && path.every((v, i) => v === existing[i])) ||
        (path.length === existing.length && reversed.every((v, i) => v === existing[i]));
      if (isSame) {
        skip = true;
        break;
      }

      const isSub =
        (path.length <= existing.length &&
          (isSubchain(path, existing) || isSubchain(reversed, existing))) ||
        (path.length > existing.length &&
          (isSubchain(existing, path) || isSubchain(existingRev, path)));

      if (isSub) {
        if (path.length > existing.length) {
          filtered[idx] = req;
          paths[idx] = path;
        }
        skip = true;
        break;
      }
    }

    if (!skip) {
      filtered.push(req);
      paths.push(path);
    }
  });

  return filtered;
}
