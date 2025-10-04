/**
 * @file useMapTooltip.ts
 * @description Hook providing tooltip logic for the map view.
 */

import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { MapEdge, MapNode } from '../types';
import { getSVGCoordinates, getScreenCoordinates } from '../utils/svgUtils';

export interface TooltipState {
  content: string;
  svgX: number;
  svgY: number;
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  nodeId?: string;
}

export interface UseMapTooltipProps {
  nodes: Array<MapNode>;
  edges: Array<MapEdge>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  viewBox: string;
  destinationNodeId: string | null;
  onSelectDestination: (nodeId: string | null) => void;
}

/**
 * Manages tooltip state and event handlers for the map view.
 */
export const useMapTooltip = ({
  nodes,
  edges,
  svgRef,
  viewBox,
  destinationNodeId,
  onSelectDestination,
}: UseMapTooltipProps) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isTooltipLocked, setIsTooltipLocked] = useState(false);
  const tooltipTimeout = useRef<number | null>(null);
  const TOOLTIP_DELAY_MS = 250;
  const [tooltipScreenPosition, setTooltipScreenPosition] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (!tooltip || !svgRef.current) {
      setTooltipScreenPosition(null);
      return;
    }
    const { x, y } = getScreenCoordinates(svgRef.current, tooltip.svgX, tooltip.svgY);
    const rect = svgRef.current.getBoundingClientRect();
    setTooltipScreenPosition({ x: x - rect.left, y: y - rect.top });
  }, [tooltip, viewBox, svgRef]);

  const computeAnchor = useCallback(
    (x: number, y: number, rect: DOMRect): TooltipState['anchor'] => {
      const horizontal = x > rect.width / 2 ? 'right' : 'left';
      const vertical = y > rect.height * 0.75 ? 'bottom' : 'top';
      return `${vertical}-${horizontal}` as const;
    },
    [],
  );

  const handleMouseLeaveGeneral = useCallback(() => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = null;
    }
    if (!isTooltipLocked) setTooltip(null);
  }, [isTooltipLocked]);

  const handleSvgClick = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const target = event.target as Element;
    if (!target.closest('.map-node') && !target.closest('.map-edge-group')) {
      setIsTooltipLocked(false);
      setTooltip(null);
    }
  }, []);

  const handleEdgeMouseEnterById = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      if (isTooltipLocked) return;
      const edgeId = event.currentTarget.dataset.edgeId;
      if (!edgeId) return;
      const edge = edges.find(e => e.id === edgeId);
      if (!edge) return;
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const x = event.clientX - svgRect.left;
      const y = event.clientY - svgRect.top;
      const svgCoords = svgRef.current ? getSVGCoordinates(svgRef.current, event.clientX, event.clientY) : { x: 0, y: 0 };
      const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
      const targetNode = nodes.find(n => n.id === edge.targetNodeId);
      let content =
        edge.data.description ??
        `Path between ${sourceNode?.placeName ?? 'Unknown'} and ${targetNode?.placeName ?? 'Unknown'}`;
      if (edge.data.travelTime) content += `\n${edge.data.travelTime}`;
      content += `\nStatus: ${edge.data.status}`;
      const anchor = computeAnchor(x, y, svgRect);
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = window.setTimeout(() => {
        setTooltip({ content, svgX: svgCoords.x, svgY: svgCoords.y, anchor });
      }, TOOLTIP_DELAY_MS);
    },
    [computeAnchor, edges, isTooltipLocked, nodes, svgRef],
  );

  const handleNodeMouseEnterById = useCallback(
    (event: React.MouseEvent) => {
      if (isTooltipLocked) return;
      const nodeId = event.currentTarget.getAttribute('data-node-id');
      if (!nodeId) return;
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const x = event.clientX - svgRect.left;
      const y = event.clientY - svgRect.top;
      const svgCoords = svgRef.current ? getSVGCoordinates(svgRef.current, event.clientX, event.clientY) : { x: 0, y: 0 };
      let content = node.placeName;
      if (node.data.aliases && node.data.aliases.length > 0) content += ` (aka ${node.data.aliases.join(', ')})`;
      if (node.data.description) content += `\n${node.data.description}`;
      content += `\nStatus: ${node.data.status}`;
      const anchor = computeAnchor(x, y, svgRect);
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
      tooltipTimeout.current = window.setTimeout(() => {
        setTooltip({ content, svgX: svgCoords.x, svgY: svgCoords.y, anchor, nodeId });
      }, TOOLTIP_DELAY_MS);
    },
    [computeAnchor, isTooltipLocked, nodes, svgRef],
  );

  const handleNodeClickById = useCallback(
    (event: React.MouseEvent) => {
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
      const svgCoords = svgRef.current ? getSVGCoordinates(svgRef.current, event.clientX, event.clientY) : { x: 0, y: 0 };
      let content = node.placeName;
      if (node.data.aliases && node.data.aliases.length > 0) content += ` (aka ${node.data.aliases.join(', ')})`;
      if (node.data.description) content += `\n${node.data.description}`;
      content += `\nStatus: ${node.data.status}`;
      setIsTooltipLocked(true);
      const anchor = computeAnchor(x, y, svgRect);
      setTooltip({ content, svgX: svgCoords.x, svgY: svgCoords.y, anchor, nodeId });
    },
    [computeAnchor, nodes, svgRef],
  );

  const handleDestinationClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
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
    [destinationNodeId, onSelectDestination],
  );

  return {
    tooltip,
    tooltipScreenPosition,
    isTooltipLocked,
    handleMouseLeaveGeneral,
    handleSvgClick,
    handleEdgeMouseEnterById,
    handleNodeMouseEnterById,
    handleNodeClickById,
    handleDestinationClick,
    setIsTooltipLocked,
  };
};
