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
