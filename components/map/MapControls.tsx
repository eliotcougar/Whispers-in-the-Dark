/**
 * @file MapControls.tsx
 * @description UI component displaying map layout sliders and actions.
 */

import React, { useState } from 'react';

interface MapControlsProps {
  layoutKRepulsion: number;
  setLayoutKRepulsion: (val: number) => void;
  layoutKSpring: number;
  setLayoutKSpring: (val: number) => void;
  layoutIdealEdgeLength: number;
  setLayoutIdealEdgeLength: (val: number) => void;
  layoutKUntangle: number;
  setLayoutKUntangle: (val: number) => void;
  layoutKEdgeNodeRepulsion: number;
  setLayoutKEdgeNodeRepulsion: (val: number) => void;
  layoutDampingFactor: number;
  setLayoutDampingFactor: (val: number) => void;
  layoutMaxDisplacement: number;
  setLayoutMaxDisplacement: (val: number) => void;
  layoutIterations: number;
  setLayoutIterations: (val: number) => void;
  onReset: () => void;
  onRefreshLayout: () => void;
}

/** Renders parameter slider UI element. */
const renderParameterControl = (
  label: string,
  id: string,
  value: number,
  onChange: (val: number) => void,
  min: number,
  max: number,
  step: number,
  explanation?: string
) => (
  <div className="map-control-group">
    <label htmlFor={id} className="map-control-label">
      {label}: {value.toFixed(id === 'layoutKSpring' || id === 'layoutDampingFactor' ? 3 : step === 0.1 ? 1 : 0)}
    </label>
    <input type="range" id={id} min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="map-control-input" />
    {explanation && <p className="map-control-explanation">{explanation}</p>}
  </div>
);

/**
 * Collapsible panel for adjusting map layout parameters.
 */
const MapControls: React.FC<MapControlsProps> = props => {
  const [expanded, setExpanded] = useState(false);
  const {
    layoutKRepulsion,
    setLayoutKRepulsion,
    layoutKSpring,
    setLayoutKSpring,
    layoutIdealEdgeLength,
    setLayoutIdealEdgeLength,
    layoutKUntangle,
    setLayoutKUntangle,
    layoutKEdgeNodeRepulsion,
    setLayoutKEdgeNodeRepulsion,
    layoutDampingFactor,
    setLayoutDampingFactor,
    layoutMaxDisplacement,
    setLayoutMaxDisplacement,
    layoutIterations,
    setLayoutIterations,
    onReset,
    onRefreshLayout,
  } = props;

  return (
    <div className={`map-controls-container ${expanded ? 'controls-expanded' : ''}`}>
      {expanded && (
        <div className="map-layout-sliders-wrapper">
          {renderParameterControl('Repulsion', 'layoutKRepulsion', layoutKRepulsion, setLayoutKRepulsion, 1000, 50000, 1000)}
          {renderParameterControl('Spring', 'layoutKSpring', layoutKSpring, setLayoutKSpring, 0.01, 0.5, 0.01)}
          {renderParameterControl('Edge Length', 'layoutIdealEdgeLength', layoutIdealEdgeLength, setLayoutIdealEdgeLength, 50, 300, 10)}
          {renderParameterControl('Untangle', 'layoutKUntangle', layoutKUntangle, setLayoutKUntangle, 0, 20000, 1000)}
          {renderParameterControl('Node/Edge Repel', 'layoutKEdgeNodeRepulsion', layoutKEdgeNodeRepulsion, setLayoutKEdgeNodeRepulsion, 0, 20000, 1000)}
          {renderParameterControl('Damping', 'layoutDampingFactor', layoutDampingFactor, setLayoutDampingFactor, 0.0, 0.99, 0.01)}
          {renderParameterControl('Max Displacement', 'layoutMaxDisplacement', layoutMaxDisplacement, setLayoutMaxDisplacement, 0, 100, 5)}
          {renderParameterControl('Iterations', 'layoutIterations', layoutIterations, setLayoutIterations, 0, 200, 1)}
          <button onClick={onReset} className="map-control-button mt-2 bg-orange-600 hover:bg-orange-500" style={{ flexBasis: '100%', marginTop: '0.5rem' }}>
            Reset to Defaults
          </button>
        </div>
      )}
      <div className="map-action-buttons-row">
        <button onClick={onRefreshLayout} className="map-control-button">
          Refresh Layout
        </button>
        <button onClick={() => setExpanded(!expanded)} className="map-control-button">
          {expanded ? 'Hide' : 'Show'} Layout Controls
        </button>
      </div>
    </div>
  );
};

export default MapControls;
