/**
 * @file MapDisplay.tsx
 * @description Layout component composing the map view and controls.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapData, MapNode, MapEdge, MapLayoutConfig } from '../types';
import {
  DEFAULT_K_REPULSION,
  DEFAULT_K_SPRING,
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_K_UNTANGLE,
  DEFAULT_K_EDGE_NODE_REPULSION,
  DEFAULT_DAMPING_FACTOR,
  DEFAULT_MAX_DISPLACEMENT,
  DEFAULT_LAYOUT_ITERATIONS,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
  applyNestedCircleLayout,
} from '../utils/mapLayoutUtils';
import MapNodeView from './map/MapNodeView';
import MapControls from './map/MapControls';


interface MapDisplayProps {
  mapData: MapData;
  currentThemeName: string | null;
  currentMapNodeId: string | null;
  initialLayoutConfig: MapLayoutConfig;
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
  onLayoutConfigChange,
  isVisible,
  onClose,
}) => {
  const [displayedNodes, setDisplayedNodes] = useState<MapNode[]>([]);

  const [layoutKRepulsion, setLayoutKRepulsion] = useState(initialLayoutConfig?.K_REPULSION ?? DEFAULT_K_REPULSION);
  const [layoutKSpring, setLayoutKSpring] = useState(initialLayoutConfig?.K_SPRING ?? DEFAULT_K_SPRING);
  const [layoutIdealEdgeLength, setLayoutIdealEdgeLength] = useState(initialLayoutConfig?.IDEAL_EDGE_LENGTH ?? DEFAULT_IDEAL_EDGE_LENGTH);
  const [layoutKUntangle, setLayoutKUntangle] = useState(initialLayoutConfig?.K_UNTANGLE ?? DEFAULT_K_UNTANGLE);
  const [layoutKEdgeNodeRepulsion, setLayoutKEdgeNodeRepulsion] = useState(initialLayoutConfig?.K_EDGE_NODE_REPULSION ?? DEFAULT_K_EDGE_NODE_REPULSION);
  const [layoutDampingFactor, setLayoutDampingFactor] = useState(initialLayoutConfig?.DAMPING_FACTOR ?? DEFAULT_DAMPING_FACTOR);
  const [layoutMaxDisplacement, setLayoutMaxDisplacement] = useState(initialLayoutConfig?.MAX_DISPLACEMENT ?? DEFAULT_MAX_DISPLACEMENT);
  const [layoutIterations, setLayoutIterations] = useState(initialLayoutConfig?.iterations ?? DEFAULT_LAYOUT_ITERATIONS);
  const [layoutNestedPadding, setLayoutNestedPadding] = useState(
    initialLayoutConfig?.NESTED_PADDING ?? DEFAULT_NESTED_PADDING
  );
  const [layoutNestedAnglePadding, setLayoutNestedAnglePadding] = useState(
    initialLayoutConfig?.NESTED_ANGLE_PADDING ?? DEFAULT_NESTED_ANGLE_PADDING
  );

  useEffect(() => {
    if (initialLayoutConfig) {
      setLayoutKRepulsion(initialLayoutConfig.K_REPULSION);
      setLayoutKSpring(initialLayoutConfig.K_SPRING);
      setLayoutIdealEdgeLength(initialLayoutConfig.IDEAL_EDGE_LENGTH);
      setLayoutKUntangle(initialLayoutConfig.K_UNTANGLE);
      setLayoutKEdgeNodeRepulsion(initialLayoutConfig.K_EDGE_NODE_REPULSION);
      setLayoutDampingFactor(initialLayoutConfig.DAMPING_FACTOR);
      setLayoutMaxDisplacement(initialLayoutConfig.MAX_DISPLACEMENT);
      setLayoutIterations(initialLayoutConfig.iterations);
      setLayoutNestedPadding(initialLayoutConfig.NESTED_PADDING ?? DEFAULT_NESTED_PADDING);
      setLayoutNestedAnglePadding(
        initialLayoutConfig.NESTED_ANGLE_PADDING ?? DEFAULT_NESTED_ANGLE_PADDING
      );
    }
  }, [initialLayoutConfig]);

  /** Current layout configuration derived from state sliders. */
  const currentConfigToPropagate = useMemo(
    (): MapLayoutConfig => ({
      K_REPULSION: layoutKRepulsion,
      K_SPRING: layoutKSpring,
      IDEAL_EDGE_LENGTH: layoutIdealEdgeLength,
      K_CENTERING: 0,
      K_UNTANGLE: layoutKUntangle,
      K_EDGE_NODE_REPULSION: layoutKEdgeNodeRepulsion,
      DAMPING_FACTOR: layoutDampingFactor,
      MAX_DISPLACEMENT: layoutMaxDisplacement,
      iterations: layoutIterations,
      NESTED_PADDING: layoutNestedPadding,
      NESTED_ANGLE_PADDING: layoutNestedAnglePadding,
    }),
    [
      layoutKRepulsion,
      layoutKSpring,
      layoutIdealEdgeLength,
      layoutKUntangle,
      layoutKEdgeNodeRepulsion,
      layoutDampingFactor,
      layoutMaxDisplacement,
      layoutIterations,
      layoutNestedPadding,
      layoutNestedAnglePadding,
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
  }, [currentThemeNodes, layoutNestedPadding, layoutNestedAnglePadding]);

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
    setLayoutKRepulsion(DEFAULT_K_REPULSION);
    setLayoutKSpring(DEFAULT_K_SPRING);
    setLayoutIdealEdgeLength(DEFAULT_IDEAL_EDGE_LENGTH);
    setLayoutKUntangle(DEFAULT_K_UNTANGLE);
    setLayoutKEdgeNodeRepulsion(DEFAULT_K_EDGE_NODE_REPULSION);
    setLayoutDampingFactor(DEFAULT_DAMPING_FACTOR);
    setLayoutMaxDisplacement(DEFAULT_MAX_DISPLACEMENT);
    setLayoutIterations(DEFAULT_LAYOUT_ITERATIONS);
    setLayoutNestedPadding(DEFAULT_NESTED_PADDING);
    setLayoutNestedAnglePadding(DEFAULT_NESTED_ANGLE_PADDING);
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
        <MapNodeView nodes={displayedNodes} edges={currentThemeEdges} currentMapNodeId={currentMapNodeId} layoutIdealEdgeLength={layoutIdealEdgeLength} />
        <MapControls
          padding={layoutNestedPadding}
          setPadding={setLayoutNestedPadding}
          anglePadding={layoutNestedAnglePadding}
          setAnglePadding={setLayoutNestedAnglePadding}
          onReset={handleResetLayoutToDefaults}
          onRefreshLayout={handleRefreshLayout}
        />
      </div>
    </div>
  );
};

export default MapDisplay;
