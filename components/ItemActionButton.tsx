import { useCallback } from 'react';
import * as React from 'react';

interface ItemActionButtonProps {
  readonly label: React.ReactNode;
  readonly onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly disabled: boolean;
  readonly ariaLabel: string;
  readonly className: string;
  readonly dataItemName: string;
}

/**
 * Button used for item actions like drop, discard or park.
 * Applies shared styling and ensures blur after click.
 */
function ItemActionButton({
  label,
  onClick,
  disabled = false,
  ariaLabel,
  className = '',
  dataItemName = '',
}: ItemActionButtonProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick(event);
      event.currentTarget.blur();
    },
    [onClick]
  );

  return (
    <button
      aria-label={ariaLabel}
      className={`w-full text-sm text-white font-medium py-1.5 px-3 rounded shadow disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center ${className}`}
      data-item-name={dataItemName}
      disabled={disabled}
      onClick={handleClick}
    >
      {label}
    </button>
  );
}

export default ItemActionButton;
