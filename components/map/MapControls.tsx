/**
 * @file MapControls.tsx
 * @description UI component displaying map layout sliders and actions.
 */

import React, { useState } from 'react';

interface MapControlsProps {
  padding: number;
  setPadding: (val: number) => void;
  anglePadding: number;
  setAnglePadding: (val: number) => void;
  overlapMargin: number;
  setOverlapMargin: (val: number) => void;
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
      {label}: {value.toFixed(step < 1 ? 2 : 0)}
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
    padding,
    setPadding,
    anglePadding,
    setAnglePadding,
    overlapMargin,
    setOverlapMargin,
    onReset,
    onRefreshLayout,
  } = props;

  return (
    <div className={`map-controls-container ${expanded ? 'controls-expanded' : ''}`}>
      {expanded && (
        <div className="map-layout-sliders-wrapper">
          {renderParameterControl(
            'Padding',
            'layoutPadding',
            padding,
            setPadding,
            5,
            60,
            1,
            'Distance between parent and child levels'
          )}
          {renderParameterControl(
            'Angle Padding',
            'layoutAnglePadding',
            anglePadding,
            setAnglePadding,
            0,
            0.5,
            0.01,
            'Extra spacing between siblings'
          )}
          {renderParameterControl(
            'Overlap Margin',
            'overlapMargin',
            overlapMargin,
            setOverlapMargin,
            0,
            10,
            1,
            'Extra spacing when labels overlap'
          )}
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
