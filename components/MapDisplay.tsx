/**
 * @file MapDisplay.tsx
 * @description Layout component composing the map view and controls.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import * as React from 'react';
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
  DEFAULT_ITEM_ICON_SCALE,
} from '../constants';
import MapNodeView from './map/MapNodeView';
import MapControls from './map/MapControls';


interface MapDisplayProps {
  readonly mapData: MapData;
  readonly currentThemeName: string | null;
  readonly currentMapNodeId: string | null;
  readonly destinationNodeId: string | null;
  readonly itemPresenceByNode: Record<string, { hasUseful: boolean; hasVehicle: boolean }>;
  readonly onSelectDestination: (nodeId: string | null) => void;
  readonly initialLayoutConfig: MapLayoutConfig;
  readonly initialViewBox: string;
  readonly onViewBoxChange: (newViewBox: string) => void;
  readonly onNodesPositioned: (nodes: MapNode[]) => void;
  readonly onLayoutConfigChange: (newConfig: MapLayoutConfig) => void;
  readonly isVisible: boolean;
  readonly onClose: () => void;
}

/**
 * Renders the interactive map with controls for layout tweaking.
 */
const MapDisplay: React.FC<MapDisplayProps> = ({
  mapData,
  currentThemeName,
  currentMapNodeId,
  destinationNodeId,
  itemPresenceByNode,
  onSelectDestination,
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
  const [itemIconScale, setItemIconScale] = useState(
    initialLayoutConfig?.ITEM_ICON_SCALE ?? DEFAULT_ITEM_ICON_SCALE
  );

  useEffect(() => {
    if (!initialLayoutConfig) return;
    const edge = initialLayoutConfig.IDEAL_EDGE_LENGTH;
    const pad = initialLayoutConfig.NESTED_PADDING ?? DEFAULT_NESTED_PADDING;
    const angle =
      initialLayoutConfig.NESTED_ANGLE_PADDING ?? DEFAULT_NESTED_ANGLE_PADDING;
    const overlap =
      initialLayoutConfig.LABEL_OVERLAP_MARGIN_PX ?? DEFAULT_LABEL_OVERLAP_MARGIN_PX;
    const iconScale =
      initialLayoutConfig.ITEM_ICON_SCALE ?? DEFAULT_ITEM_ICON_SCALE;
    setLayoutIdealEdgeLength(prev => (prev === edge ? prev : edge));
    setLayoutNestedPadding(prev => (prev === pad ? prev : pad));
    setLayoutNestedAnglePadding(prev => (prev === angle ? prev : angle));
    setLabelOverlapMarginPx(prev => (prev === overlap ? prev : overlap));
    setItemIconScale(prev => (prev === iconScale ? prev : iconScale));
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
      ITEM_ICON_SCALE: itemIconScale,
    }),
    [
      layoutIdealEdgeLength,
      layoutNestedPadding,
      layoutNestedAnglePadding,
      labelMarginPx,
      labelLineHeightEm,
      labelOverlapMarginPx,
      itemIconScale,
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
  const handleRefreshLayout = useCallback(() => {
    runLayout();
  }, [runLayout]);

  /** Resets all layout parameters to default values. */
  const handleResetLayoutToDefaults = useCallback(() => {
    setLayoutIdealEdgeLength(DEFAULT_IDEAL_EDGE_LENGTH);
    setLayoutNestedPadding(DEFAULT_NESTED_PADDING);
    setLayoutNestedAnglePadding(DEFAULT_NESTED_ANGLE_PADDING);
    setLabelOverlapMarginPx(DEFAULT_LABEL_OVERLAP_MARGIN_PX);
    setItemIconScale(DEFAULT_ITEM_ICON_SCALE);
  }, []);

  if (!isVisible) return null;

  return (
    <div aria-labelledby="map-display-title" aria-modal="true" className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog">
      <div className="animated-frame-content">
        <button aria-label="Close map view" className="animated-frame-close-button" onClick={onClose}>
          &times;
        </button>

        <h1 className="text-xl font-bold text-teal-400 mb-2 text-center" id="map-display-title">
          {currentThemeName ? `Map: ${currentThemeName}` : 'Map'}
        </h1>

        <p className="text-center text-xs text-slate-400 mb-1">Pan by dragging, zoom with the mouse wheel or pinch. Hover for details.</p>

        <MapNodeView
          currentMapNodeId={currentMapNodeId}
          destinationNodeId={destinationNodeId}
          edges={currentThemeEdges}
          initialViewBox={initialViewBox}
          itemIconScale={itemIconScale}
          itemPresenceByNode={itemPresenceByNode}
          labelOverlapMarginPx={labelOverlapMarginPx}
          nodes={displayedNodes}
          onSelectDestination={onSelectDestination}
          onViewBoxChange={onViewBoxChange}
        />

        <MapControls
          anglePadding={layoutNestedAnglePadding}
          itemIconScale={itemIconScale}
          onRefreshLayout={handleRefreshLayout}
          onReset={handleResetLayoutToDefaults}
          overlapMargin={labelOverlapMarginPx}
          padding={layoutNestedPadding}
          setAnglePadding={setLayoutNestedAnglePadding}
          setItemIconScale={setItemIconScale}
          setOverlapMargin={setLabelOverlapMarginPx}
          setPadding={setLayoutNestedPadding}
        />
      </div>
    </div>
  );
};

export default MapDisplay;
