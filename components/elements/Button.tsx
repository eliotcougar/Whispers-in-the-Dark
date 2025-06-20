import { useCallback } from 'react';
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import type { HighlightableEntity } from '../../utils/highlightHelper';
import { highlightEntitiesInText } from '../../utils/highlightHelper';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'disabled' | 'type'> {
  readonly ariaLabel: string;
  readonly onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly label?: ReactNode;
  readonly highlightEntities?: Array<HighlightableEntity>;
  readonly enableHighlightTap?: boolean;
  readonly pressed?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly title?: string;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly variant?:
    | 'standard'
    | 'left'
    | 'compact'
    | 'toolbar'
    | 'toggle'
    | 'close'
    | 'tab'
    | 'primary';
  readonly preset?:
    | 'slate'
    | 'gray'
    | 'zinc'
    | 'neutral'
    | 'stone'
    | 'red'
    | 'orange'
    | 'amber'
    | 'yellow'
    | 'lime'
    | 'green'
    | 'emerald'
    | 'teal'
    | 'cyan'
    | 'sky'
    | 'blue'
    | 'indigo'
    | 'violet'
    | 'purple'
    | 'fuchsia'
    | 'pink'
    | 'rose';
}

function Button({
  ariaLabel,
  onClick,
  disabled = false,
  icon,
  label,
  highlightEntities,
  enableHighlightTap = false,
  pressed = false,
  size = 'md',
  title,
  type = 'button',
  variant = 'standard',
  preset,
  ...rest
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

  const appliedSize =
    variant === 'standard' || variant === 'compact' || variant === 'primary'
      ? sizeClasses[size]
      : '';

  const variantClasses: Record<
    'standard' | 'left' | 'compact' | 'toolbar' | 'toggle' | 'close' | 'tab' | 'primary',
    string
  > = {
    standard: 'w-full flex items-center justify-center',
    left: 'w-full flex items-start justify-start text-left',
    compact: 'inline-flex items-center justify-center',
    toolbar: 'flex items-center justify-center w-9 h-9 p-2',
    toggle: 'inline-flex items-center justify-center px-3 py-1 text-xs',
    close: 'animated-frame-close-button',
    tab: 'px-3 py-2 text-sm font-medium transition-colors',
    primary: 'w-full flex items-center justify-center',
  };

  const presetClasses: Record<NonNullable<ButtonProps['preset']>, string> = {
    slate: 'bg-slate-600 hover:bg-slate-500 focus:ring-slate-400',
    gray: 'bg-gray-600 hover:bg-gray-500 focus:ring-gray-400',
    zinc: 'bg-zinc-600 hover:bg-zinc-500 focus:ring-zinc-400',
    neutral: 'bg-neutral-600 hover:bg-neutral-500 focus:ring-neutral-400',
    stone: 'bg-stone-600 hover:bg-stone-500 focus:ring-stone-400',
    red: 'bg-red-600 hover:bg-red-500 focus:ring-red-400',
    orange: 'bg-orange-600 hover:bg-orange-500 focus:ring-orange-400',
    amber: 'bg-amber-600 hover:bg-amber-500 focus:ring-amber-400',
    yellow: 'bg-yellow-600 hover:bg-yellow-500 focus:ring-yellow-400',
    lime: 'bg-lime-600 hover:bg-lime-500 focus:ring-lime-400',
    green: 'bg-green-600 hover:bg-green-500 focus:ring-green-400',
    emerald: 'bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-400',
    teal: 'bg-teal-600 hover:bg-teal-500 focus:ring-teal-400',
    cyan: 'bg-cyan-600 hover:bg-cyan-500 focus:ring-cyan-400',
    sky: 'bg-sky-600 hover:bg-sky-500 focus:ring-sky-400',
    blue: 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-400',
    indigo: 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-400',
    violet: 'bg-violet-600 hover:bg-violet-500 focus:ring-violet-400',
    purple: 'bg-purple-600 hover:bg-purple-500 focus:ring-purple-400',
    fuchsia: 'bg-fuchsia-600 hover:bg-fuchsia-500 focus:ring-fuchsia-400',
    pink: 'bg-pink-600 hover:bg-pink-500 focus:ring-pink-400',
    rose: 'bg-rose-600 hover:bg-rose-500 focus:ring-rose-400',
  };

  const pressedClasses = (() => {
    if (variant === 'toggle' && pressed) {
      return 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800';
    }
    if (variant === 'tab') {
      return pressed
        ? 'border-b-2 border-sky-400 text-sky-300'
        : 'text-slate-400 hover:text-sky-400 border-b-2 border-transparent';
    }
    return '';
  })();

  const displayLabel =
    highlightEntities && typeof label === 'string'
      ? highlightEntitiesInText(label, highlightEntities, enableHighlightTap)
      : label;

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={variant === 'toggle' ? pressed : undefined}
      className={`rounded-md shadow transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${appliedSize} ${variantClasses[variant]} ${preset ? presetClasses[preset] : ''} ${pressedClasses}`}
      disabled={disabled}
      onClick={handleClick}
      title={title}
      type={type === 'submit' ? 'submit' : type === 'reset' ? 'reset' : 'button'}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...rest}
    >
      {icon ? (
        <span className={label ? 'mr-2 inline-flex' : 'inline-flex'}>
          {icon}
        </span>
      ) : null}

      {displayLabel}
    </button>
  );
}

Button.defaultProps = {
  disabled: false,
  enableHighlightTap: false,
  highlightEntities: undefined,
  icon: undefined,
  label: undefined,
  preset: undefined,
  pressed: false,
  size: 'md',
  title: undefined,
  type: 'button',
  variant: 'standard',
};

export default Button;
