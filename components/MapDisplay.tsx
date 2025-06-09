/**
 * @file MapDisplay.tsx
 * @description Layout component composing the map view and controls.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapData, MapNode, MapEdge, MapLayoutConfig } from '../types';
import {
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
  applyNestedCircleLayout,
} from '../utils/mapLayoutUtils';
import {
  DEFAULT_LABEL_MARGIN_PX,
  DEFAULT_LABEL_LINE_HEIGHT_EM,
  DEFAULT_LABEL_OVERLAP_MARGIN_PX,
} from '../utils/mapConstants';
import MapNodeView from './map/MapNodeView';
import MapControls from './map/MapControls';


interface MapDisplayProps {
  mapData: MapData;
  currentThemeName: string | null;
  currentMapNodeId: string | null;
  initialLayoutConfig: MapLayoutConfig;
  initialViewBox: string;
  onViewBoxChange: (newViewBox: string) => void;
  onNodesPositioned: (nodes: MapNode[]) => void;
  onLayoutConfigChange: (newConfig: MapLayoutConfig) => void;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Renders the interactive map with controls for layout tweaking.
 */
const MapDisplay: React.FC<MapDisplayProps> = ({
  mapData,
  currentThemeName,
  currentMapNodeId,
  initialLayoutConfig,
  initialViewBox,
  onViewBoxChange,
  onNodesPositioned,
  onLayoutConfigChange,
  isVisible,
  onClose,
}) => {
  const [displayedNodes, setDisplayedNodes] = useState<MapNode[]>([]);

  const [layoutIdealEdgeLength, setLayoutIdealEdgeLength] = useState(initialLayoutConfig?.IDEAL_EDGE_LENGTH ?? DEFAULT_IDEAL_EDGE_LENGTH);
  const [layoutNestedPadding, setLayoutNestedPadding] = useState(
    initialLayoutConfig?.NESTED_PADDING ?? DEFAULT_NESTED_PADDING
  );
  const [layoutNestedAnglePadding, setLayoutNestedAnglePadding] = useState(
    initialLayoutConfig?.NESTED_ANGLE_PADDING ?? DEFAULT_NESTED_ANGLE_PADDING
  );
  const labelMarginPx = DEFAULT_LABEL_MARGIN_PX;
  const labelLineHeightEm = DEFAULT_LABEL_LINE_HEIGHT_EM;
  const [labelOverlapMarginPx, setLabelOverlapMarginPx] = useState(
    initialLayoutConfig?.LABEL_OVERLAP_MARGIN_PX ?? DEFAULT_LABEL_OVERLAP_MARGIN_PX
  );

  useEffect(() => {
    if (!initialLayoutConfig) return;
    setLayoutIdealEdgeLength(initialLayoutConfig.IDEAL_EDGE_LENGTH);
    setLayoutNestedPadding(
      initialLayoutConfig.NESTED_PADDING ?? DEFAULT_NESTED_PADDING
    );
    setLayoutNestedAnglePadding(
      initialLayoutConfig.NESTED_ANGLE_PADDING ?? DEFAULT_NESTED_ANGLE_PADDING
    );
    setLabelOverlapMarginPx(
      initialLayoutConfig.LABEL_OVERLAP_MARGIN_PX ?? DEFAULT_LABEL_OVERLAP_MARGIN_PX
    );
  }, [initialLayoutConfig]);

  /** Current layout configuration derived from state sliders. */
  const currentConfigToPropagate = useMemo(
    (): MapLayoutConfig => ({
      IDEAL_EDGE_LENGTH: layoutIdealEdgeLength,
      NESTED_PADDING: layoutNestedPadding,
      NESTED_ANGLE_PADDING: layoutNestedAnglePadding,
      LABEL_MARGIN_PX: labelMarginPx,
      LABEL_LINE_HEIGHT_EM: labelLineHeightEm,
      LABEL_OVERLAP_MARGIN_PX: labelOverlapMarginPx,
    }),
    [
      layoutIdealEdgeLength,
      layoutNestedPadding,
      layoutNestedAnglePadding,
      labelMarginPx,
      labelLineHeightEm,
      labelOverlapMarginPx,
    ]
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      onLayoutConfigChange(currentConfigToPropagate);
    }, 500);
    return () => clearTimeout(handler);
  }, [currentConfigToPropagate, onLayoutConfigChange]);

  /** Nodes belonging to the current theme. */
  const currentThemeNodes = useMemo(() => {
    if (!currentThemeName) return [] as MapNode[];
    return mapData.nodes.filter(node => node.themeName === currentThemeName);
  }, [mapData.nodes, currentThemeName]);

  /** Edges belonging to the current theme. */
  const currentThemeEdges = useMemo(() => {
    if (!currentThemeName) return [] as MapEdge[];
    const themeNodeIds = new Set(currentThemeNodes.map(node => node.id));
    return mapData.edges.filter(
      edge =>
        themeNodeIds.has(edge.sourceNodeId) &&
        themeNodeIds.has(edge.targetNodeId)
    );
  }, [mapData.edges, currentThemeNodes, currentThemeName]);

  /**
   * Prepares nodes for display. The force-directed layout algorithm is
   * intentionally disabled, so nodes are shown using their stored positions.
   */
  const runLayout = useCallback(() => {
    const nodesToProcess = [...currentThemeNodes];
    const laidOut = applyNestedCircleLayout(nodesToProcess, {
      padding: layoutNestedPadding,
      anglePadding: layoutNestedAnglePadding,
    });
    setDisplayedNodes(laidOut);
    onNodesPositioned(laidOut);
  }, [currentThemeNodes, layoutNestedPadding, layoutNestedAnglePadding, onNodesPositioned]);

  useEffect(() => {
    if (isVisible) {
      runLayout();
    } else {
      setDisplayedNodes([]);
    }
  }, [isVisible, runLayout]);

  /** Triggers a recalculation of node positions using the current settings. */
  const handleRefreshLayout = () => {
    runLayout();
  };

  /** Resets all layout parameters to default values. */
  const handleResetLayoutToDefaults = () => {
    setLayoutIdealEdgeLength(DEFAULT_IDEAL_EDGE_LENGTH);
    setLayoutNestedPadding(DEFAULT_NESTED_PADDING);
    setLayoutNestedAnglePadding(DEFAULT_NESTED_ANGLE_PADDING);
    setLabelOverlapMarginPx(DEFAULT_LABEL_OVERLAP_MARGIN_PX);
  };

  if (!isVisible) return null;

  return (
    <div className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="map-display-title">
      <div className="animated-frame-content">
        <button onClick={onClose} className="animated-frame-close-button" aria-label="Close map view">
          &times;
        </button>
        <h1 id="map-display-title" className="text-xl font-bold text-teal-400 mb-2 text-center">
          {currentThemeName ? `Map: ${currentThemeName}` : 'Map'}
        </h1>
        <p className="text-center text-xs text-slate-400 mb-1">Pan by dragging, zoom with the mouse wheel or pinch. Hover for details.</p>
        <MapNodeView
          nodes={displayedNodes}
          edges={currentThemeEdges}
          currentMapNodeId={currentMapNodeId}
          labelOverlapMarginPx={labelOverlapMarginPx}
          initialViewBox={initialViewBox}
          onViewBoxChange={onViewBoxChange}
        />
        <MapControls
          padding={layoutNestedPadding}
          setPadding={setLayoutNestedPadding}
          anglePadding={layoutNestedAnglePadding}
          setAnglePadding={setLayoutNestedAnglePadding}
          overlapMargin={labelOverlapMarginPx}
          setOverlapMargin={setLabelOverlapMarginPx}
          onReset={handleResetLayoutToDefaults}
          onRefreshLayout={handleRefreshLayout}
        />
      </div>
    </div>
  );
};

export default MapDisplay;
