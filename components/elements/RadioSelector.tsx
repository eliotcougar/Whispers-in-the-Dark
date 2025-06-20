import { useEffect, useState, useCallback } from 'react';
import * as React from 'react';

interface RadioSelectorProps {
  readonly name: string;
  readonly options: ReadonlyArray<string>;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly addCustom?: boolean;
  readonly placeholder?: string;
}

/**
 * Radio group with optional custom input field when "Custom" is selected.
 */
function RadioSelector({
  name,
  options,
  value,
  onChange,
  addCustom = false,
  placeholder = ''
}: RadioSelectorProps) {
  const isPredefined = options.includes(value);
  const initialCustom = isPredefined || !addCustom ? '' : value === 'Not Specified' ? '' : value;
  const [customValue, setCustomValue] = useState(initialCustom);

  useEffect(() => {
    const predefined = options.includes(value);
    setCustomValue(predefined || !addCustom ? '' : value === 'Not Specified' ? '' : value);
  }, [value, options, addCustom]);

  const handleOptionChange = useCallback(
    (option: string) => {
      if (option === 'Custom') {
        onChange(customValue.trim() || 'Not Specified');
      } else {
        onChange(option);
      }
    },
    [customValue, onChange]
  );

  const handleRadioChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleOptionChange(e.currentTarget.value);
    },
    [handleOptionChange]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setCustomValue(v);
      if (!options.includes(value)) {
        onChange(v.trim() || 'Not Specified');
      }
    },
    [onChange, options, value]
  );

  const selected = isPredefined ? value : 'Custom';
  const displayOptions = addCustom ? [...options, 'Custom'] : options;

  return (
    <div className="space-y-3">
      {displayOptions.map(option => (
        <label
          className="flex items-center space-x-3 cursor-pointer p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors"
          key={option}
        >
          <input
            aria-labelledby={`${name}-${option}`}
            checked={selected === option}
            className="form-radio h-5 w-5 text-sky-500 bg-slate-600 border-slate-500 focus:ring-sky-400 focus:ring-offset-slate-800"
            name={name}
            onChange={handleRadioChange}
            type="radio"
            value={option}
          />

          <span
            className="text-slate-200 text-lg"
            id={`${name}-${option}`}
          >
            {option}
          </span>
        </label>
      ))}

      {addCustom && selected === 'Custom' ? (
        <input
          aria-label="Custom input"
          className="w-full p-2 mt-2 bg-slate-600 text-slate-100 border border-slate-500 rounded-md focus:ring-sky-500 focus:border-sky-500"
          onChange={handleInputChange}
          placeholder={placeholder}
          type="text"
          value={customValue}
        />
      ) : null}
    </div>
  );
}

RadioSelector.defaultProps = {
  addCustom: false,
  placeholder: '',
};

export default RadioSelector;
