import { createElement } from 'react';
import type { ElementType, ReactNode } from 'react';

export interface HeadingTagProps {
  readonly tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  readonly children?: ReactNode;
  readonly icon?: ReactNode;
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
  readonly font?: 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

function HeadingTag({
  tag = 'h2',
  children,
  icon,
  preset = 'amber',
  font = '2xl',
}: HeadingTagProps) {
  const Tag: ElementType = tag;

  const presetClasses: Record<NonNullable<HeadingTagProps['preset']>, string> = {
    slate: 'text-slate-300',
    gray: 'text-gray-400',
    zinc: 'text-zinc-400',
    neutral: 'text-neutral-400',
    stone: 'text-stone-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    yellow: 'text-yellow-400',
    lime: 'text-lime-400',
    green: 'text-green-400',
    emerald: 'text-emerald-400',
    teal: 'text-teal-400',
    cyan: 'text-cyan-400',
    sky: 'text-sky-400',
    blue: 'text-blue-400',
    indigo: 'text-indigo-400',
    violet: 'text-violet-400',
    purple: 'text-purple-400',
    fuchsia: 'text-fuchsia-400',
    pink: 'text-pink-400',
    rose: 'text-rose-400',
  };

  const fontClasses: Record<NonNullable<HeadingTagProps['font']>, string> = {
    sm: 'text-sm font-semibold',
    base: 'text-base font-semibold',
    lg: 'text-lg font-semibold',
    xl: 'text-xl font-semibold',
    '2xl': 'text-2xl font-semibold',
    '3xl': 'text-3xl font-semibold',
    '4xl': 'text-4xl font-semibold',
  };

  const iconElement = icon ? (
    <span className="mr-2 inline-flex">
      {icon}
    </span>
  ) : null;

  return createElement(
    Tag,
    {
      className: `${fontClasses[font]} ${presetClasses[preset]}`,
    },
    iconElement,
    children
  );
}

HeadingTag.defaultProps = {
  children: undefined,
  font: '2xl',
  icon: undefined,
  preset: 'amber',
  tag: 'h2',
};

export default HeadingTag;
