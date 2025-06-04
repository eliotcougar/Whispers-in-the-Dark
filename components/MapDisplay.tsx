
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapData, MapNode, MapEdge, MapLayoutConfig } from '../types'; 
import {
  applyBasicLayoutAlgorithm,
  LayoutForceConstants, 
  DEFAULT_K_REPULSION,
  DEFAULT_K_SPRING,
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_K_CENTERING,
  DEFAULT_K_UNTANGLE, 
  DEFAULT_K_EDGE_NODE_REPULSION,
  DEFAULT_DAMPING_FACTOR,
  DEFAULT_MAX_DISPLACEMENT,
  DEFAULT_LAYOUT_ITERATIONS
} from '../utils/mapLayoutUtils'; 

interface MapDisplayProps {
  mapData: MapData;
  currentThemeName: string | null;
  currentMapNodeId: string | null; 
  initialLayoutConfig: MapLayoutConfig;
  onLayoutConfigChange: (newConfig: MapLayoutConfig) => void;
  isVisible: boolean;
  onClose: () => void;
}

const NODE_RADIUS = 20;
const VIEWBOX_WIDTH_INITIAL = 1000;
const VIEWBOX_HEIGHT_INITIAL = 750;
const EDGE_HOVER_WIDTH = 8; 
const MAX_LABEL_LINES = 4; 
const LABEL_LINE_HEIGHT_EM = 1.1; 

const splitTextIntoLines = (text: string, maxCharsPerLine: number, maxLines: number): string[] => {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = "";

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
            const lastLineContent = lines[maxLines -1];
            if (lastLineContent.length > 3) {
                 lines[maxLines -1] = lastLineContent.slice(0, -3) + "...";
            } else {
                 lines[maxLines -1] = "..";
            }
        }
        currentLine = ""; 
        break; 
      }
      currentLine = word;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  } else if (currentLine && lines.length === maxLines && lines[maxLines-1] && !lines[maxLines-1].endsWith("...")) {
     if (lines[maxLines-1].length > 3) {
        lines[maxLines-1] = lines[maxLines-1].slice(0, -3) + "...";
     } else {
        lines[maxLines-1] = "..";
     }
  }

  if (lines.length === maxLines && text.split(' ').length > words.indexOf(currentLine.split(' ')[0]) + currentLine.split(' ').length) {
    const lastLine = lines[maxLines - 1];
    if (lastLine && lastLine.length > 3 && !lastLine.endsWith("...")) {
      lines[maxLines - 1] = lastLine.slice(0, Math.max(0, lastLine.length - 3)) + "...";
    } else if (lastLine && !lastLine.endsWith("...")) {
      lines[maxLines - 1] = "..";
    }
  }
  return lines;
};


const MapDisplay: React.FC<MapDisplayProps> = ({
  mapData,
  currentThemeName,
  currentMapNodeId,
  initialLayoutConfig,
  onLayoutConfigChange,
  isVisible,
  onClose,
}) => {
  const [viewBox, setViewBox] = useState(`${-VIEWBOX_WIDTH_INITIAL/2} ${-VIEWBOX_HEIGHT_INITIAL/2} ${VIEWBOX_WIDTH_INITIAL} ${VIEWBOX_HEIGHT_INITIAL}`);
  const [isDragging, setIsDragging] = useState(false);
  const [lastScreenDragPoint, setLastScreenDragPoint] = useState<{ x: number; y: number } | null>(null); 
  const [tooltip, setTooltip] = useState<{ content: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [displayedNodes, setDisplayedNodes] = useState<MapNode[]>([]);
  const [showLayoutControls, setShowLayoutControls] = useState(false);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);


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

  const currentConfigToPropagate = useMemo((): MapLayoutConfig => ({
    K_REPULSION: layoutKRepulsion,
    K_SPRING: layoutKSpring,
    IDEAL_EDGE_LENGTH: layoutIdealEdgeLength,
    K_CENTERING: layoutKCentering,
    K_UNTANGLE: layoutKUntangle,
    K_EDGE_NODE_REPULSION: layoutKEdgeNodeRepulsion,
    DAMPING_FACTOR: layoutDampingFactor,
    MAX_DISPLACEMENT: layoutMaxDisplacement,
    iterations: layoutIterations,
  }), [layoutKRepulsion, layoutKSpring, layoutIdealEdgeLength, layoutKCentering, layoutKUntangle, layoutKEdgeNodeRepulsion, layoutDampingFactor, layoutMaxDisplacement, layoutIterations]);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      onLayoutConfigChange(currentConfigToPropagate);
    }, 500); 

    return () => {
      clearTimeout(handler);
    };
  }, [currentConfigToPropagate, onLayoutConfigChange]);


  const currentThemeNodes = useMemo(() => {
    if (!currentThemeName) return [];
    return mapData.nodes.filter(node => node.themeName === currentThemeName);
  }, [mapData.nodes, currentThemeName]);

  const currentThemeEdges = useMemo(() => {
    if (!currentThemeName) return [];
    const themeNodeIds = new Set(currentThemeNodes.map(node => node.id));
    return mapData.edges.filter(edge => themeNodeIds.has(edge.sourceNodeId) && themeNodeIds.has(edge.targetNodeId));
  }, [mapData.edges, currentThemeNodes, currentThemeName]);

  const initialLayoutNodes = useMemo(() => {
    const nodesToProcess = [...currentThemeNodes]; 
    const newPositions: { [id: string]: { x: number; y: number } } = {};

    nodesToProcess.forEach(node => {
        if (node.position.x !== 0 || node.position.y !== 0) {
            newPositions[node.id] = node.position;
        }
    });
    
    const nodesNeedingInitialLayout = nodesToProcess.filter(node => !node.data.isLeaf && (node.position.x === 0 && node.position.y === 0));
    const leafNodesNeedingInitialLayout = nodesToProcess.filter(node => node.data.isLeaf && (node.position.x === 0 && node.position.y === 0));

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

    leafNodesNeedingInitialLayout.forEach(leafNode => {
        if (leafNode.data.parentNodeId) {
            const parentNodePos = newPositions[leafNode.data.parentNodeId] || nodesToProcess.find(n => n.id === leafNode.data.parentNodeId)?.position;
            if (parentNodePos) {
                newPositions[leafNode.id] = { x: parentNodePos.x + NODE_RADIUS * 1.5 * (Math.random() > 0.5 ? 1 : -1) , y: parentNodePos.y + NODE_RADIUS * 1.5 * (Math.random() > 0.5 ? 1 : -1) };
            } else {
                 newPositions[leafNode.id] = {x: Math.random() * 100 - 50, y: Math.random() * 100 - 50}; 
            }
        } else { 
            const connectedEdgesForLeaf: MapEdge[] = currentThemeEdges.filter(e => e.sourceNodeId === leafNode.id || e.targetNodeId === leafNode.id);
            const mainNodesConnectedToLeaf = connectedEdgesForLeaf.reduce((acc: MapNode[], edge: MapEdge) => {
                const otherEndId = edge.sourceNodeId === leafNode.id ? edge.targetNodeId : edge.sourceNodeId;
                const otherNode = nodesToProcess.find(n => n.id === otherEndId && !n.data.isLeaf);
                if (otherNode && !acc.find(existingNode => existingNode.id === otherNode.id)) {
                    acc.push(otherNode);
                }
                return acc;
            }, [] as MapNode[]);

            if (mainNodesConnectedToLeaf.length === 2) {
                const pos1 = newPositions[mainNodesConnectedToLeaf[0].id] || mainNodesConnectedToLeaf[0].position;
                const pos2 = newPositions[mainNodesConnectedToLeaf[1].id] || mainNodesConnectedToLeaf[1].position;
                if (pos1 && pos2) {
                     newPositions[leafNode.id] = { x: (pos1.x + pos2.x) / 2, y: (pos1.y + pos2.y) / 2 };
                } else {
                    newPositions[leafNode.id] = {x: Math.random() * 100 - 50, y: Math.random() * 100 - 50};
                }
            } else { 
                 newPositions[leafNode.id] = {x: Math.random() * 100 - 50, y: Math.random() * 100 - 50}; 
            }
        }
    });
    
    return nodesToProcess.map(node => ({
      ...node,
      position: newPositions[node.id] || node.position, 
    }));
  }, [currentThemeNodes, currentThemeEdges]);

  const runLayout = useCallback(() => {
    if (initialLayoutNodes.length > 0) {
      const forceConstantsFromState: LayoutForceConstants = {
        K_REPULSION: layoutKRepulsion, K_SPRING: layoutKSpring, IDEAL_EDGE_LENGTH: layoutIdealEdgeLength,
        K_CENTERING: layoutKCentering, K_UNTANGLE: layoutKUntangle, K_EDGE_NODE_REPULSION: layoutKEdgeNodeRepulsion,
        DAMPING_FACTOR: layoutDampingFactor, MAX_DISPLACEMENT: layoutMaxDisplacement,
      };
      const nodesAfterLayout = applyBasicLayoutAlgorithm(
        initialLayoutNodes, currentThemeEdges, VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL, layoutIterations, forceConstantsFromState
      );
      setDisplayedNodes(nodesAfterLayout);
    } else {
      setDisplayedNodes(initialLayoutNodes);
    }
  }, [
    initialLayoutNodes, currentThemeEdges, layoutIterations,
    layoutKRepulsion, layoutKSpring, layoutIdealEdgeLength,
    layoutKCentering, layoutKUntangle, layoutKEdgeNodeRepulsion,
    layoutDampingFactor, layoutMaxDisplacement
  ]);

  useEffect(() => {
    if (isVisible) {
      runLayout();
    } else {
      setDisplayedNodes([]);
    }
  }, [isVisible, runLayout]); 

  const handleRefreshLayout = () => { runLayout(); };

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

  const regionHostNodes = useMemo(() => {
    return displayedNodes.filter(mainNode => {
      if (mainNode.data.isLeaf) return false;
      return currentThemeEdges.some(edge => 
        edge.data.type === 'containment' &&
        ( (edge.sourceNodeId === mainNode.id && displayedNodes.find(n => n.id === edge.targetNodeId)?.data.isLeaf && displayedNodes.find(n => n.id === edge.targetNodeId)?.data.parentNodeId === mainNode.id) ||
          (edge.targetNodeId === mainNode.id && displayedNodes.find(n => n.id === edge.sourceNodeId)?.data.isLeaf && displayedNodes.find(n => n.id === edge.sourceNodeId)?.data.parentNodeId === mainNode.id) )
      );
    });
  }, [displayedNodes, currentThemeEdges]);


  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest('.map-node')) return;
    setIsDragging(true);
    setLastScreenDragPoint({ x: e.clientX, y: e.clientY });
    if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !lastScreenDragPoint || !svgRef.current) return;

    const svgEl = svgRef.current;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const ctmInverse = ctm.inverse();

    const svgDomPoint = svgEl.createSVGPoint();

    svgDomPoint.x = lastScreenDragPoint.x;
    svgDomPoint.y = lastScreenDragPoint.y;
    const prevSVGPoint = svgDomPoint.matrixTransform(ctmInverse);

    svgDomPoint.x = e.clientX;
    svgDomPoint.y = e.clientY;
    const currentSVGPoint = svgDomPoint.matrixTransform(ctmInverse);
    
    const deltaViewBoxX = prevSVGPoint.x - currentSVGPoint.x;
    const deltaViewBoxY = prevSVGPoint.y - currentSVGPoint.y;
    
    const [vx, vy, vw, vh] = viewBox.split(' ').map(parseFloat);
    
    setViewBox(`${vx + deltaViewBoxX} ${vy + deltaViewBoxY} ${vw} ${vh}`);
    setLastScreenDragPoint({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false); setLastScreenDragPoint(null);
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
  };
  
  const handleMouseLeave = () => { if (isDragging) handleMouseUp(); setTooltip(null); };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const [vx, vy, vw, vh] = viewBox.split(' ').map(parseFloat);
    const zoomFactor = 1.1;
    const newVw = e.deltaY < 0 ? vw / zoomFactor : vw * zoomFactor;
    const newVh = e.deltaY < 0 ? vh / zoomFactor : vh * zoomFactor;
    
    const minDim = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) * 0.1; 
    const maxDim = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) * 10; 
    if (newVw < minDim || newVw > maxDim || newVh < minDim || newVh > maxDim) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const screenX = e.clientX - svgRect.left;
    const screenY = e.clientY - svgRect.top;

    const svgEl = svgRef.current;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const ctmInverse = ctm.inverse();
    const svgDomPoint = svgEl.createSVGPoint();
    svgDomPoint.x = e.clientX; 
    svgDomPoint.y = e.clientY;
    const svgPoint = svgDomPoint.matrixTransform(ctmInverse);
    
    const newVx = svgPoint.x - (svgPoint.x - vx) * (newVw / vw);
    const newVy = svgPoint.y - (svgPoint.y - vy) * (newVh / vh);
    
    setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
  };

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt(
      Math.pow(t1.clientX - t2.clientX, 2) + Math.pow(t1.clientY - t2.clientY, 2)
    );
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    e.preventDefault();

    if (e.touches.length === 1) {
      if ((e.target as SVGElement).closest('.map-node')) return; 
      setIsDragging(true);
      setLastScreenDragPoint({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setLastPinchDistance(null);
      svgRef.current.style.cursor = 'grabbing';
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      setLastPinchDistance(getTouchDistance(e.touches[0], e.touches[1]));
      setLastScreenDragPoint(null);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    e.preventDefault();

    if (e.touches.length === 1 && isDragging && lastScreenDragPoint) {
      const touch = e.touches[0];
      const svgEl = svgRef.current;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return;
      const ctmInverse = ctm.inverse();
      const svgDomPoint = svgEl.createSVGPoint();

      svgDomPoint.x = lastScreenDragPoint.x;
      svgDomPoint.y = lastScreenDragPoint.y;
      const prevSVGPoint = svgDomPoint.matrixTransform(ctmInverse);

      svgDomPoint.x = touch.clientX;
      svgDomPoint.y = touch.clientY;
      const currentSVGPoint = svgDomPoint.matrixTransform(ctmInverse);

      const deltaViewBoxX = prevSVGPoint.x - currentSVGPoint.x;
      const deltaViewBoxY = prevSVGPoint.y - currentSVGPoint.y;

      const [vx, vy, vw, vh] = viewBox.split(' ').map(parseFloat);
      setViewBox(`${vx + deltaViewBoxX} ${vy + deltaViewBoxY} ${vw} ${vh}`);
      setLastScreenDragPoint({ x: touch.clientX, y: touch.clientY });

    } else if (e.touches.length === 2 && lastPinchDistance !== null) {
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (currentDistance === 0 || lastPinchDistance === 0) return; 
      
      const scaleFactor = currentDistance / lastPinchDistance;
      const [vx, vy, vw, vh] = viewBox.split(' ').map(parseFloat);
      
      let newVw = vw / scaleFactor;
      let newVh = vh / scaleFactor;

      const minDim = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) * 0.1;
      const maxDim = Math.min(VIEWBOX_WIDTH_INITIAL, VIEWBOX_HEIGHT_INITIAL) * 10;

      if (newVw < minDim || newVw > maxDim || newVh < minDim || newVh > maxDim) {
          if (newVw < minDim) { newVh *= (minDim/newVw); newVw = minDim; }
          if (newVh < minDim) { newVw *= (minDim/newVh); newVh = minDim; }
          if (newVw > maxDim) { newVh *= (maxDim/newVw); newVw = maxDim; }
          if (newVh > maxDim) { newVw *= (maxDim/newVh); newVh = maxDim; }
      }
      
      const clientMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const clientMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const svgEl = svgRef.current;
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return;
      const ctmInverse = ctm.inverse();
      const svgDomPoint = svgEl.createSVGPoint();
      svgDomPoint.x = clientMidX;
      svgDomPoint.y = clientMidY;
      const svgPinchCenter = svgDomPoint.matrixTransform(ctmInverse);
      
      const newVx = svgPinchCenter.x - (svgPinchCenter.x - vx) * (newVw / vw);
      const newVy = svgPinchCenter.y - (svgPinchCenter.y - vy) * (newVh / vh);

      setViewBox(`${newVx} ${newVy} ${newVw} ${newVh}`);
      setLastPinchDistance(currentDistance);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<SVGSVGElement>) => {
    if (svgRef.current) {
      svgRef.current.style.cursor = 'grab';
    }
    if (e.touches.length < 2) {
      setLastPinchDistance(null);
    }
    if (e.touches.length < 1) {
      setIsDragging(false);
      setLastScreenDragPoint(null);
    }
  };


  const handleNodeMouseEnter = (node: MapNode, event: React.MouseEvent) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect || !currentThemeName) return;
    let content = `${node.placeName}`;
    if (node.data.description) content += `\nDescription: ${node.data.description}`;
    if (node.data.aliases && node.data.aliases.length > 0) content += `\nAliases: ${node.data.aliases.join(', ')}`;
    
    if (node.data.status) content += `\nStatus: ${node.data.status}`;
    if (node.data.isLeaf && node.data.parentNodeId) { 
        const parentNode = displayedNodes.find(n=>n.id === node.data.parentNodeId); 
        content += `\n(Part of: ${parentNode?.placeName || 'Unknown Location'})`;
    }
    setTooltip({ content: content, x: event.clientX - svgRect.left + 15, y: event.clientY - svgRect.top + 15 });
  };

  const handleEdgeMouseEnter = (edge: MapEdge, event: React.MouseEvent) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const sourceNode = displayedNodes.find(n => n.id === edge.sourceNodeId);
    const targetNode = displayedNodes.find(n => n.id === edge.targetNodeId);
    let content = `Path between ${sourceNode?.placeName || 'Unknown'} and ${targetNode?.placeName || 'Unknown'}`;
    if (edge.data.description) content += `\nDescription: ${edge.data.description}`;
    if (edge.data.type) content += `\nType: ${edge.data.type}`;
    if (edge.data.status) content += `\nStatus: ${edge.data.status}`;
    if (edge.data.travelTime) content += `\nTravel: ${edge.data.travelTime}`;
    setTooltip({ content: content, x: event.clientX - svgRect.left + 15, y: event.clientY - svgRect.top + 15 });
  };

  const handleMouseLeaveGeneral = () => { setTooltip(null); };

  const renderParameterControl = (label: string, id: string, value: number, onChange: (val: number) => void, min: number, max: number, step: number, explanation?: string) => (
    <div className="map-control-group">
      <label htmlFor={id} className="map-control-label">
        {label}: {value.toFixed(id === 'layoutKCentering' || id === 'layoutKSpring' || id === 'layoutDampingFactor' ? 3 : (step === 0.1 ? 1: 0))}
      </label>
      <input type="range" id={id} min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="map-control-input" />
      {explanation && <p className="map-control-explanation">{explanation}</p>}
    </div>
  );

  if (!isVisible) return null;

  return (
    <div className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="map-display-title">
      <div className="animated-frame-content">
        <button onClick={onClose} className="animated-frame-close-button" aria-label="Close map view">&times;</button>
        <h1 id="map-display-title" className="text-xl font-bold text-teal-400 mb-2 text-center">
          {currentThemeName ? `Map: ${currentThemeName}` : "Map"}
        </h1>
        <p className="text-center text-xs text-slate-400 mb-1">
            Pan by dragging (mouse or single finger), zoom with mouse wheel (or pinch with two fingers). Hover for details.
        </p>
        <div className="map-content-area">
          {displayedNodes.length === 0 ? (
            <p className="text-slate-500 italic">No map data available for this theme yet.</p>
          ) : (
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
              <g> {/* Main group for all map elements */}
                {/* Region Circles - Rendered first to be in the background */}
                {regionHostNodes.map(hostNode => (
                  <circle
                    key={`region-circle-${hostNode.id}`}
                    cx={hostNode.position.x}
                    cy={hostNode.position.y}
                    r={layoutIdealEdgeLength}
                    fill="none"
                    stroke="#888888" 
                    strokeWidth="1px"
                    opacity="0.3" 
                  />
                ))}

                {/* Edges */}
                {currentThemeEdges.map(edge => {
                  const sourceNode = displayedNodes.find(n => n.id === edge.sourceNodeId);
                  const targetNode = displayedNodes.find(n => n.id === edge.targetNodeId);
                  if (!sourceNode || !targetNode) return null;
                  let edgeClass = "map-edge";
                  if (edge.data.type) edgeClass += ` ${edge.data.type.replace(/\s+/g, '_').toLowerCase()}`; 
                  if (edge.data.status) edgeClass += ` ${edge.data.status.replace(/\s+/g, '_').toLowerCase()}`; 
                  return (
                    <g key={edge.id} className="map-edge-group" onMouseEnter={(e) => handleEdgeMouseEnter(edge, e)} onMouseLeave={handleMouseLeaveGeneral}>
                      <line x1={sourceNode.position.x} y1={sourceNode.position.y} x2={targetNode.position.x} y2={targetNode.position.y} stroke="transparent" strokeWidth={EDGE_HOVER_WIDTH} />
                      <line x1={sourceNode.position.x} y1={sourceNode.position.y} x2={targetNode.position.x} y2={targetNode.position.y} className={edgeClass} />
                    </g>
                  );
                })}

                {/* Nodes and Labels */}
                {displayedNodes.map(node => {
                  let nodeClass = "map-node-circle";
                  if (node.data.isLeaf) nodeClass += " leaf";
                  if (node.id === currentMapNodeId) nodeClass += " current"; 
                  if (node.data.status === 'quest_target') nodeClass += " quest_target";
                  const maxCharsPerLine = node.data.isLeaf ? 20 : 25; 
                  const labelLines = splitTextIntoLines(node.placeName, maxCharsPerLine, MAX_LABEL_LINES);
                  const initialDyOffset = -(labelLines.length - 1) * 0.5 * LABEL_LINE_HEIGHT_EM + 0.3; 
                  return (
                    <g key={node.id} transform={`translate(${node.position.x}, ${node.position.y})`} className="map-node" onMouseEnter={(e) => handleNodeMouseEnter(node, e)} onMouseLeave={handleMouseLeaveGeneral}>
                      <circle className={nodeClass} r={node.data.isLeaf ? NODE_RADIUS * 0.7 : NODE_RADIUS} />
                      <text className={`map-node-label ${node.data.isLeaf ? 'leaf-label' : ''}`}>
                        {labelLines.map((line, index) => (
                          <tspan key={`${node.id}-line-${index}`} x="0" dy={index === 0 ? `${initialDyOffset}em` : `${LABEL_LINE_HEIGHT_EM}em`}>{line}</tspan>
                        ))}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
           {tooltip && (<div className="map-tooltip" style={{ top: tooltip.y, left: tooltip.x }}>
              {tooltip.content.split('\n').map((line, index) => ( <React.Fragment key={index}>{line}{index < tooltip.content.split('\n').length - 1 && <br />}</React.Fragment> ))}
            </div>
          )}
        </div>
        <div 
          className={`map-controls-container ${showLayoutControls ? 'controls-expanded' : ''}`}
        >
          {showLayoutControls && (
            <div className="map-layout-sliders-wrapper">
              {renderParameterControl("Repulsion", "layoutKRepulsion", layoutKRepulsion, setLayoutKRepulsion, 1000, 50000, 1000)}
              {renderParameterControl("Spring", "layoutKSpring", layoutKSpring, setLayoutKSpring, 0.01, 0.5, 0.01)}
              {renderParameterControl("Edge Length", "layoutIdealEdgeLength", layoutIdealEdgeLength, setLayoutIdealEdgeLength, 50, 300, 10)}
              {renderParameterControl("Centering", "layoutKCentering", layoutKCentering, setLayoutKCentering, 0.001, 0.1, 0.001)}
              {renderParameterControl("Untangle", "layoutKUntangle", layoutKUntangle, setLayoutKUntangle, 0, 20000, 1000)}
              {renderParameterControl("Node/Edge Repel", "layoutKEdgeNodeRepulsion", layoutKEdgeNodeRepulsion, setLayoutKEdgeNodeRepulsion, 0, 20000, 1000)}
              {renderParameterControl("Damping", "layoutDampingFactor", layoutDampingFactor, setLayoutDampingFactor, 0.0, 0.99, 0.01)}
              {renderParameterControl("Max Displacement", "layoutMaxDisplacement", layoutMaxDisplacement, setLayoutMaxDisplacement, 0, 100, 5)}
              {renderParameterControl("Iterations", "layoutIterations", layoutIterations, setLayoutIterations, 0, 200, 1)}
              <button onClick={handleResetLayoutToDefaults} className="map-control-button mt-2 bg-orange-600 hover:bg-orange-500" style={{ flexBasis: '100%', marginTop: '0.5rem' }}>
                Reset to Defaults
              </button>
            </div>
          )}
          <div className="map-action-buttons-row">
            <button onClick={handleRefreshLayout} className="map-control-button">
              Refresh Layout
            </button>
            <button onClick={() => setShowLayoutControls(!showLayoutControls)} className="map-control-button">
              {showLayoutControls ? "Hide" : "Show"} Layout Controls
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapDisplay;

