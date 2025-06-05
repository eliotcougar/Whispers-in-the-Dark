/**
 * @file MapDisplay.tsx
 * @description Layout component composing the map view and controls.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapData, MapNode, MapEdge, MapLayoutConfig } from '../types';
import {
  applyBasicLayoutAlgorithm,
  applyNestedCircleLayout,
  applyNestedForceLayout,
  LayoutForceConstants,
  DEFAULT_K_REPULSION,
  DEFAULT_K_SPRING,
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_K_CENTERING,
  DEFAULT_K_UNTANGLE,
  DEFAULT_K_EDGE_NODE_REPULSION,
  DEFAULT_DAMPING_FACTOR,
  DEFAULT_MAX_DISPLACEMENT,
  DEFAULT_LAYOUT_ITERATIONS,
} from '../utils/mapLayoutUtils';
import MapNodeView from './map/MapNodeView';
import MapControls from './map/MapControls';
import { NODE_RADIUS, VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL } from '../utils/mapConstants';

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
  const [isNestedView, setIsNestedView] = useState(false);

  const [layoutKRepulsion, setLayoutKRepulsion] = useState(initialLayoutConfig?.K_REPULSION ?? DEFAULT_K_REPULSION);
  const [layoutKSpring, setLayoutKSpring] = useState(initialLayoutConfig?.K_SPRING ?? DEFAULT_K_SPRING);
  const [layoutIdealEdgeLength, setLayoutIdealEdgeLength] = useState(initialLayoutConfig?.IDEAL_EDGE_LENGTH ?? DEFAULT_IDEAL_EDGE_LENGTH);
  const [layoutKCentering, setLayoutKCentering] = useState(initialLayoutConfig?.K_CENTERING ?? DEFAULT_K_CENTERING);
  const [layoutKUntangle, setLayoutKUntangle] = useState(initialLayoutConfig?.K_UNTANGLE ?? DEFAULT_K_UNTANGLE);
  const [layoutKEdgeNodeRepulsion, setLayoutKEdgeNodeRepulsion] = useState(initialLayoutConfig?.K_EDGE_NODE_REPULSION ?? DEFAULT_K_EDGE_NODE_REPULSION);
  const [layoutDampingFactor, setLayoutDampingFactor] = useState(initialLayoutConfig?.DAMPING_FACTOR ?? DEFAULT_DAMPING_FACTOR);
  const [layoutMaxDisplacement, setLayoutMaxDisplacement] = useState(initialLayoutConfig?.MAX_DISPLACEMENT ?? DEFAULT_MAX_DISPLACEMENT);
  const [layoutIterations, setLayoutIterations] = useState(initialLayoutConfig?.iterations ?? DEFAULT_LAYOUT_ITERATIONS);

  useEffect(() => {
    if (initialLayoutConfig) {
      setLayoutKRepulsion(initialLayoutConfig.K_REPULSION);
      setLayoutKSpring(initialLayoutConfig.K_SPRING);
      setLayoutIdealEdgeLength(initialLayoutConfig.IDEAL_EDGE_LENGTH);
      setLayoutKCentering(initialLayoutConfig.K_CENTERING);
      setLayoutKUntangle(initialLayoutConfig.K_UNTANGLE);
      setLayoutKEdgeNodeRepulsion(initialLayoutConfig.K_EDGE_NODE_REPULSION);
      setLayoutDampingFactor(initialLayoutConfig.DAMPING_FACTOR);
      setLayoutMaxDisplacement(initialLayoutConfig.MAX_DISPLACEMENT);
      setLayoutIterations(initialLayoutConfig.iterations);
    }
  }, [initialLayoutConfig]);

  /** Current layout configuration derived from state sliders. */
  const currentConfigToPropagate = useMemo(
    (): MapLayoutConfig => ({
      K_REPULSION: layoutKRepulsion,
      K_SPRING: layoutKSpring,
      IDEAL_EDGE_LENGTH: layoutIdealEdgeLength,
      K_CENTERING: layoutKCentering,
      K_UNTANGLE: layoutKUntangle,
      K_EDGE_NODE_REPULSION: layoutKEdgeNodeRepulsion,
      DAMPING_FACTOR: layoutDampingFactor,
      MAX_DISPLACEMENT: layoutMaxDisplacement,
      iterations: layoutIterations,
    }),
    [layoutKRepulsion, layoutKSpring, layoutIdealEdgeLength, layoutKCentering, layoutKUntangle, layoutKEdgeNodeRepulsion, layoutDampingFactor, layoutMaxDisplacement, layoutIterations]
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

  /** Edges belonging to the current theme (excluding old containment edges). */
  const currentThemeEdges = useMemo(() => {
    if (!currentThemeName) return [] as MapEdge[];
    const themeNodeIds = new Set(currentThemeNodes.map(node => node.id));
    return mapData.edges.filter(
      edge =>
        themeNodeIds.has(edge.sourceNodeId) &&
        themeNodeIds.has(edge.targetNodeId) &&
        edge.data.type !== 'containment'
    );
  }, [mapData.edges, currentThemeNodes, currentThemeName]);

  /** Prepares nodes for layout and runs the force algorithm. */
  const runLayout = useCallback(() => {
    const nodesToProcess = [...currentThemeNodes];

    if (isNestedView) {
      const forceConstants: LayoutForceConstants = {
        K_REPULSION: layoutKRepulsion,
        K_SPRING: layoutKSpring,
        IDEAL_EDGE_LENGTH: layoutIdealEdgeLength,
        K_CENTERING: layoutKCentering,
        K_UNTANGLE: layoutKUntangle,
        K_EDGE_NODE_REPULSION: layoutKEdgeNodeRepulsion,
        DAMPING_FACTOR: layoutDampingFactor,
        MAX_DISPLACEMENT: layoutMaxDisplacement,
      };
      const nestedNodes = applyNestedForceLayout(
        nodesToProcess,
        currentThemeEdges,
        layoutIterations,
        forceConstants
      );
      setDisplayedNodes(nestedNodes);
      return;
    }
    const newPositions: { [id: string]: { x: number; y: number } } = {};

    nodesToProcess.forEach(node => {
      if (node.position.x !== 0 || node.position.y !== 0) {
        newPositions[node.id] = node.position;
      }
    });

    const nodesNeedingInitialLayout = nodesToProcess.filter(node => !node.data.parentNodeId && node.position.x === 0 && node.position.y === 0);
    const childNodesNeedingInitialLayout = nodesToProcess.filter(node => node.data.parentNodeId && node.position.x === 0 && node.position.y === 0);

    if (nodesNeedingInitialLayout.length > 0) {
      const radius = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) / 3;
      const angleStep = (2 * Math.PI) / Math.max(1, nodesNeedingInitialLayout.length);
      nodesNeedingInitialLayout.forEach((node, index) => {
        newPositions[node.id] = {
          x: radius * Math.cos(index * angleStep),
          y: radius * Math.sin(index * angleStep),
        };
      });
    }

    childNodesNeedingInitialLayout.forEach(childNode => {
      if (childNode.data.parentNodeId) {
        const parentNodePos = newPositions[childNode.data.parentNodeId] || nodesToProcess.find(n => n.id === childNode.data.parentNodeId)?.position;
        if (parentNodePos) {
          // Spread children a bit farther from the parent so that labels have room
          newPositions[childNode.id] = {
            x: parentNodePos.x + NODE_RADIUS * 2.5 * (Math.random() > 0.5 ? 1 : -1),
            y: parentNodePos.y + NODE_RADIUS * 2.5 * (Math.random() > 0.5 ? 1 : -1),
          };
        } else {
          newPositions[childNode.id] = { x: Math.random() * 100 - 50, y: Math.random() * 100 - 50 };
        }
      } else {
        newPositions[childNode.id] = { x: Math.random() * 100 - 50, y: Math.random() * 100 - 50 };
      }
    });

    const preparedNodes = nodesToProcess.map(node => ({
      ...node,
      position: newPositions[node.id] || node.position,
    }));

    if (preparedNodes.length > 0) {
      const forceConstantsFromState: LayoutForceConstants = {
        K_REPULSION: layoutKRepulsion,
        K_SPRING: layoutKSpring,
        IDEAL_EDGE_LENGTH: layoutIdealEdgeLength,
        K_CENTERING: layoutKCentering,
        K_UNTANGLE: layoutKUntangle,
        K_EDGE_NODE_REPULSION: layoutKEdgeNodeRepulsion,
        DAMPING_FACTOR: layoutDampingFactor,
        MAX_DISPLACEMENT: layoutMaxDisplacement,
      };
      const parentChildEdges: MapEdge[] = [];
      preparedNodes.forEach(node => {
        if (node.data.parentNodeId) {
          parentChildEdges.push({
            id: `pc_${node.data.parentNodeId}_${node.id}`,
            sourceNodeId: node.data.parentNodeId,
            targetNodeId: node.id,
            data: { type: 'parent-child' },
          });
        }
      });
      const layoutEdges = [...currentThemeEdges, ...parentChildEdges];

      const nodesAfterLayout = applyBasicLayoutAlgorithm(
        preparedNodes,
        layoutEdges,
        VIEWBOX_WIDTH_INITIAL,
        VIEWBOX_HEIGHT_INITIAL,
        layoutIterations,
        forceConstantsFromState
      );
      setDisplayedNodes(nodesAfterLayout);
    } else {
      setDisplayedNodes(preparedNodes);
    }
  }, [currentThemeNodes, currentThemeEdges, layoutIterations, layoutKRepulsion, layoutKSpring, layoutIdealEdgeLength, layoutKCentering, layoutKUntangle, layoutKEdgeNodeRepulsion, layoutDampingFactor, layoutMaxDisplacement, isNestedView]);

  useEffect(() => {
    if (isVisible) {
      runLayout();
    } else {
      setDisplayedNodes([]);
    }
  }, [isVisible, runLayout]);

  const handleRefreshLayout = () => {
    runLayout();
  };

  /** Resets all layout parameters to default values. */
  const handleResetLayoutToDefaults = () => {
    setLayoutKRepulsion(DEFAULT_K_REPULSION);
    setLayoutKSpring(DEFAULT_K_SPRING);
    setLayoutIdealEdgeLength(DEFAULT_IDEAL_EDGE_LENGTH);
    setLayoutKCentering(DEFAULT_K_CENTERING);
    setLayoutKUntangle(DEFAULT_K_UNTANGLE);
    setLayoutKEdgeNodeRepulsion(DEFAULT_K_EDGE_NODE_REPULSION);
    setLayoutDampingFactor(DEFAULT_DAMPING_FACTOR);
    setLayoutMaxDisplacement(DEFAULT_MAX_DISPLACEMENT);
    setLayoutIterations(DEFAULT_LAYOUT_ITERATIONS);
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
          layoutKRepulsion={layoutKRepulsion}
          setLayoutKRepulsion={setLayoutKRepulsion}
          layoutKSpring={layoutKSpring}
          setLayoutKSpring={setLayoutKSpring}
          layoutIdealEdgeLength={layoutIdealEdgeLength}
          setLayoutIdealEdgeLength={setLayoutIdealEdgeLength}
          layoutKCentering={layoutKCentering}
          setLayoutKCentering={setLayoutKCentering}
          layoutKUntangle={layoutKUntangle}
          setLayoutKUntangle={setLayoutKUntangle}
          layoutKEdgeNodeRepulsion={layoutKEdgeNodeRepulsion}
          setLayoutKEdgeNodeRepulsion={setLayoutKEdgeNodeRepulsion}
          layoutDampingFactor={layoutDampingFactor}
          setLayoutDampingFactor={setLayoutDampingFactor}
          layoutMaxDisplacement={layoutMaxDisplacement}
          setLayoutMaxDisplacement={setLayoutMaxDisplacement}
          layoutIterations={layoutIterations}
          setLayoutIterations={setLayoutIterations}
          isNestedView={isNestedView}
          onToggleNestedView={() => setIsNestedView(v => !v)}
          onReset={handleResetLayoutToDefaults}
          onRefreshLayout={handleRefreshLayout}
        />
      </div>
    </div>
  );
};

export default MapDisplay;
