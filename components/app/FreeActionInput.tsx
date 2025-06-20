import * as React from 'react';
import { useCallback } from 'react';
import { FREE_FORM_ACTION_COST, FREE_FORM_ACTION_MAX_LENGTH } from '../../constants';
import Button from '../elements/Button';

interface FreeActionInputProps {
  readonly freeFormActionText: string;
  readonly canPerformFreeAction: boolean;
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onSubmit: () => void;
}

function FreeActionInput({
  freeFormActionText,
  canPerformFreeAction,
  onChange,
  onSubmit,
}: FreeActionInputProps) {
  const handleSubmitClick = useCallback(
    () => { onSubmit(); },
    [onSubmit]
  );

  return (
    <div className="mt-4 p-4 bg-slate-800 border border-slate-700 rounded-lg shadow">
      <label
        className="block text-sm font-medium text-amber-300 mb-1"
        htmlFor="freeFormAction"
      >
        Perform Custom Action (Cost:
        {' '}

        {FREE_FORM_ACTION_COST}

        {' '}
        Score Points)
      </label>

      <div className="flex space-x-2">
        <input
          aria-label="Custom action input"
          className="flex-grow p-2 bg-slate-700 text-slate-200 border border-slate-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 disabled:bg-slate-600 disabled:text-slate-400"
          disabled={!canPerformFreeAction}
          id="freeFormAction"
          maxLength={FREE_FORM_ACTION_MAX_LENGTH}
          onChange={onChange}
          placeholder="Type your custom action here..."
          type="text"
          value={freeFormActionText}
        />

        <Button
          ariaLabel="Submit custom action"
          disabled={!canPerformFreeAction || freeFormActionText.trim() === ''}
          label="Submit"
          onClick={handleSubmitClick}
          preset="green"
          type="button"
          variant="compact"
        />
      </div>

      {!canPerformFreeAction && (
        <p className="text-xs text-red-400 mt-1">
          Not enough score points.
        </p>
      )}

      {canPerformFreeAction ? (
        <p className="text-xs text-slate-400 mt-1">
          Max
          {FREE_FORM_ACTION_MAX_LENGTH}

          {' '}
          characters.
        </p>
      ) : null}
    </div>
  );
}

export default FreeActionInput;
