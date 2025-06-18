import { useCallback } from 'react';
import * as React from 'react';

type ButtonVariant = 'primary' | 'danger';

interface ItemActionButtonProps {
  readonly label: React.ReactNode;
  readonly onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly disabled: boolean;
  readonly ariaLabel: string;
  readonly dataItemName: string;
  readonly variant?: ButtonVariant;
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
  dataItemName = '',
  variant,
}: ItemActionButtonProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick(event);
      event.currentTarget.blur();
    },
    [onClick]
  );

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-sky-700 hover:bg-sky-600',
    danger: 'bg-orange-700 hover:bg-orange-600',
  };

  const selectedVariant: ButtonVariant = variant ?? 'primary';

  return (
    <button
      aria-label={ariaLabel}
      className={`w-full text-sm text-white font-medium py-1.5 px-3 rounded shadow disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center ${variantClasses[selectedVariant]}`}
      data-item-name={dataItemName}
      disabled={disabled}
      onClick={handleClick}
      type="button"
    >
      {label}
    </button>
  );
}

ItemActionButton.defaultProps = {
  variant: 'primary',
};

export default ItemActionButton;
