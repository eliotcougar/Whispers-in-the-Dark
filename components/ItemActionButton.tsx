import React from 'react';

interface ItemActionButtonProps {
  label: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

/**
 * Button used for item actions like drop, discard or park.
 * Applies shared styling and ensures blur after click.
 */
const ItemActionButton: React.FC<ItemActionButtonProps> = ({
  label,
  onClick,
  disabled = false,
  ariaLabel,
  className = '',
}) => {
  return (
    <button
      onClick={(event) => {
        onClick(event);
        event.currentTarget.blur();
      }}
      disabled={disabled}
      className={`w-full text-sm text-white font-medium py-1.5 px-3 rounded shadow disabled:bg-slate-500 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex items-center justify-center ${className}`}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
};

export default ItemActionButton;
