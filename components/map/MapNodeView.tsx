/**
 * @file MapNodeView.tsx
 * @description SVG view rendering map nodes and edges with tooltip interactions.
 */

import { useMemo } from 'react';

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
import { Icon } from '../elements/icons';
import Button from '../elements/Button';
import { isDescendantOf } from '../../utils/mapGraphUtils';
import { calculateLabelOffsets, getRadiusForNode, splitTextIntoLines, isSmallFontType, hasCenteredLabel } from '../../utils/mapLabelUtils';
import { useMapTooltip } from '../../hooks/useMapTooltip';

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
  return `M ${String(x1)} ${String(y1)} Q ${String(cx)} ${String(cy)} ${String(x2)} ${String(y2)}`;
};

interface MapNodeViewProps {
  readonly nodes: Array<MapNode>;
  readonly edges: Array<MapEdge>;
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
  const {
    tooltip,
    tooltipScreenPosition,
    isTooltipLocked,
    handleMouseLeaveGeneral,
    handleSvgClick,
    handleEdgeMouseEnterById,
    handleNodeMouseEnterById,
    handleNodeClickById,
    handleDestinationClick,
  } = useMapTooltip({
    nodes,
    edges,
    svgRef,
    viewBox,
    destinationNodeId,
    onSelectDestination,
  });

  // Utility helpers imported from mapLabelUtils



  const labelOffsetMap = useMemo(
    () => calculateLabelOffsets(nodes, labelOverlapMarginPx),
    [nodes, labelOverlapMarginPx]
  );

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
        transform={`translate(${String(dest.position.x)}, ${String(dest.position.y)})`}
      />
    );
  }, [destinationNodeId, nodes, currentMapNodeId]);



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
                transform={`translate(${String(node.position.x)}, ${String(node.position.y)})`}
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

          {sortedNodes.map(node => { // TODO: A separate icon for immovable items.
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
                  transform={`translate(${String(usefulX)}, ${String(usefulY)})`}
                >
                  <Icon
                    color="green"
                    name="mapItemBox"
                    size={iconSize}
                    wrapper="g"
                  />
                </g>
                ) : null}

              {presence.hasVehicle ? (
                <g
                  pointerEvents="none"
                  transform={`translate(${String(vehicleX)}, ${String(vehicleY)})`}
                >
                  <Icon
                    color="green"
                    name="mapWheel"
                    size={iconSize}
                    wrapper="g"
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
            const baseOffsetPx = radius + DEFAULT_LABEL_MARGIN_PX + (labelOffsetMap[node.id] ?? 0);
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
                transform={`translate(${String(node.position.x)}, ${String(node.position.y)})`}
              >
                {labelLines.map((line, index) => (
                  <tspan
                    dy={index === 0 ? `${String(initialDyOffset)}em` : `${String(DEFAULT_LABEL_LINE_HEIGHT_EM)}em`}
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
        {isTooltipLocked && tooltip.nodeId ? (
          <div className="mb-1">
            <Button
              ariaLabel={
                tooltip.nodeId === destinationNodeId
                  ? 'Remove Destination'
                  : 'Set Destination'
              }
              data-node-id={tooltip.nodeId}
              label={
                tooltip.nodeId === destinationNodeId
                  ? 'Remove Destination'
                  : 'Set Destination'
              }
              onClick={handleDestinationClick}
              preset="amber"
              size="sm"
              variant="standard"
            />
          </div>
        ) : null}

        {tooltip.content.split('\n').map((line, index) => (
          <React.Fragment key={`${String(tooltip.nodeId)}-${line}`}>
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
