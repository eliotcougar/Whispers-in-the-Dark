import { useCallback } from 'react';
import type { ReactNode, MouseEvent } from 'react';

export interface ButtonProps {
  readonly ariaLabel: string;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly label?: ReactNode;
  readonly pressed?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly title?: string;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly variant?: 'standard' | 'toolbar' | 'toggle' | 'primary' | 'danger';
}

function Button({
  ariaLabel,
  onClick,
  className = '',
  disabled = false,
  icon,
  label,
  pressed = false,
  size = 'md',
  title,
  type = 'button',
  variant = 'standard',
}: ButtonProps) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      onClick(e);
      e.currentTarget.blur();
    },
    [onClick]
  );

  const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses: Record<'standard' | 'toolbar' | 'toggle' | 'primary' | 'danger', string> = {
    standard: '',
    toolbar: 'flex items-center justify-center w-9 h-9 p-2',
    toggle: 'px-3 py-1.5 text-xs',
    primary: 'w-full text-white font-medium bg-sky-700 hover:bg-sky-600 disabled:bg-slate-500 disabled:text-slate-400 flex items-center justify-center transition-colors duration-150 ease-in-out',
    danger: 'w-full text-white font-medium bg-orange-700 hover:bg-orange-600 disabled:bg-slate-500 disabled:text-slate-400 flex items-center justify-center transition-colors duration-150 ease-in-out',
  };

  const pressedClasses = variant === 'toggle' && pressed ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800' : '';

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={variant === 'toggle' ? pressed : undefined}
      className={`rounded shadow transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]} ${pressedClasses} ${className}`}
      disabled={disabled}
      onClick={handleClick}
      title={title}
      type={type === 'submit' ? 'submit' : type === 'reset' ? 'reset' : 'button'}
    >
      {icon ? (
        <span className={label ? 'mr-2 inline-flex' : 'inline-flex'}>
          {icon}
        </span>
      ) : null}

      {label}
    </button>
  );
}

Button.defaultProps = {
  className: '',
  disabled: false,
  icon: undefined,
  label: undefined,
  pressed: false,
  size: 'md',
  title: undefined,
  type: 'button',
  variant: 'standard',
};

export default Button;
