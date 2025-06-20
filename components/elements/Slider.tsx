import { useCallback } from 'react';
import * as React from 'react';

interface SliderProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly explanation?: string;
  readonly disabled?: boolean;
  readonly faded?: boolean;
  readonly suffix?: string;
}

/**
 * Simple labeled slider component used for numeric settings.
 */
function Slider({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  explanation,
  disabled = false,
  faded = false,
  suffix = ''
}: SliderProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseInt(e.target.value, 10));
    },
    [onChange]
  );

  const opacity = faded || disabled ? 'opacity-50' : '';
  return (
    <div className="settings-slider-container">
      <label
        className={`settings-slider-label ${opacity}`}
        htmlFor={id}
      >
        {label}

        :
        <span>
          {value}

          {suffix}
        </span>
      </label>

      <input
        aria-labelledby={`${id}-label`}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        className={`settings-slider ${opacity}`}
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onChange={handleChange}
        type="range"
        value={value}
      />

      {explanation ? (
        <p
          className={`settings-explanation ${opacity}`}
          id={`${id}-label`}
        >
          {explanation}
        </p>
      ) : null}
    </div>
  );
}

Slider.defaultProps = {
  disabled: false,
  explanation: undefined,
  faded: false,
  max: 100,
  min: 0,
  suffix: '',
};

export default Slider;
