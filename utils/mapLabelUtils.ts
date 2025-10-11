/**
 * @file mapLabelUtils.ts
 * @description Utilities for label sizing and overlap handling on the map.
 */

import { MapNode } from '../types';
import {
  NODE_RADIUS,
  MAX_LABEL_LINES,
  DEFAULT_LABEL_MARGIN_PX,
  DEFAULT_LABEL_LINE_HEIGHT_EM,
} from '../constants';
import { isDescendantOf } from './mapGraphUtils';

const SMALL_FONT_TYPES = new Set(['feature', 'room', 'interior']);

/** Returns the radius for a node's circle. */
export const getRadiusForNode = (node: MapNode): number => {
  if (node.visualRadius) return node.visualRadius;
  switch (node.type) {
    case 'region':
      return NODE_RADIUS * 2.4;
    case 'location':
      return NODE_RADIUS * 2.0;
    case 'settlement':
      return NODE_RADIUS * 1.8;
    case 'district':
      return NODE_RADIUS * 1.6;
    case 'exterior':
      return NODE_RADIUS * 1.4;
    case 'interior':
      return NODE_RADIUS * 1.2;
    case 'room':
      return NODE_RADIUS * 0.8;
    case 'feature':
      return NODE_RADIUS * 0.6;
    default:
      return NODE_RADIUS * 0.6;
  }
};

/** Splits a label into multiple lines for display. */
export const splitTextIntoLines = (
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): Array<string> => {
  if (!text) return [];
  const words = text.split(' ');
  const lines: Array<string> = [];
  let currentLine = '';

  for (const word of words) {
    if (lines.length === maxLines) break;

    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      if (lines.length === maxLines) {
        if (word) {
          const lastLineContent = lines[maxLines - 1];
          if (lastLineContent.length > 3) {
            lines[maxLines - 1] = lastLineContent.slice(0, -3) + '...';
          } else {
            lines[maxLines - 1] = '..';
          }
        }
        currentLine = '';
        break;
      }
      currentLine = word;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  } else if (currentLine && lines.length === maxLines && lines[maxLines - 1] && !lines[maxLines - 1].endsWith('...')) {
    if (lines[maxLines - 1].length > 3) {
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -3) + '...';
    } else {
      lines[maxLines - 1] = '..';
    }
  }

  if (
    lines.length === maxLines &&
    text.split(' ').length > words.indexOf(currentLine.split(' ')[0]) + currentLine.split(' ').length
  ) {
    const lastLine = lines[maxLines - 1];
    if (lastLine && lastLine.length > 3 && !lastLine.endsWith('...')) {
      lines[maxLines - 1] = lastLine.slice(0, Math.max(0, lastLine.length - 3)) + '...';
    } else if (lastLine && !lastLine.endsWith('...')) {
      lines[maxLines - 1] = '..';
    }
  }
  return lines;
};

export const isSmallFontType = (type: string | undefined) =>
  !!type && SMALL_FONT_TYPES.has(type);

export const hasCenteredLabel = (type: string | undefined) => type === 'feature';

/**
 * Calculate extra vertical offset for labels when they overlap. Feature labels
 * stay fixed while sibling and descendant non-feature labels may shift down.
 * Only immediate left/right siblings are considered for overlap checks.
 */
export const calculateLabelOffsets = (
  nodes: Array<MapNode>,
  labelOverlapMarginPx: number,
): Record<string, number> => {
  const idToNode = new Map(nodes.map(n => [n.id, n]));

  const childrenMap = new Map<string, Array<MapNode>>();
  nodes.forEach(n => {
    if (n.parentNodeId) {
      const arr = childrenMap.get(n.parentNodeId) ?? [];
      arr.push(n);
      childrenMap.set(n.parentNodeId, arr);
    }
  });

  const depthCache = new Map<string, number>();
  const getDepth = (node: MapNode | undefined): number => {
    if (!node) return 0;
    const cached = depthCache.get(node.id);
    if (cached !== undefined) return cached;
    const parent = node.parentNodeId ? idToNode.get(node.parentNodeId) : undefined;
    const depth = parent ? getDepth(parent) + 1 : 0;
    depthCache.set(node.id, depth);
    return depth;
  };
  nodes.forEach(n => getDepth(n));

  const isParent = (n: MapNode) => childrenMap.has(n.id);

  const fontSizeFor = (n: MapNode) => (isSmallFontType(n.type) ? 7 : 12);
  const linesCache: Record<string, Array<string> | undefined> = {};
  const getLines = (n: MapNode): Array<string> => {
    const cached = linesCache[n.id];
    if (cached) return cached;
    const maxChars = isSmallFontType(n.type) || !isParent(n) ? 20 : 25;
    const lines = splitTextIntoLines(n.placeName, maxChars, MAX_LABEL_LINES);
    linesCache[n.id] = lines;
    return lines;
  };

  const labelHeight = (n: MapNode) => getLines(n).length * fontSizeFor(n) * DEFAULT_LABEL_LINE_HEIGHT_EM;

  const labelWidth = (n: MapNode) => Math.max(...getLines(n).map(line => line.length * fontSizeFor(n) * 0.6));

  const getLabelBox = (n: MapNode, offset: number) => {
    const width = labelWidth(n);
    const height = labelHeight(n);
    if (hasCenteredLabel(n.type)) {
      return {
        x: n.position.x - width / 2,
        y: n.position.y - height / 2,
        width,
        height: height * 2,
      };
    }
    const base = getRadiusForNode(n) + DEFAULT_LABEL_MARGIN_PX + offset;
    return {
      x: n.position.x - width / 2,
      y: n.position.y + base,
      width,
      height,
    };
  };

  const offsets: Record<string, number> = {};
  nodes.forEach(n => {
    offsets[n.id] = 0;
  });

  const boxesOverlap = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  childrenMap.forEach(siblings => {
    const ordered = [...siblings].sort((a, b) => a.position.x - b.position.x);
    for (let i = 1; i < ordered.length; i++) {
      const left = ordered[i - 1];
      const right = ordered[i];

      let boxLeft = getLabelBox(left, offsets[left.id]);
      let boxRight = getLabelBox(right, offsets[right.id]);

      if (boxesOverlap(boxLeft, boxRight)) {
        const delta = boxLeft.y + boxLeft.height - boxRight.y + labelOverlapMarginPx;
        if (right.type !== 'feature') {
          offsets[right.id] += delta;
          boxRight = getLabelBox(right, offsets[right.id]);
        } else if (left.type !== 'feature') {
          offsets[left.id] += delta;
          boxLeft = getLabelBox(left, offsets[left.id]);
        }
      }
    }
  });

  nodes.forEach(node => {
    if (node.type === 'feature') return;
    const featureDescendants = nodes.filter(n => n.type === 'feature' && isDescendantOf(n, node, idToNode));
    for (const feature of featureDescendants) {
      const nodeBox = getLabelBox(node, offsets[node.id]);
      const featureBox = getLabelBox(feature, offsets[feature.id]);
      if (boxesOverlap(nodeBox, featureBox)) {
        const delta = featureBox.y + featureBox.height - nodeBox.y + labelOverlapMarginPx;
        offsets[node.id] += delta;
      }
    }
  });

  return offsets;
};
