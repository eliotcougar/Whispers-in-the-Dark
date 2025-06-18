
/**
 * @file mapLayoutUtils.ts
 * @description Utilities for computing a nested circle layout for map nodes.
 * The algorithm allocates extra padding so that child node circles and labels
 * fit comfortably inside their parent.
 */

import { MapNode } from '../types';
import { structuredCloneGameState } from './cloneUtils';
import { NODE_RADIUS } from '../constants';

export const DEFAULT_IDEAL_EDGE_LENGTH = 140;
export const DEFAULT_NESTED_PADDING = 10;
export const DEFAULT_NESTED_ANGLE_PADDING = 0.15;

/**
 * Each parent node encloses its children while children are positioned on the
 * circumference of a circle that is just large enough to avoid overlaps.
 * Feature nodes receive a fixed base radius. The computation runs bottom-up so
 * each parent's radius is known before positioning its siblings.
 *
 * @param nodes - Array of map nodes to layout.
 * @returns A new array of nodes with updated absolute positions and
 *          `visualRadius` values.
 */
export interface NestedCircleLayoutConfig {
  padding: number;
  anglePadding: number;
}

export const applyNestedCircleLayout = (
  nodes: Array<MapNode>,
  config?: Partial<NestedCircleLayoutConfig>
): Array<MapNode> => {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map(n => [n.id, structuredCloneGameState(n)]));
  const childrenByParent: Map<string, Array<string>> = new Map();
  nodeMap.forEach(node => {
    const pid = node.data.parentNodeId && node.data.parentNodeId !== 'Universe' ? node.data.parentNodeId : undefined;
    if (pid) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      const arr = childrenByParent.get(pid);
      if (arr) arr.push(node.id);
    }
  });

  const BASE_FEATURE_RADIUS = NODE_RADIUS;
  const PADDING = config?.padding ?? DEFAULT_NESTED_PADDING;
  const SMALL_ANGLE_PADDING = config?.anglePadding ?? DEFAULT_NESTED_ANGLE_PADDING;
  const INCREMENT = 2;

  /**
   * Recursively layouts a node's children returning the radius for that node.
   * Positions are stored relative to the node itself.
   */
  const layoutNode = (nodeId: string): number => {
    const node = nodeMap.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} missing in layout`);
    const childIds = childrenByParent.get(nodeId) || [];

    if (node.data.nodeType === 'feature' || childIds.length === 0) {
      node.data.visualRadius = BASE_FEATURE_RADIUS;
      node.position = { x: 0, y: 0 };
      return node.data.visualRadius;
    }

    // Layout children first
    childIds.forEach(cid => layoutNode(cid));

    if (childIds.length === 1) {
      const onlyChild = nodeMap.get(childIds[0]);
      if (!onlyChild) throw new Error('Child node missing');
      onlyChild.position = { x: 0, y: 0 };
      node.data.visualRadius = (onlyChild.data.visualRadius || BASE_FEATURE_RADIUS) + PADDING;
      node.position = { x: 0, y: 0 };
      return node.data.visualRadius;
    }

    const children = childIds
      .map(cid => {
        const child = nodeMap.get(cid);
        if (!child) throw new Error('Child node missing');
        return child;
      })
      .sort(
        (a, b) =>
          (b.data.visualRadius || BASE_FEATURE_RADIUS) -
          (a.data.visualRadius || BASE_FEATURE_RADIUS)
      );

    let R = Math.max(...children.map(c => c.data.visualRadius || BASE_FEATURE_RADIUS)) + PADDING;

    for (;;) {
      let totalAngle = 0;
      for (let i = 0; i < children.length; i++) {
        const r1 = children[i].data.visualRadius || BASE_FEATURE_RADIUS;
        const r2 = children[(i + 1) % children.length].data.visualRadius || BASE_FEATURE_RADIUS;
        const needed = (r1 + r2 + PADDING) / (2 * R);
        if (needed > 1) {
          totalAngle = 2 * Math.PI + 1;
          break;
        }
        totalAngle += 2 * Math.asin(needed) + SMALL_ANGLE_PADDING;
      }
      if (totalAngle <= 2 * Math.PI) break;
      R += INCREMENT;
    }

    let currentAngle = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const rCurr = child.data.visualRadius || BASE_FEATURE_RADIUS;
      child.position = {
        x: R * Math.cos(currentAngle),
        y: R * Math.sin(currentAngle),
      };
      const rNext = children[(i + 1) % children.length].data.visualRadius || BASE_FEATURE_RADIUS;
      currentAngle += 2 * Math.asin((rCurr + rNext + PADDING) / (2 * R)) + SMALL_ANGLE_PADDING;
    }

    const maxChildRadius = Math.max(...children.map(c => c.data.visualRadius || BASE_FEATURE_RADIUS));
    node.data.visualRadius = R + maxChildRadius + PADDING;
    node.position = { x: 0, y: 0 };
    return node.data.visualRadius;
  };

  const rootIds = Array.from(nodeMap.values())
    .filter(n => !n.data.parentNodeId || n.data.parentNodeId === 'Universe')
    .map(n => n.id);

  const pseudoRootId = '__root__';
  childrenByParent.set(pseudoRootId, rootIds);
  const pseudoRootNode: MapNode = {
    id: pseudoRootId,
    themeName: 'root',
    placeName: 'root',
    position: { x: 0, y: 0 },
    data: { description: 'root', nodeType: 'region', status: 'discovered' },
  };
  nodeMap.set(pseudoRootId, pseudoRootNode);

  layoutNode(pseudoRootId);

  /** Apply parent offsets recursively to convert relative positions to absolute. */
  const applyOffset = (nodeId: string, offsetX: number, offsetY: number) => {
    const node = nodeMap.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} missing in offset application`);
    if (nodeId !== pseudoRootId) {
      node.position = { x: node.position.x + offsetX, y: node.position.y + offsetY };
    }
    const childIds = childrenByParent.get(nodeId) || [];
    childIds.forEach(cid => { applyOffset(cid, node.position.x, node.position.y); });
  };

  applyOffset(pseudoRootId, 0, 0);

  nodeMap.delete(pseudoRootId);

  return Array.from(nodeMap.values());
};

