/**
 * @file ParameterControl.tsx
 * @description Slider with label for map layout parameters.
 */
import { useCallback } from 'react';
import * as React from 'react';

export interface ParameterControlProps {
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

        {': '}

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

      {explanation ? (
        <p className="map-control-explanation">
          {explanation}
        </p>
      ) : null}
    </div>
  );
}

export default ParameterControl;
