import { useCallback } from 'react';

interface CheckboxSelectorProps {
  readonly options: ReadonlyArray<string>;
  readonly selected: ReadonlyArray<string>;
  readonly onToggle: (value: string) => void;
  readonly errorText?: string;
}

/**
 * List of checkboxes used for selecting multiple options.
 */
function CheckboxSelector({ options, selected, onToggle, errorText }: CheckboxSelectorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onToggle(e.currentTarget.value);
    },
    [onToggle]
  );

  return (
    <div className="space-y-3">
      {options.map(option => (
        <label
          className="flex items-center space-x-3 cursor-pointer p-2 bg-slate-700/50 rounded-md hover:bg-slate-600/50 transition-colors"
          key={option}
        >
          <input
            aria-labelledby={`${option}-label`}
            checked={selected.includes(option)}
            className="form-checkbox h-5 w-5 text-sky-500 bg-slate-600 border-slate-500 rounded focus:ring-sky-400 focus:ring-offset-slate-800"
            onChange={handleChange}
            type="checkbox"
            value={option}
          />

          <span
            className="text-slate-200 text-lg"
            id={`${option}-label`}
          >
            {option}
          </span>
        </label>
      ))}

      {errorText ? (
        <p className="text-red-400 mt-2 text-sm">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

CheckboxSelector.defaultProps = {
  errorText: undefined,
};

export default CheckboxSelector;
