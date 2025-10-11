
/**
 * @file mapLayoutUtils.ts
 * @description Utilities for computing a nested circle layout for map nodes.
 * The algorithm allocates extra padding so that child node circles and labels
 * fit comfortably inside their parent. Angle padding shrinks for groups with
 * many children to keep large maps compact. After placement, child groups are
 * recentred around their bounds so parents shrink to the tightest circle that
 * encloses all children.
*/

import { MapNode } from '../types';
import { structuredCloneGameState } from './cloneUtils';
import { NODE_RADIUS, ROOT_MAP_NODE_ID } from '../constants';

export const DEFAULT_IDEAL_EDGE_LENGTH = 140;
export const DEFAULT_NESTED_PADDING = 10;
export const DEFAULT_NESTED_ANGLE_PADDING = 0.15;

const roundMetric = (value: number, decimals = 3): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

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
  const childrenByParent = new Map<string, Array<string>>();
  nodeMap.forEach(node => {
    const pid = node.parentNodeId && node.parentNodeId !== ROOT_MAP_NODE_ID ? node.parentNodeId : undefined;
    if (pid) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      const arr = childrenByParent.get(pid);
      if (arr) arr.push(node.id);
    }
  });

  const BASE_FEATURE_RADIUS = NODE_RADIUS;
  const PADDING = config?.padding ?? DEFAULT_NESTED_PADDING;
  const BASE_ANGLE_PADDING = config?.anglePadding ?? DEFAULT_NESTED_ANGLE_PADDING;
  const INCREMENT = 2;

  /**
   * Recursively layouts a node's children returning the radius for that node.
   * Positions are stored relative to the node itself.
   */
  const layoutNode = (nodeId: string): number => {
    const node = nodeMap.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} missing in layout`);
    const childIds = childrenByParent.get(nodeId) ?? [];
    const anglePadding = BASE_ANGLE_PADDING / Math.max(1, Math.sqrt(childIds.length));

    if (childIds.length === 0) {
      node.visualRadius = BASE_FEATURE_RADIUS;
      node.position = { x: 0, y: 0 };
      return node.visualRadius;
    }

    // Layout children first
    childIds.forEach(cid => layoutNode(cid));

    if (childIds.length === 1) {
      const onlyChild = nodeMap.get(childIds[0]);
      if (!onlyChild) throw new Error('Child node missing');
      onlyChild.position = { x: 0, y: 0 };
      node.visualRadius = (onlyChild.visualRadius ?? BASE_FEATURE_RADIUS) + PADDING;
      node.position = { x: 0, y: 0 };
      return node.visualRadius;
    }

    const children = childIds
      .map(cid => {
        const child = nodeMap.get(cid);
        if (!child) throw new Error('Child node missing');
        return child;
      })
      .sort(
        (a, b) =>
          (b.visualRadius ?? BASE_FEATURE_RADIUS) -
          (a.visualRadius ?? BASE_FEATURE_RADIUS)
      );

    let R = Math.max(...children.map(child => child.visualRadius ?? BASE_FEATURE_RADIUS)) + PADDING;

    for (;;) {
      let totalAngle = 0;
      for (let i = 0; i < children.length; i++) {
        const r1 = children[i].visualRadius ?? BASE_FEATURE_RADIUS;
        const r2 = children[(i + 1) % children.length].visualRadius ?? BASE_FEATURE_RADIUS;
        const needed = (r1 + r2 + PADDING) / (2 * R);
        if (needed > 1) {
          totalAngle = 2 * Math.PI + 1;
          break;
        }
        totalAngle += 2 * Math.asin(needed) + anglePadding;
      }
      if (totalAngle <= 2 * Math.PI) break;
      R += INCREMENT;
    }

    let totalAngleUsed = 0;
    for (let i = 0; i < children.length; i++) {
      const r1 = children[i].visualRadius ?? BASE_FEATURE_RADIUS;
      const r2 = children[(i + 1) % children.length].visualRadius ?? BASE_FEATURE_RADIUS;
      totalAngleUsed += 2 * Math.asin((r1 + r2 + PADDING) / (2 * R)) + anglePadding;
    }

    let currentAngle = Math.max(0, (2 * Math.PI - totalAngleUsed) / 2);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const rCurr = child.visualRadius ?? BASE_FEATURE_RADIUS;
      child.position = {
        x: R * Math.cos(currentAngle),
        y: R * Math.sin(currentAngle),
      };
      const rNext = children[(i + 1) % children.length].visualRadius ?? BASE_FEATURE_RADIUS;
      currentAngle += 2 * Math.asin((rCurr + rNext + PADDING) / (2 * R)) + anglePadding;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    children.forEach(child => {
      const r = child.visualRadius ?? BASE_FEATURE_RADIUS;
      minX = Math.min(minX, child.position.x - r);
      maxX = Math.max(maxX, child.position.x + r);
      minY = Math.min(minY, child.position.y - r);
      maxY = Math.max(maxY, child.position.y + r);
    });
    const offsetX = (minX + maxX) / 2;
    const offsetY = (minY + maxY) / 2;
    children.forEach(child => {
      child.position.x -= offsetX;
      child.position.y -= offsetY;
    });

    const radius =
      Math.max(
        ...children.map(child => {
          const r = child.visualRadius ?? BASE_FEATURE_RADIUS;
          return Math.hypot(child.position.x, child.position.y) + r;
        })
      ) + PADDING;
    node.visualRadius = radius;
    node.position = { x: 0, y: 0 };
    return node.visualRadius;
  };

  const rootIds = Array.from(nodeMap.values())
    .filter(n => !n.parentNodeId || n.parentNodeId === ROOT_MAP_NODE_ID)
    .map(n => n.id);

  const pseudoRootId = '__root__';
  childrenByParent.set(pseudoRootId, rootIds);
  const pseudoRootNode: MapNode = {
    id: pseudoRootId,
    placeName: 'root',
    position: { x: 0, y: 0 },
    description: 'root',
    type: 'region',
    status: 'discovered',
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
    const childIds = childrenByParent.get(nodeId) ?? [];
    childIds.forEach(cid => { applyOffset(cid, node.position.x, node.position.y); });
  };

  applyOffset(pseudoRootId, 0, 0);

  nodeMap.delete(pseudoRootId);

  nodeMap.forEach(node => {
    node.position = {
      x: roundMetric(node.position.x),
      y: roundMetric(node.position.y),
    };
    if (typeof node.visualRadius === 'number') {
      node.visualRadius = roundMetric(node.visualRadius);
    }
  });

  return Array.from(nodeMap.values());
};
