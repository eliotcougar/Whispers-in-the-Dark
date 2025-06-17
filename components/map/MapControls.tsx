/**
 * @file MapControls.tsx
 * @description UI component displaying map layout sliders and actions.
 */

import React, { useState } from 'react';

interface MapControlsProps {
  readonly padding: number;
  readonly setPadding: (val: number) => void;
  readonly anglePadding: number;
  readonly setAnglePadding: (val: number) => void;
  readonly overlapMargin: number;
  readonly setOverlapMargin: (val: number) => void;
  readonly itemIconScale: number;
  readonly setItemIconScale: (val: number) => void;
  readonly onReset: () => void;
  readonly onRefreshLayout: () => void;
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
    <label className="map-control-label" htmlFor={id}>
      {label}: {value.toFixed(step < 1 ? 2 : 0)}
    </label>

    <input className="map-control-input" id={id} max={max} min={min} onChange={e => onChange(parseFloat(e.target.value))} step={step} type="range" value={value} />

    {explanation ? <p className="map-control-explanation">{explanation}</p> : null}
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
    itemIconScale,
    setItemIconScale,
    onReset
  } = props;

  return (
    <div className={`map-controls-container ${expanded ? 'controls-expanded' : ''}`}>
      {expanded ? <div className="map-layout-sliders-wrapper">
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

        {renderParameterControl(
            'Icon Size',
            'itemIconScale',
            itemIconScale,
            setItemIconScale,
            0.2,
            1.0,
            0.1,
            'Relative size of item markers'
          )}

        <button className="map-control-button mt-2 bg-orange-600 hover:bg-orange-500" onClick={onReset} style={{ flexBasis: '100%', marginTop: '0.5rem' }}>
          Reset to Defaults
        </button>
      </div> : null}

      <div className="map-action-buttons-row">
        <button className="map-control-button" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide' : 'Show'} Layout Controls
        </button>
      </div>
    </div>
  );
};

export default MapControls;
