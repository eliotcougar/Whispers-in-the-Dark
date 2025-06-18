/**
 * @file MapNodeView.tsx
 * @description SVG view rendering map nodes and edges with tooltip interactions.
 */

import { useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react';

import * as React from 'react';
import { MapNode, MapEdge } from '../../types';
import { useMapInteractions } from '../../hooks/useMapInteractions';
import {
  NODE_RADIUS,
  EDGE_HOVER_WIDTH,
  MAX_LABEL_LINES,
  DEFAULT_LABEL_MARGIN_PX,
  DEFAULT_LABEL_LINE_HEIGHT_EM,
} from '../../constants';
import { MapItemBoxIcon, MapWheelIcon } from '../icons';
import { isDescendantOf } from '../../utils/mapGraphUtils';
import { getSVGCoordinates, getScreenCoordinates } from '../../utils/svgUtils';

const buildShortcutPath = (a: MapNode, b: MapNode): string => {
  const x1 = a.position.x;
  const y1 = a.position.y;
  const x2 = b.position.x;
  const y2 = b.position.y;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const offset = dist * 0.3;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const cx = midX + perpX * offset;
  const cy = midY + perpY * offset;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
};

interface MapNodeViewProps {
  readonly nodes: MapNode[];
  readonly edges: MapEdge[];
  readonly currentMapNodeId: string | null;
  readonly destinationNodeId: string | null;
  /** Mapping of nodeId to presence of useful items and vehicles */
  readonly itemPresenceByNode: Record<string, { hasUseful: boolean; hasVehicle: boolean } | undefined>;
  readonly onSelectDestination: (nodeId: string | null) => void;
  readonly labelOverlapMarginPx: number;
  /** Fraction of node diameter for item icon size */
  readonly itemIconScale: number;
  readonly initialViewBox: string;
  readonly onViewBoxChange: (viewBox: string) => void;
}

/**
 * Empty map used as the default value for {@link MapNodeViewProps.itemPresenceByNode}.
 */
const EMPTY_ITEM_PRESENCE_BY_NODE: Record<string, { hasUseful: boolean; hasVehicle: boolean } | undefined> = {};

/**
 * Returns the radius for a node's circle. Uses the computed visualRadius from
 * nested layouts when available, otherwise falls back to a default based on the
 * node type.
 */
const getRadiusForNode = (node: MapNode): number => {
  if (node.data.visualRadius) return node.data.visualRadius;
  switch (node.data.nodeType) {
    case 'region':
      // Larger size so that child circles and labels can fit inside.
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
const splitTextIntoLines = (text: string, maxCharsPerLine: number, maxLines: number): string[] => {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
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

  if (lines.length === maxLines && text.split(' ').length > words.indexOf(currentLine.split(' ')[0]) + currentLine.split(' ').length) {
    const lastLine = lines[maxLines - 1];
    if (lastLine && lastLine.length > 3 && !lastLine.endsWith('...')) {
      lines[maxLines - 1] = lastLine.slice(0, Math.max(0, lastLine.length - 3)) + '...';
    } else if (lastLine && !lastLine.endsWith('...')) {
      lines[maxLines - 1] = '..';
    }
  }
  return lines;
};

/**
 * SVG view for rendering map nodes and edges with tooltips.
 */
function MapNodeView({
  nodes,
  edges,
  currentMapNodeId,
  destinationNodeId,
  itemPresenceByNode = EMPTY_ITEM_PRESENCE_BY_NODE,
  onSelectDestination,
  labelOverlapMarginPx,
  itemIconScale,
  initialViewBox,
  onViewBoxChange,
}: MapNodeViewProps) {
  const interactions = useMapInteractions(initialViewBox, onViewBoxChange);
  const { svgRef, viewBox, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd } = interactions;
  const [tooltip, setTooltip] = useState<{
    content: string;
    svgX: number;
    svgY: number;
    anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    nodeId?: string;
  } | null>(null);
  const [isTooltipLocked, setIsTooltipLocked] = useState(false);
  const tooltipTimeout = useRef<number | null>(null);
  const TOOLTIP_DELAY_MS = 250;

  const [tooltipScreenPosition, setTooltipScreenPosition] = useState<
    { x: number; y: number } | null
  >(null);

  // Recalculate tooltip position when viewBox changes so it stays anchored
  // during panning or zooming.
  useLayoutEffect(() => {
    if (!tooltip || !svgRef.current) {
      setTooltipScreenPosition(null);
      return;
    }
    const { x, y } = getScreenCoordinates(
      svgRef.current,
      tooltip.svgX,
      tooltip.svgY
    );
    const rect = svgRef.current.getBoundingClientRect();
    setTooltipScreenPosition({ x: x - rect.left, y: y - rect.top });
  }, [tooltip, viewBox, svgRef]);

  const isSmallFontType = (type: string | undefined) =>
    type === 'feature' || type === 'room' || type === 'interior';

  const hasCenteredLabel = (type: string | undefined) => type === 'feature';

  const computeAnchor = (
    x: number,
    y: number,
    rect: DOMRect
  ): 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' => {
    const horizontal = x > rect.width / 2 ? 'right' : 'left';
    const vertical = y > rect.height * 0.75 ? 'bottom' : 'top';
    return `${vertical}-${horizontal}` as const;
  };



  /**
   * Calculate extra vertical offset for labels when they overlap. Feature labels
   * stay fixed while sibling and descendant non-feature labels may shift down.
   * Only immediate left/right siblings are considered for overlap checks.
   */
  const labelOffsetMap = useMemo(() => {
    const idToNode = new Map(nodes.map(n => [n.id, n]));

    const childrenMap = new Map<string, MapNode[]>();
    nodes.forEach(n => {
      if (n.data.parentNodeId) {
        const arr = childrenMap.get(n.data.parentNodeId) || [];
        arr.push(n);
        childrenMap.set(n.data.parentNodeId, arr);
      }
    });

    const depthCache = new Map<string, number>();
    const getDepth = (node: MapNode | undefined): number => {
      if (!node) return 0;
      const cached = depthCache.get(node.id);
      if (cached !== undefined) return cached;
      const parent = node.data.parentNodeId ? idToNode.get(node.data.parentNodeId) : undefined;
      const depth = parent ? getDepth(parent) + 1 : 0;
      depthCache.set(node.id, depth);
      return depth;
    };
    nodes.forEach(n => getDepth(n));

    const isParent = (n: MapNode) => childrenMap.has(n.id);

    const fontSizeFor = (n: MapNode) => (isSmallFontType(n.data.nodeType) ? 7 : 12);
      const linesCache: Record<string, string[] | undefined> = {};
      const getLines = (n: MapNode): string[] => {
        const cached = linesCache[n.id];
        if (cached) return cached;
        const maxChars = isSmallFontType(n.data.nodeType) || !isParent(n) ? 20 : 25;
        const lines = splitTextIntoLines(n.placeName, maxChars, MAX_LABEL_LINES);
        linesCache[n.id] = lines;
        return lines;
      };

    const labelHeight = (n: MapNode) =>
      getLines(n).length * fontSizeFor(n) * DEFAULT_LABEL_LINE_HEIGHT_EM;

    const labelWidth = (n: MapNode) =>
      Math.max(
        ...getLines(n).map(line => line.length * fontSizeFor(n) * 0.6)
      );

    const getLabelBox = (n: MapNode, offset: number) => {
      const width = labelWidth(n);
      const height = labelHeight(n);
      if (hasCenteredLabel(n.data.nodeType)) {
        return {
          x: n.position.x - width / 2,
          y: n.position.y - height / 2,
          width,
          height : height * 2,
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

    // Helper to test bounding box overlap
    const boxesOverlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

    // Shift siblings that overlap. Only immediate neighbors are checked.
    childrenMap.forEach(siblings => {
      const ordered = [...siblings].sort((a, b) => a.position.x - b.position.x);
      for (let i = 1; i < ordered.length; i++) {
        const left = ordered[i - 1];
        const right = ordered[i];

        let boxLeft = getLabelBox(left, offsets[left.id]);
        let boxRight = getLabelBox(right, offsets[right.id]);

        if (boxesOverlap(boxLeft, boxRight)) {
          const delta = boxLeft.y + boxLeft.height - boxRight.y + labelOverlapMarginPx;
          if (right.data.nodeType !== 'feature') {
            offsets[right.id] += delta;
            boxRight = getLabelBox(right, offsets[right.id]);
          } else if (left.data.nodeType !== 'feature') {
            offsets[left.id] += delta;
            boxLeft = getLabelBox(left, offsets[left.id]);
          }
        }
      }
    });

    // Non-feature nodes must also avoid overlapping any feature descendants
    nodes.forEach(node => {
      if (node.data.nodeType === 'feature') return;
      const featureDescendants = nodes.filter(n => n.data.nodeType === 'feature' && isDescendantOf(n, node, idToNode));
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
  }, [nodes, labelOverlapMarginPx]);

  /** Map node depth for rendering order */
  const depthMap = useMemo(() => {
    const idToNode = new Map(nodes.map(n => [n.id, n]));
    const cache = new Map<string, number>();
    const getDepth = (n: MapNode | undefined): number => {
      if (!n) return 0;
      const cached = cache.get(n.id);
      if (cached !== undefined) return cached;
      const parent = n.data.parentNodeId ? idToNode.get(n.data.parentNodeId) : undefined;
      const depth = parent ? getDepth(parent) + 1 : 0;
      cache.set(n.id, depth);
      return depth;
    };
    nodes.forEach(n => getDepth(n));
    return cache;
  }, [nodes]);

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => (depthMap.get(a.id) ?? 0) - (depthMap.get(b.id) ?? 0)),
    [nodes, depthMap]
  );

  const destinationMarker = useMemo(() => {
    if (!destinationNodeId) return null;
    const dest = nodes.find(n => n.id === destinationNodeId);
    const current = currentMapNodeId ? nodes.find(n => n.id === currentMapNodeId) : null;
    if (!dest) return null;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    if (current && (current.id === dest.id || isDescendantOf(current, dest, nodeMap))) {
      return null;
    }
    return (
      <polygon
        className="map-destination-marker"
        pointerEvents="none"
        points="0,-14 10,0 0,14 -10,0"
        transform={`translate(${dest.position.x}, ${dest.position.y})`}
      />
    );
  }, [destinationNodeId, nodes, currentMapNodeId]);


  /** Hides the tooltip. */
  const handleMouseLeaveGeneral = useCallback(function handleMouseLeaveGeneral() {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = null;
    }
    if (!isTooltipLocked) setTooltip(null);
  }, [isTooltipLocked]);

  const handleSvgClick = useCallback(function handleSvgClick(event: React.MouseEvent<SVGSVGElement>) {
    const target = event.target as Element;
    if (!target.closest('.map-node') && !target.closest('.map-edge-group')) {
      setIsTooltipLocked(false);
      setTooltip(null);
    }
  }, []);

  const handleEdgeMouseEnterById = useCallback(function handleEdgeMouseEnterById(
    event: React.MouseEvent<SVGGElement>
  ) {
      if (isTooltipLocked) return;
      const edgeId = event.currentTarget.dataset.edgeId;
      if (!edgeId) return;
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return;
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const x = event.clientX - svgRect.left;
      const y = event.clientY - svgRect.top;
      const svgCoords = svgRef.current
        ? getSVGCoordinates(svgRef.current, event.clientX, event.clientY)
        : { x: 0, y: 0 };
      const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
      const targetNode = nodes.find(n => n.id === edge.targetNodeId);
      let content = edge.data.description
        ? edge.data.description
        : `Path between ${sourceNode?.placeName || 'Unknown'} and ${targetNode?.placeName || 'Unknown'}`;
      if (edge.data.travelTime) content += `\n${edge.data.travelTime}`;
      if (edge.data.status) content += `\nStatus: ${edge.data.status}`;
      const anchor = computeAnchor(x, y, svgRect);
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = window.setTimeout(() => {
        setTooltip({ content, svgX: svgCoords.x, svgY: svgCoords.y, anchor });
      }, TOOLTIP_DELAY_MS);
    },
    [edges, isTooltipLocked, nodes, svgRef]
  );

  const handleNodeMouseEnterById = useCallback(function handleNodeMouseEnterById(
    event: React.MouseEvent<Element>
  ) {
      if (isTooltipLocked) return;
      const nodeId = event.currentTarget.getAttribute('data-node-id');
      if (!nodeId) return;
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const x = event.clientX - svgRect.left;
      const y = event.clientY - svgRect.top;
      const svgCoords = svgRef.current
        ? getSVGCoordinates(svgRef.current, event.clientX, event.clientY)
        : { x: 0, y: 0 };
      let content = `${node.placeName}`;
      if (node.data.aliases && node.data.aliases.length > 0) content += ` (aka ${node.data.aliases.join(', ')})`;
      if (node.data.description) content += `\n${node.data.description}`;
      content += `\nStatus: ${node.data.status}`;
      const anchor = computeAnchor(x, y, svgRect);
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = window.setTimeout(() => {
        setTooltip({ content, svgX: svgCoords.x, svgY: svgCoords.y, anchor, nodeId });
      }, TOOLTIP_DELAY_MS);
    },
    [isTooltipLocked, nodes, svgRef]
  );

  const handleNodeClickById = useCallback(function handleNodeClickById(
    event: React.MouseEvent<Element>
  ) {
      event.stopPropagation();
      const nodeId = event.currentTarget.getAttribute('data-node-id');
      if (!nodeId) return;
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      if (tooltipTimeout.current) {
        clearTimeout(tooltipTimeout.current);
        tooltipTimeout.current = null;
      }
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const x = event.clientX - svgRect.left;
      const y = event.clientY - svgRect.top;
      const svgCoords = svgRef.current
        ? getSVGCoordinates(svgRef.current, event.clientX, event.clientY)
        : { x: 0, y: 0 };
      let content = `${node.placeName}`;
      if (node.data.aliases && node.data.aliases.length > 0) content += ` (aka ${node.data.aliases.join(', ')})`;
      if (node.data.description) content += `\n${node.data.description}`;
      content += `\nStatus: ${node.data.status}`;
      setIsTooltipLocked(true);
      const anchor = computeAnchor(x, y, svgRect);
      setTooltip({ content, svgX: svgCoords.x, svgY: svgCoords.y, anchor, nodeId });
    },
    [nodes, svgRef]
  );

  const handleDestinationClick = useCallback(function handleDestinationClick(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
      const nodeId = event.currentTarget.dataset.nodeId;
      if (!nodeId) return;
      if (nodeId === destinationNodeId) {
        onSelectDestination(null);
      } else {
        onSelectDestination(nodeId);
      }
      setIsTooltipLocked(false);
      setTooltip(null);
    },
    [destinationNodeId, onSelectDestination]
  );

  if (nodes.length === 0) {
    return (
      <div className="map-content-area">
        <p className="text-slate-500 italic">
          No map data available for this theme yet.
        </p>
      </div>
    );
  }

  return (
    <div className="map-content-area">
      <svg
        className="map-svg-container"
        onClick={handleSvgClick}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        onWheel={handleWheel}
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        viewBox={viewBox}
      >
        <g>

          {edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
            const targetNode = nodes.find(n => n.id === edge.targetNodeId);
            if (!sourceNode || !targetNode) return null;
            let edgeClass = 'map-edge';
            if (edge.data.type) edgeClass += ` ${edge.data.type.replace(/\s+/g, '_').toLowerCase()}`;
            if (edge.data.status) edgeClass += ` ${edge.data.status.replace(/\s+/g, '_').toLowerCase()}`;
            return (
              <g
                className="map-edge-group"
                data-edge-id={edge.id}
                key={edge.id}
                onMouseEnter={handleEdgeMouseEnterById}
                onMouseLeave={handleMouseLeaveGeneral}
              >
                {edge.data.type === 'shortcut' ? (
                  <>
                    <path
                      d={buildShortcutPath(sourceNode, targetNode)}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={EDGE_HOVER_WIDTH}
                    />

                    <path
                      className={edgeClass}
                      d={buildShortcutPath(sourceNode, targetNode)}
                    />
                  </>
                ) : (
                  <>
                    <line
                      stroke="transparent"
                      strokeWidth={EDGE_HOVER_WIDTH}
                      x1={sourceNode.position.x}
                      x2={targetNode.position.x}
                      y1={sourceNode.position.y}
                      y2={targetNode.position.y}
                    />

                    <line
                      className={edgeClass}
                      x1={sourceNode.position.x}
                      x2={targetNode.position.x}
                      y1={sourceNode.position.y}
                      y2={targetNode.position.y}
                    />
                  </>
                )}
              </g>
            );
          })}

          {sortedNodes.map(node => {
            let nodeClass = 'map-node-circle';
            nodeClass += ` ${node.data.nodeType}`;
            if (node.id === currentMapNodeId) nodeClass += ' current';
            const sanitizedStatus = node.data.status.replace(/\s+/g, '_').toLowerCase();
            nodeClass += ` ${sanitizedStatus}`;
            const radius = getRadiusForNode(node);
            return (
              <g
                className="map-node"
                data-node-id={node.id}
                key={node.id}
                onClick={handleNodeClickById}
                onMouseLeave={handleMouseLeaveGeneral}
                transform={`translate(${node.position.x}, ${node.position.y})`}
              >
                <circle
                  className={nodeClass}
                  data-node-id={node.id}
                  onMouseEnter={
                    node.data.nodeType === 'feature' ? handleNodeMouseEnterById : undefined
                  }
                  onMouseLeave={
                    node.data.nodeType === 'feature'
                      ? handleMouseLeaveGeneral
                      : undefined
                  }
                  pointerEvents={
                    node.data.nodeType === 'feature' ? 'visible' : 'none'
                  }
                  r={radius}
                />

                <circle
                  className="map-node-hover-ring"
                  data-node-id={node.id}
                  fill="none"
                  onMouseEnter={handleNodeMouseEnterById}
                  onMouseLeave={handleMouseLeaveGeneral}
                  pointerEvents="stroke"
                  r={radius}
                  stroke="transparent"
                  strokeWidth={8}
                />
              </g>
            );
          })}

          {destinationMarker}

          {sortedNodes.map(node => {
          const presence = itemPresenceByNode[node.id] ?? { hasUseful: false, hasVehicle: false };
          if (!presence.hasUseful && !presence.hasVehicle) return null;
          const radius = getRadiusForNode(node);
          const offset = radius + DEFAULT_LABEL_MARGIN_PX * 1.5;
          const iconSize = NODE_RADIUS * 2 * itemIconScale;
          const usefulX = node.position.x + offset * Math.sin((20 * Math.PI) / 180) - iconSize / 2;
          const usefulY = node.position.y - offset * Math.cos((20 * Math.PI) / 180) - iconSize / 2;
          const vehicleX = node.position.x + offset * Math.sin((340 * Math.PI) / 180) - iconSize / 2;
          const vehicleY = node.position.y - offset * Math.cos((340 * Math.PI) / 180) - iconSize / 2;
          return (
            <g key={`${node.id}-icons`}>
              {presence.hasUseful ? (
                <g
                  pointerEvents="none"
                  transform={`translate(${usefulX}, ${usefulY})`}
                >
                  <MapItemBoxIcon
                    className="text-green-400"
                    size={iconSize}
                  />
                </g>
              ) : null}

              {presence.hasVehicle ? (
                <g
                  pointerEvents="none"
                  transform={`translate(${vehicleX}, ${vehicleY})`}
                >
                  <MapWheelIcon
                    className="text-green-400"
                    size={iconSize}
                  />
                </g>
              ) : null}
            </g>
          );
        })}

          {sortedNodes.map(node => {
            const maxCharsPerLine =
              isSmallFontType(node.data.nodeType) ? 20 : 25;
            const labelLines = splitTextIntoLines(
              node.placeName,
              maxCharsPerLine,
              MAX_LABEL_LINES
            );
            const radius = getRadiusForNode(node);
            const fontSize = isSmallFontType(node.data.nodeType) ? 7 : 12;
            const baseOffsetPx = radius + DEFAULT_LABEL_MARGIN_PX + (labelOffsetMap[node.id] || 0);
            const initialDyOffset =
              hasCenteredLabel(node.data.nodeType)
                ? -(labelLines.length - 1) * 0.5 * DEFAULT_LABEL_LINE_HEIGHT_EM + 0.3
                : baseOffsetPx / fontSize;

            return (
              <text
                className={`map-node-label${
                  isSmallFontType(node.data.nodeType)
                    ? node.data.nodeType === 'feature'
                      ? ' feature-label'
                      : node.data.nodeType === 'room'
                        ? ' room-label'
                        : ' interior-label'
                    : ''
                }`}
                data-node-id={node.id}
                key={`label-${node.id}`}
                onMouseEnter={handleNodeMouseEnterById}
                onMouseLeave={handleMouseLeaveGeneral}
                pointerEvents="visible"
                transform={`translate(${node.position.x}, ${node.position.y})`}
              >
                {labelLines.map((line, index) => (
                  <tspan
                    dy={index === 0 ? `${initialDyOffset}em` : `${DEFAULT_LABEL_LINE_HEIGHT_EM}em`}
                    key={`${node.id}-${line}`}
                    x="0"
                  >
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </g>
      </svg>

      {tooltip && tooltipScreenPosition ? <div
        className={`map-tooltip anchor-${tooltip.anchor}`}
        style={{ top: tooltipScreenPosition.y, left: tooltipScreenPosition.x, pointerEvents: isTooltipLocked ? 'auto' : 'none' }}
                                          >
        {isTooltipLocked && tooltip.nodeId ? <button
          className="map-set-destination-button"
          data-node-id={tooltip.nodeId}
          onClick={handleDestinationClick}
          type="button"
                                             >
          {tooltip.nodeId === destinationNodeId
                ? 'Remove Destination'
                : 'Set Destination'}
        </button> : null}

        {tooltip.content.split('\n').map((line, index) => (
          <React.Fragment key={`${tooltip.nodeId}-${line}`}> 
            {index === 0 ? <strong>
              {line}
            </strong> : line}

            {index < tooltip.content.split('\n').length - 1 && <br />}
          </React.Fragment>
          ))}
      </div> : null}
    </div>
  );
}

export default MapNodeView;
