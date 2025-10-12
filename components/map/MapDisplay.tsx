/**
 * @file MapDisplay.tsx
 * @description Layout component composing the map view and controls.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type React from 'react';

import { MapData, MapNode, MapLayoutConfig } from '../../types';
import {
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
  applyNestedCircleLayout,
} from '../../utils/mapLayoutUtils';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import {
  DEFAULT_LABEL_MARGIN_PX,
  DEFAULT_LABEL_LINE_HEIGHT_EM,
  DEFAULT_LABEL_OVERLAP_MARGIN_PX,
  DEFAULT_ITEM_ICON_SCALE,
} from '../../constants';
import MapNodeView from './MapNodeView';
import MapControls from './MapControls';


interface MapDisplayProps {
  readonly mapData: MapData;
  readonly adventureName: string | null;
  readonly currentMapNodeId: string | null;
  readonly destinationNodeId: string | null;
  readonly itemPresenceByNode: Record<string, { hasUseful: boolean; hasVehicle: boolean } | undefined>;
  readonly onSelectDestination: (nodeId: string | null) => void;
  readonly initialLayoutConfig: MapLayoutConfig;
  readonly initialViewBox: string;
  readonly onViewBoxChange: (newViewBox: string) => void;
  readonly onNodesPositioned: (nodes: Array<MapNode>) => void;
  readonly onLayoutConfigChange: (newConfig: MapLayoutConfig) => void;
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly onTransitionEnd: (event: React.TransitionEvent<HTMLDivElement>) => void;
}

/**
 * Renders the interactive map with controls for layout tweaking.
 */
function MapDisplay({
  adventureName,
  currentMapNodeId,
  destinationNodeId,
  initialLayoutConfig,
  initialViewBox,
  isVisible,
  itemPresenceByNode,
  mapData,
  onClose,
  onLayoutConfigChange,
  onNodesPositioned,
  onSelectDestination,
  onTransitionEnd,
  onViewBoxChange,
}: MapDisplayProps) {
  const [displayedNodes, setDisplayedNodes] = useState<Array<MapNode>>([]);

  const [layoutIdealEdgeLength, setLayoutIdealEdgeLength] = useState(
    initialLayoutConfig.IDEAL_EDGE_LENGTH
  );
  const [layoutNestedPadding, setLayoutNestedPadding] = useState(
    initialLayoutConfig.NESTED_PADDING
  );
  const [layoutNestedAnglePadding, setLayoutNestedAnglePadding] = useState(
    initialLayoutConfig.NESTED_ANGLE_PADDING
  );
  const labelMarginPx = DEFAULT_LABEL_MARGIN_PX;
  const labelLineHeightEm = DEFAULT_LABEL_LINE_HEIGHT_EM;
  const [labelOverlapMarginPx, setLabelOverlapMarginPx] = useState(
    initialLayoutConfig.LABEL_OVERLAP_MARGIN_PX
  );
  const [itemIconScale, setItemIconScale] = useState(
    initialLayoutConfig.ITEM_ICON_SCALE
  );

  useEffect(() => {
    const edge = initialLayoutConfig.IDEAL_EDGE_LENGTH;
    const pad = initialLayoutConfig.NESTED_PADDING;
    const angle = initialLayoutConfig.NESTED_ANGLE_PADDING;
    const overlap = initialLayoutConfig.LABEL_OVERLAP_MARGIN_PX;
    const iconScale = initialLayoutConfig.ITEM_ICON_SCALE;
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
    return () => { clearTimeout(handler); };
  }, [currentConfigToPropagate, onLayoutConfigChange]);

  /** Nodes belonging to the current theme. */
  const nodes = useMemo(() => mapData.nodes, [mapData.nodes]);

  /** Edges belonging to the current theme. */
  const edges = useMemo(() => mapData.edges, [mapData.edges]);

  /**
   * Prepares nodes for display. The force-directed layout algorithm is
   * intentionally disabled, so nodes are shown using their stored positions.
   */
  const runLayout = useCallback(() => {
    const nodesToProcess = [...nodes];
    const laidOut = applyNestedCircleLayout(nodesToProcess, {
      padding: layoutNestedPadding,
      anglePadding: layoutNestedAnglePadding,
    });
    setDisplayedNodes(laidOut);
    onNodesPositioned(laidOut);
  }, [nodes, layoutNestedPadding, layoutNestedAnglePadding, onNodesPositioned]);

  useEffect(() => {
    if (!isVisible) return;
    runLayout();
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

  return (
    <div
      aria-hidden={!isVisible}
      aria-labelledby="map-display-title"
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      onTransitionEnd={onTransitionEnd}
      role="dialog"
      style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
    >
      <div className="animated-frame-content">
        <Button
          ariaLabel="Close map view"
          icon={<Icon
            name="x"
            size={20}
          />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <h1
          className="text-xl font-bold text-teal-400 mb-2 text-center"
          id="map-display-title"
        >
          {adventureName ? `Map: ${adventureName}` : 'Map'}
        </h1>

        <p className="text-center text-xs text-slate-300 mb-1">
          Pan by dragging, zoom with the mouse wheel or pinch. Hover for details.
        </p>

        <MapNodeView
          currentMapNodeId={currentMapNodeId}
          destinationNodeId={destinationNodeId}
          edges={edges}
          initialViewBox={initialViewBox}
          isInteractive={isVisible}
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
}

export default MapDisplay;
