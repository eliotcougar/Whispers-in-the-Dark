/**
 * @file MapControls.tsx
 * @description UI component displaying map layout sliders and actions.
 */

import { useCallback, useState } from 'react';

/* eslint-disable react/no-multi-comp */

import * as React from 'react';

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

interface ParameterControlProps {
  readonly explanation: string;
  readonly id: string;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly onChange: (val: number) => void;
  readonly step: number;
  readonly value: number;
}

function ParameterControl({
  label,
  id,
  value,
  onChange,
  min,
  max,
  step,
  explanation = '',
}: ParameterControlProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  return (
    <div className="map-control-group">
      <label
        className="map-control-label"
        htmlFor={id}
      >
        {label}

        :
        {value.toFixed(step < 1 ? 2 : 0)}
      </label>

      <input
        className="map-control-input"
        id={id}
        max={max}
        min={min}
        onChange={handleChange}
        step={step}
        type="range"
        value={value}
      />

      {explanation ? <p className="map-control-explanation">
        {explanation}
      </p> : null}
    </div>
  );
}

/**
 * Collapsible panel for adjusting map layout parameters.
 */
function MapControls(props: MapControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const handleToggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);
  const {
    padding,
    setPadding,
    anglePadding,
    setAnglePadding,
    overlapMargin,
    setOverlapMargin,
    itemIconScale,
    setItemIconScale,
    onReset,
    onRefreshLayout
  } = props;

  return (
    <div className={`map-controls-container ${expanded ? 'controls-expanded' : ''}`}>
      {expanded ? <div className="map-layout-sliders-wrapper">
        <ParameterControl
          explanation="Distance between parent and child levels"
          id="layoutPadding"
          label="Padding"
          max={60}
          min={5}
          onChange={setPadding}
          step={1}
          value={padding}
        />

        <ParameterControl
          explanation="Extra spacing between siblings"
          id="layoutAnglePadding"
          label="Angle Padding"
          max={0.5}
          min={0}
          onChange={setAnglePadding}
          step={0.01}
          value={anglePadding}
        />

        <ParameterControl
          explanation="Extra spacing when labels overlap"
          id="overlapMargin"
          label="Overlap Margin"
          max={10}
          min={0}
          onChange={setOverlapMargin}
          step={1}
          value={overlapMargin}
        />

        <ParameterControl
          explanation="Relative size of item markers"
          id="itemIconScale"
          label="Icon Size"
          max={1.0}
          min={0.2}
          onChange={setItemIconScale}
          step={0.1}
          value={itemIconScale}
        />

        <button
          className="map-control-button mt-2 bg-orange-600 hover:bg-orange-500"
          onClick={onReset}
          style={{ flexBasis: '100%', marginTop: '0.5rem' }}
          type="button"
        >
          Reset to Defaults
        </button>
      </div> : null}

      <div className="map-action-buttons-row">
        <button
          className="map-control-button"
          onClick={handleToggleExpanded}
          type="button"
        >
          {`${expanded ? 'Hide' : 'Show'} Layout Controls`}
        </button>

        <button
          className="map-control-button"
          onClick={onRefreshLayout}
          type="button"
        >
          Refresh Layout
        </button>
      </div>
    </div>
  );
}

export default MapControls;
