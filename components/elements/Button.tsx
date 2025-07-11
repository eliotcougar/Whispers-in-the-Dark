import { useCallback } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { HighlightableEntity } from '../../utils/highlightHelper';
import { highlightEntitiesInText } from '../../utils/highlightHelper';

export const BUTTON_VARIANTS = [
  'standard',
  'center',
  'compact',
  'toolbar',
  'toolbarLarge',
  'toggle',
  'close',
  'tab',
] as const;

export type ButtonVariant = typeof BUTTON_VARIANTS[number];

export const BUTTON_PRESETS = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;

export type ButtonPreset = typeof BUTTON_PRESETS[number];

export interface ButtonProps {
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
  readonly 'data-action-name'?: string;
  readonly 'data-item-name'?: string;
  readonly 'data-option'?: string;
  readonly 'data-prompt-effect'?: string;
  readonly 'data-node-id'?: string;
  readonly variant?: ButtonVariant;
  readonly preset?: ButtonPreset;
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
  'data-action-name': dataActionName,
  'data-item-name': dataItemName,
  'data-option': dataOption,
  'data-prompt-effect': dataPromptEffect,
  'data-node-id': dataNodeId,
}: ButtonProps) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      onClick(e);
      e.currentTarget.blur();
    },
    [onClick]
  );

  const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-3 py-2 text-base',
    lg: 'px-3 py-3 text-lg',
  };

  const appliedSize =
    variant === 'standard' ||
    variant === 'center' ||
    variant === 'compact'
      ? sizeClasses[size]
      : '';

  const variantClasses: Record<ButtonVariant, string> = {
    standard: 'w-full flex items-center justify-center',
    center: 'w-full flex items-center text-center',
    compact: 'inline-flex items-center justify-center',
    toolbar: 'flex items-center justify-center w-9 h-9 p-2',
    toolbarLarge: 'flex items-center justify-center w-[4.33rem] h-[4.33rem] p-3',
    toggle: 'inline-flex items-center justify-center px-3 py-1 text-xs',
    close: 'animated-frame-close-button',
    tab: 'px-3 py-2 text-sm font-medium transition-colors',
  };

  const presetClasses: Record<ButtonPreset, string> = {
    slate: 'bg-slate-600 hover:bg-slate-500 focus:ring-slate-400',
    gray: 'bg-gray-700 hover:bg-gray-500 focus:ring-gray-400',
    zinc: 'bg-zinc-700 hover:bg-zinc-500 focus:ring-zinc-400',
    neutral: 'bg-neutral-700 hover:bg-neutral-500 focus:ring-neutral-400',
    stone: 'bg-stone-700 hover:bg-stone-500 focus:ring-stone-400',
    red: 'bg-red-700 hover:bg-red-500 focus:ring-red-400',
    orange: 'bg-orange-700 hover:bg-orange-500 focus:ring-orange-400',
    amber: 'bg-amber-700 hover:bg-amber-500 focus:ring-amber-400',
    yellow: 'bg-yellow-700 hover:bg-yellow-500 focus:ring-yellow-400',
    lime: 'bg-lime-700 hover:bg-lime-500 focus:ring-lime-400',
    green: 'bg-green-700 hover:bg-green-500 focus:ring-green-400',
    emerald: 'bg-emerald-700 hover:bg-emerald-500 focus:ring-emerald-400',
    teal: 'bg-teal-700 hover:bg-teal-500 focus:ring-teal-400',
    cyan: 'bg-cyan-700 hover:bg-cyan-500 focus:ring-cyan-400',
    sky: 'bg-sky-700 hover:bg-sky-500 focus:ring-sky-400',
    blue: 'bg-blue-700 hover:bg-blue-500 focus:ring-blue-400',
    indigo: 'bg-indigo-700 hover:bg-indigo-500 focus:ring-indigo-400',
    violet: 'bg-violet-700 hover:bg-violet-500 focus:ring-violet-400',
    purple: 'bg-purple-700 hover:bg-purple-500 focus:ring-purple-400',
    fuchsia: 'bg-fuchsia-700 hover:bg-fuchsia-500 focus:ring-fuchsia-400',
    pink: 'bg-pink-700 hover:bg-pink-500 focus:ring-pink-400',
    rose: 'bg-rose-700 hover:bg-rose-500 focus:ring-rose-400',
  };

  const pressedClasses = (() => {
    if (variant === 'toggle' && pressed) {
      return 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800';
    }
    if (variant === 'tab') {
      return pressed
        ? 'border-b-2 border-sky-400 text-sky-300'
        : 'text-slate-300 hover:text-sky-400 border-b-2 border-transparent';
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
      data-action-name={dataActionName}
      data-item-name={dataItemName}
      data-node-id={dataNodeId}
      data-option={dataOption}
      data-prompt-effect={dataPromptEffect}
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

      {displayLabel ? (
        <span className="flex-1 text-shadow-sm">
          {displayLabel}
        </span>
      ) : null}
    </button>
  );
}

Button.defaultProps = {
  'data-action-name': undefined,
  'data-item-name': undefined,
  'data-node-id': undefined,
  'data-option': undefined,
  'data-prompt-effect': undefined,
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
