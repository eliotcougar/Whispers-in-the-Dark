/**
 * @file MapNodeView.tsx
 * @description SVG view rendering map nodes and edges with tooltip interactions.
 */

import React, { useMemo, useState } from 'react';
import { MapNode, MapEdge } from '../../types';
import useMapInteractions from '../../hooks/useMapInteractions';
import {
  NODE_RADIUS,
  EDGE_HOVER_WIDTH,
  MAX_LABEL_LINES,
  LABEL_LINE_HEIGHT_EM,
} from '../../utils/mapConstants';

interface MapNodeViewProps {
  nodes: MapNode[];
  edges: MapEdge[];
  currentMapNodeId: string | null;
  layoutIdealEdgeLength: number;
}

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
    case 'city':
      return NODE_RADIUS * 1.8;
    case 'building':
      return NODE_RADIUS * 1.3;
    case 'room':
      return NODE_RADIUS * 0.8;
    case 'feature':
      return NODE_RADIUS * 0.6;
    default:
      return NODE_RADIUS;
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
const MapNodeView: React.FC<MapNodeViewProps> = ({ nodes, edges, currentMapNodeId, layoutIdealEdgeLength }) => {
  const interactions = useMapInteractions();
  const { svgRef, viewBox, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd } = interactions;
  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);

  /**
   * Parent nodes that contain other nodes. Used for drawing large region
   * circles around groups of nodes.
   */
  const regionCircles = useMemo(() => {
    return nodes
      .filter(parent => nodes.some(n => n.data.parentNodeId === parent.id))
      .map(parent => {
        if (parent.data.visualRadius) {
          return { node: parent, radius: parent.data.visualRadius };
        }
        const children = nodes.filter(n => n.data.parentNodeId === parent.id);
        const maxDistance = children.length > 0
          ? Math.max(
              ...children.map(c =>
                Math.hypot(c.position.x - parent.position.x, c.position.y - parent.position.y)
              )
            )
          : 0;
        return {
          node: parent,
          radius: Math.max(layoutIdealEdgeLength, maxDistance + NODE_RADIUS * 1.5),
        };
      });
  }, [nodes, layoutIdealEdgeLength]);

  /** IDs of nodes that act as parents. */
  const hostNodeIdSet = useMemo(() => new Set(regionCircles.map(rc => rc.node.id)), [regionCircles]);

  /** Shows node details in a tooltip. */
  const handleNodeMouseEnter = (node: MapNode, event: React.MouseEvent) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    let content = `${node.placeName}`;
    if (node.data.nodeType) content += `\nType: ${node.data.nodeType}`;
    if (node.data.description) content += `\nDescription: ${node.data.description}`;
    if (node.data.aliases && node.data.aliases.length > 0) content += `\nAliases: ${node.data.aliases.join(', ')}`;
    if (node.data.status) content += `\nStatus: ${node.data.status}`;
    if (node.data.parentNodeId && node.data.parentNodeId !== 'Universe') {
      const parentNode = nodes.find(n => n.id === node.data.parentNodeId);
      content += `\n(Parent: ${parentNode?.placeName || 'Unknown Location'})`;
    }
    setTooltip({ content, x: event.clientX - svgRect.left + 15, y: event.clientY - svgRect.top + 15 });
  };

  /** Shows edge details in a tooltip. */
  const handleEdgeMouseEnter = (edge: MapEdge, event: React.MouseEvent) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
    const targetNode = nodes.find(n => n.id === edge.targetNodeId);
    let content = `Path between ${sourceNode?.placeName || 'Unknown'} and ${targetNode?.placeName || 'Unknown'}`;
    if (edge.data.description) content += `\nDescription: ${edge.data.description}`;
    if (edge.data.type) content += `\nType: ${edge.data.type}`;
    if (edge.data.status) content += `\nStatus: ${edge.data.status}`;
    if (edge.data.travelTime) content += `\nTravel: ${edge.data.travelTime}`;
    setTooltip({ content, x: event.clientX - svgRect.left + 15, y: event.clientY - svgRect.top + 15 });
  };

  /** Hides the tooltip. */
  const handleMouseLeaveGeneral = () => { setTooltip(null); };

  if (nodes.length === 0) {
    return (
      <div className="map-content-area">
        <p className="text-slate-500 italic">No map data available for this theme yet.</p>
      </div>
    );
  }

  return (
    <div className="map-content-area">
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="map-svg-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        preserveAspectRatio="xMidYMid meet"
      >
        <g>
          {regionCircles.map(rc => (
            <circle
              key={`region-circle-${rc.node.id}`}
              cx={rc.node.position.x}
              cy={rc.node.position.y}
              r={rc.radius}
              fill="none"
              stroke="#888888"
              strokeWidth="1px"
              opacity="0.3"
            />
          ))}

          {edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
            const targetNode = nodes.find(n => n.id === edge.targetNodeId);
            if (!sourceNode || !targetNode) return null;
            let edgeClass = 'map-edge';
            if (edge.data.type) edgeClass += ` ${edge.data.type.replace(/\s+/g, '_').toLowerCase()}`;
            if (edge.data.status) edgeClass += ` ${edge.data.status.replace(/\s+/g, '_').toLowerCase()}`;
            return (
              <g key={edge.id} className="map-edge-group" onMouseEnter={e => handleEdgeMouseEnter(edge, e)} onMouseLeave={handleMouseLeaveGeneral}>
                <line x1={sourceNode.position.x} y1={sourceNode.position.y} x2={targetNode.position.x} y2={targetNode.position.y} stroke="transparent" strokeWidth={EDGE_HOVER_WIDTH} />
                <line x1={sourceNode.position.x} y1={sourceNode.position.y} x2={targetNode.position.x} y2={targetNode.position.y} className={edgeClass} />
              </g>
            );
          })}

          {nodes.map(node => {
            let nodeClass = 'map-node-circle';
            if (node.data.nodeType) nodeClass += ` ${node.data.nodeType}`;
            if (node.id === currentMapNodeId) nodeClass += ' current';
            if (node.data.status === 'quest_target') nodeClass += ' quest_target';
            const maxCharsPerLine = node.data.nodeType === 'feature' ? 20 : 25;
            const labelLines = splitTextIntoLines(node.placeName, maxCharsPerLine, MAX_LABEL_LINES);
            const isHost = hostNodeIdSet.has(node.id);
            const initialDyOffset = isHost
              ? getRadiusForNode(node) / 10 + 2
              : -(labelLines.length - 1) * 0.5 * LABEL_LINE_HEIGHT_EM + 0.3;
            const radius = getRadiusForNode(node);
            const handleEnter = (e: React.MouseEvent) => handleNodeMouseEnter(node, e);
            if (node.data.nodeType === 'feature') {
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.position.x}, ${node.position.y})`}
                  className="map-node"
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleMouseLeaveGeneral}
                >
                  <circle className={nodeClass} r={radius} />
                  <text className="map-node-label leaf-label" pointerEvents="none">
                    {labelLines.map((line, index) => (
                      <tspan
                        key={`${node.id}-line-${index}`}
                        x="0"
                        dy={index === 0 ? `${initialDyOffset}em` : `${LABEL_LINE_HEIGHT_EM}em`}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            }

            return (
              <g
                key={node.id}
                transform={`translate(${node.position.x}, ${node.position.y})`}
                className="map-node"
              >
                <circle className={nodeClass} r={radius} pointerEvents="none" />
                <circle
                  className="map-node-hover-ring"
                  r={radius}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={8}
                  pointerEvents="stroke"
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleMouseLeaveGeneral}
                />
                <text
                  className="map-node-label"
                  pointerEvents="all"
                  onMouseEnter={handleEnter}
                  onMouseLeave={handleMouseLeaveGeneral}
                >
                  {labelLines.map((line, index) => (
                    <tspan
                      key={`${node.id}-line-${index}`}
                      x="0"
                      dy={index === 0 ? `${initialDyOffset}em` : `${LABEL_LINE_HEIGHT_EM}em`}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {tooltip && (
        <div className="map-tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
          {tooltip.content.split('\n').map((line, index) => (
            <React.Fragment key={index}>
              {line}
              {index < tooltip.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapNodeView;
