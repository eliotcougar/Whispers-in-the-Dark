
/**
 * @file mapLayoutUtils.ts
 * @description Utilities for performing force-directed layout of game maps.
 */

import { MapNode, MapEdge } from '../types';
import { structuredCloneGameState } from './cloneUtils';

export const DEFAULT_K_REPULSION = 20000; 
export const DEFAULT_K_SPRING = 0.25;     
export const DEFAULT_IDEAL_EDGE_LENGTH = 120; 
export const DEFAULT_K_CENTERING = 0.04;   
export const DEFAULT_K_UNTANGLE = 5000; 
export const DEFAULT_K_EDGE_NODE_REPULSION = 5000;
export const DEFAULT_DAMPING_FACTOR = 0.9;
export const DEFAULT_MAX_DISPLACEMENT = 10;
export const DEFAULT_LAYOUT_ITERATIONS = 50;

interface Point { x: number; y: number; }
interface Force { fx: number; fy: number; }

export interface LayoutForceConstants {
  K_REPULSION: number;
  K_SPRING: number;
  IDEAL_EDGE_LENGTH: number;
  K_CENTERING: number;
  K_UNTANGLE: number;
  K_EDGE_NODE_REPULSION: number; 
  DAMPING_FACTOR: number;
  MAX_DISPLACEMENT: number;
}

/**
 * Calculates the orientation of an ordered triplet (p, q, r).
 * @returns 0 if p, q, r are collinear.
 * @returns 1 if (p, q, r) is clockwise.
 * @returns 2 if (p, q, r) is counterclockwise.
 */
function getOrientation(p: Point, q: Point, r: Point): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (val === 0) return 0; // Collinear
  return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
}

/**
 * Given three collinear points p, q, r, checks if point q lies on segment 'pr'.
 */
function onSegment(p: Point, q: Point, r: Point): boolean {
  return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
          q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y));
}

/**
 * Checks if two line segments 'p1q1' and 'p2q2' intersect.
 * @param p1 - Start point of segment 1.
 * @param q1 - End point of segment 1.
 * @param p2 - Start point of segment 2.
 * @param q2 - End point of segment 2.
 * @returns True if segments intersect, false otherwise.
 */
function doSegmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const o1 = getOrientation(p1, q1, p2);
  const o2 = getOrientation(p1, q1, q2);
  const o3 = getOrientation(p2, q2, p1);
  const o4 = getOrientation(p2, q2, q1);

  // General case
  if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
    if (o1 !== o2 && o3 !== o4) {
      return true;
    }
  }

  // Special Cases for collinear points
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false; // Doesn't fall in any of the above cases
}

/**
 * Helper function to check if a node is a host of a "node+leaves" group.
 * A region host is a main node that has at least one leaf child whose parentNodeId points back to this main node,
 * and an edge connects them (regardless of edge type for defining the host, but specific layout rules apply based on edge type or parent-child relationship).
 * @param node The node to check.
 * @param allThemeEdges All edges in the current theme.
 * @param nodeMap A map of node IDs to MapNode objects for quick lookup.
 * @returns True if the node is a region host, false otherwise.
 */
const isRegionHostNode = (node: MapNode, allThemeEdges: MapEdge[], nodeMap: Map<string, MapNode>): boolean => {
  if (node.data.isLeaf) return false; // Only main nodes can host regions

  // Check if any node considers 'node' as its parent via parentNodeId
  for (const potentialChild of nodeMap.values()) {
    if (potentialChild.data.isLeaf && potentialChild.data.parentNodeId === node.id) {
      // Found a leaf child. Now check if there's an edge connecting them.
      const edgeExists = allThemeEdges.some(edge =>
        (edge.sourceNodeId === node.id && edge.targetNodeId === potentialChild.id) ||
        (edge.sourceNodeId === potentialChild.id && edge.targetNodeId === node.id)
      );
      if (edgeExists) return true; 
    }
  }
  return false;
};

/**
 * Helper function to check if 'otherNode' is external to 'groupHostNode's group.
 * A node is external if it's not the groupHostNode itself, and not one of its leaf children 
 * (based on parentNodeId) that is part of the group.
 * @param otherNode The node to check.
 * @param groupHostNode The main node hosting the group/region.
 * @param allThemeEdges All edges in the current theme (used indirectly by some layout rules, but parentNodeId is primary here).
 * @returns True if otherNode is external to groupHostNode's group, false otherwise.
 */
const isExternalToGroup = (otherNode: MapNode, groupHostNode: MapNode, allThemeEdges: MapEdge[]): boolean => {
  if (otherNode.id === groupHostNode.id) return false; 

  // If otherNode is a leaf and its parentNodeId is the groupHostNode, it's part of the group.
  if (otherNode.data.isLeaf && otherNode.data.parentNodeId === groupHostNode.id) {
    return false; 
  }
  
  return true; 
};


/**
 * Applies a basic iterative layout algorithm to position map nodes.
 * This is a simplified spring-embedder model with edge crossing prevention.
 * Includes logic for regional layout of main nodes and their contained leaves,
 * and for pushing external nodes out of these regions.
 * @param initialNodes - Array of nodes with potentially initial positions.
 * @param allThemeEdges - Array of edges connecting the nodes within the current theme.
 * @param viewBoxWidth - The width of the intended display area.
 * @param viewBoxHeight - The height of the intended display area.
 * @param iterations - Number of iterations to run the algorithm.
 * @param forceConstants - Object containing the force constants for the layout.
 * @returns A new array of MapNode objects with updated positions.
 */
export const applyBasicLayoutAlgorithm = (
  initialNodes: MapNode[],
  allThemeEdges: MapEdge[], 
  viewBoxWidth: number,
  viewBoxHeight: number,
  iterations: number,
  forceConstants: LayoutForceConstants
): MapNode[] => {
  if (initialNodes.length === 0) return [];

  let nodes = structuredCloneGameState(initialNodes);
  const nodeMap = new Map(nodes.map(node => [node.id, node]));

  const {
    K_REPULSION, K_SPRING, IDEAL_EDGE_LENGTH, K_CENTERING, K_UNTANGLE, K_EDGE_NODE_REPULSION, DAMPING_FACTOR, MAX_DISPLACEMENT
  } = forceConstants;

  for (let iter = 0; iter < iterations; iter++) {
    const forces: Record<string, Force> = {};
    nodes.forEach(node => {
      forces[node.id] = { fx: 0, fy: 0 };
    });

    // Repulsive forces (node-node)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        let dxR = node2.position.x - node1.position.x;
        let dyR = node2.position.y - node1.position.y;

        if (dxR === 0 && dyR === 0) { 
          dxR = (Math.random() - 0.5) * 0.1; 
          dyR = (Math.random() - 0.5) * 0.1;
        }
        
        let distanceSq = dxR * dxR + dyR * dyR;
        if (distanceSq === 0) distanceSq = 0.01; 
        let distance = Math.sqrt(distanceSq);

        let repulsionForceMagnitude = K_REPULSION / distanceSq;
        
        const commonRepulsionMultiplier = (node1.data.isLeaf && node2.data.isLeaf) 
            ? 0.5 
            : (node1.data.isLeaf || node2.data.isLeaf ? 0.7 : 1);
        repulsionForceMagnitude *= commonRepulsionMultiplier;

        const node1IsHost = isRegionHostNode(node1, allThemeEdges, nodeMap);
        const node2IsHost = isRegionHostNode(node2, allThemeEdges, nodeMap);
        let pushOutMultiplier = 1.0;

        if (node1IsHost && isExternalToGroup(node2, node1, allThemeEdges)) {
          if (distance < IDEAL_EDGE_LENGTH) {
            pushOutMultiplier = Math.max(pushOutMultiplier, (IDEAL_EDGE_LENGTH / Math.max(distance, 1))**2);
          }
        }
        if (node2IsHost && isExternalToGroup(node1, node2, allThemeEdges)) {
          if (distance < IDEAL_EDGE_LENGTH) {
            pushOutMultiplier = Math.max(pushOutMultiplier, (IDEAL_EDGE_LENGTH / Math.max(distance, 1))**2);
          }
        }
        repulsionForceMagnitude *= pushOutMultiplier;


        forces[node1.id].fx -= (dxR / distance) * repulsionForceMagnitude;
        forces[node1.id].fy -= (dyR / distance) * repulsionForceMagnitude;
        forces[node2.id].fx += (dxR / distance) * repulsionForceMagnitude;
        forces[node2.id].fy += (dyR / distance) * repulsionForceMagnitude;
      }
    }

    // Spring forces along edges
    allThemeEdges.forEach(edge => {
      const sourceNode = nodeMap.get(edge.sourceNodeId);
      const targetNode = nodeMap.get(edge.targetNodeId);

      if (sourceNode && targetNode) {
        const dxS = targetNode.position.x - sourceNode.position.x;
        const dyS = targetNode.position.y - sourceNode.position.y;
        let distance = Math.sqrt(dxS * dxS + dyS * dyS);
        if (distance === 0) distance = 0.1;

        let idealLen = IDEAL_EDGE_LENGTH; // Default
        let springK = K_SPRING;        // Default
        let attractionMultiplier = 1.0;   // Default

        let parentNodeForLayout: MapNode | undefined = undefined;
        let childNodeForLayout: MapNode | undefined = undefined;
        let isTrueParentChildPair = false;

        // Check for actual parent-child relationship first
        // This relationship dictates the layout for ANY edge connecting this specific parent-child pair.
        if (!sourceNode.data.isLeaf && targetNode.data.isLeaf && targetNode.data.parentNodeId === sourceNode.id) {
            parentNodeForLayout = sourceNode; childNodeForLayout = targetNode; isTrueParentChildPair = true;
        } else if (sourceNode.data.isLeaf && !targetNode.data.isLeaf && sourceNode.data.parentNodeId === targetNode.id) {
            parentNodeForLayout = targetNode; childNodeForLayout = sourceNode; isTrueParentChildPair = true;
        }
        
        if (isTrueParentChildPair && parentNodeForLayout && childNodeForLayout) {
            // This is the DOMINANT rule for this pair of nodes.
            let hasExternalConnection = false;
            for (const otherEdge of allThemeEdges) {
                if (otherEdge.id === edge.id) continue; 
                let connectedNodeId: string | undefined;
                if (otherEdge.sourceNodeId === childNodeForLayout.id) connectedNodeId = otherEdge.targetNodeId;
                else if (otherEdge.targetNodeId === childNodeForLayout.id) connectedNodeId = otherEdge.sourceNodeId;

                if (connectedNodeId) {
                    const connectedMapNode = nodeMap.get(connectedNodeId);
                    if (connectedMapNode) {
                        // External if connected to something other than its parent AND that something is not another leaf of the same parent
                        if (connectedMapNode.id !== parentNodeForLayout.id && 
                            (!connectedMapNode.data.isLeaf || connectedMapNode.data.parentNodeId !== parentNodeForLayout.id)) {
                            hasExternalConnection = true; break;
                        }
                    }
                }
            }
            if (hasExternalConnection) {
                idealLen = IDEAL_EDGE_LENGTH; springK = K_SPRING * 20; // Strong force to keep at boundary    
            } else { 
                idealLen = IDEAL_EDGE_LENGTH * 0.4; springK = K_SPRING * 1.5; // Pull internal leaves closer
            }
        } else {
            // If not a true parent-child pair, then apply rules based on edge type and node types for THIS specific edge
            if (edge.data.type === 'containment' && sourceNode.data.isLeaf && targetNode.data.isLeaf) {
                idealLen = IDEAL_EDGE_LENGTH * 0.3;
                springK = K_SPRING * 1.5; // Stronger containment for leaf-leaf
            } else if (edge.data.type !== 'containment' && sourceNode.data.isLeaf && targetNode.data.isLeaf) {
                // Non-containment edge between two LEAF nodes (very attractive)
                idealLen = IDEAL_EDGE_LENGTH * 0.3; 
                springK = K_SPRING * 1.5;            
            } else if (edge.data.type !== 'containment' && !sourceNode.data.isLeaf && !targetNode.data.isLeaf) {
                // Non-containment edge directly connecting two main nodes
                idealLen = IDEAL_EDGE_LENGTH * 2;
                // springK = K_SPRING; // Default
            } else {
                // Default for other edges (e.g., path, door, or leaf-to-main non-parent-child,
                // or explicit 'containment' edge between leaf and its non-parent main node)
                idealLen = IDEAL_EDGE_LENGTH * 1.5;
                // springK = K_SPRING; // Default
                if (sourceNode.data.isLeaf || targetNode.data.isLeaf) {
                    attractionMultiplier = 1.3; 
                }
            }
        }
        
        const displacement = distance - idealLen;
        const springForceMagnitude = springK * displacement;
        
        forces[sourceNode.id].fx += (dxS / distance) * springForceMagnitude * attractionMultiplier;
        forces[sourceNode.id].fy += (dyS / distance) * springForceMagnitude * attractionMultiplier;
        forces[targetNode.id].fx -= (dxS / distance) * springForceMagnitude * attractionMultiplier;
        forces[targetNode.id].fy -= (dyS / distance) * springForceMagnitude * attractionMultiplier;
      }
    });

    // Node-Edge Midpoint Repulsion
    if (K_EDGE_NODE_REPULSION > 0) {
        allThemeEdges.forEach(edge => {
            const n1 = nodeMap.get(edge.sourceNodeId);
            const n2 = nodeMap.get(edge.targetNodeId);
            if (!n1 || !n2) return;
            const midEdge = { x: (n1.position.x + n2.position.x) / 2, y: (n1.position.y + n2.position.y) / 2 };
            nodes.forEach(nOther => {
                if (nOther.id === n1.id || nOther.id === n2.id) return;
                let deltaX = nOther.position.x - midEdge.x;
                let deltaY = nOther.position.y - midEdge.y;
                if (deltaX === 0 && deltaY === 0) { deltaX = (Math.random() - 0.5) * 0.1; deltaY = (Math.random() - 0.5) * 0.1; }
                const distSq = deltaX * deltaX + deltaY * deltaY;
                if (distSq === 0) return; 
                const dist = Math.sqrt(distSq);
                const forceMag = K_EDGE_NODE_REPULSION / distSq;
                forces[nOther.id].fx += (deltaX / dist) * forceMag;
                forces[nOther.id].fy += (deltaY / dist) * forceMag;
                const forceOnMidX = -(deltaX / dist) * forceMag;
                const forceOnMidY = -(deltaY / dist) * forceMag;
                forces[n1.id].fx += forceOnMidX / 2; forces[n1.id].fy += forceOnMidY / 2;
                forces[n2.id].fx += forceOnMidX / 2; forces[n2.id].fy += forceOnMidY / 2;
            });
        });
    }

    // Edge Untangling Forces
    if (K_UNTANGLE > 0 && allThemeEdges.length > 1) {
      for (let i = 0; i < allThemeEdges.length; i++) {
        for (let j = i + 1; j < allThemeEdges.length; j++) {
          const edge1 = allThemeEdges[i]; const edge2 = allThemeEdges[j];
          const n1 = nodeMap.get(edge1.sourceNodeId); const n2 = nodeMap.get(edge1.targetNodeId);
          const n3 = nodeMap.get(edge2.sourceNodeId); const n4 = nodeMap.get(edge2.targetNodeId);
          if (!n1 || !n2 || !n3 || !n4) continue;
          if (n1.id === n3.id || n1.id === n4.id || n2.id === n3.id || n2.id === n4.id) continue;
          if (doSegmentsIntersect(n1.position, n2.position, n3.position, n4.position)) {
            const mid1 = { x: (n1.position.x + n2.position.x) / 2, y: (n1.position.y + n2.position.y) / 2 };
            const mid2 = { x: (n3.position.x + n4.position.x) / 2, y: (n3.position.y + n4.position.y) / 2 };
            let deltaMidX = mid1.x - mid2.x; let deltaMidY = mid1.y - mid2.y;
            if (deltaMidX === 0 && deltaMidY === 0) { deltaMidX = (Math.random() - 0.5) * 0.1; deltaMidY = (Math.random() - 0.5) * 0.1; }
            const distMidSq = deltaMidX * deltaMidX + deltaMidY * deltaMidY;
            if (distMidSq === 0) continue; 
            const distMid = Math.sqrt(distMidSq);
            const untangleForceMag = K_UNTANGLE / distMid; 
            const fxU = (deltaMidX / distMid) * untangleForceMag; const fyU = (deltaMidY / distMid) * untangleForceMag;
            forces[n1.id].fx += fxU / 2; forces[n1.id].fy += fyU / 2;
            forces[n2.id].fx += fxU / 2; forces[n2.id].fy += fyU / 2;
            forces[n3.id].fx -= fxU / 2; forces[n3.id].fy -= fyU / 2;
            forces[n4.id].fx -= fxU / 2; forces[n4.id].fy -= fyU / 2;
          }
        }
      }
    }

    // Centering force
    nodes.forEach(node => {
      forces[node.id].fx -= node.position.x * K_CENTERING;
      forces[node.id].fy -= node.position.y * K_CENTERING;
    });

    // Apply forces and update nodeMap immediately for next iteration's calculations
    nodes = nodes.map(node => {
      let displacementX = forces[node.id].fx * DAMPING_FACTOR;
      let displacementY = forces[node.id].fy * DAMPING_FACTOR;
      const displacementMag = Math.sqrt(displacementX * displacementX + displacementY * displacementY);
      if (displacementMag > MAX_DISPLACEMENT) {
        displacementX = (displacementX / displacementMag) * MAX_DISPLACEMENT;
        displacementY = (displacementY / displacementMag) * MAX_DISPLACEMENT;
      }
      const newX = node.position.x + displacementX; const newY = node.position.y + displacementY;
      const boundaryX = viewBoxWidth / 2 * 0.95; const boundaryY = viewBoxHeight / 2 * 0.95;
      const updatedNode = {
        ...node,
        position: {
          x: Math.max(-boundaryX, Math.min(boundaryX, newX)),
          y: Math.max(-boundaryY, Math.min(boundaryY, newY)),
        },
      };
      nodeMap.set(node.id, updatedNode); 
      return updatedNode;
    });
  }
  return nodes;
};
