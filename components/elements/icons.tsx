/**
 * Provides a single Icon component that renders SVGs from the icons folder.
*/
import CoinIcon from './icons/Coin';
import VisualizeIcon from './icons/Visualize';
import BookOpenIcon from './icons/BookOpen';
import MenuIcon from './icons/Menu';
import InfoIcon from './icons/Info';
import ScrollIcon from './icons/Scroll';
import MapIcon from './icons/Map';
import InventoryIcon from './icons/Inventory';
import TrashIcon from './icons/Trash';
import LogIcon from './icons/Log';
import CompanionIcon from './icons/Companion';
import NearbyNpcIcon from './icons/NearbyNpc';
import MapItemBoxIcon from './icons/MapItemBox';
import MapWheelIcon from './icons/MapWheel';
import XIcon from './icons/X';
import ClockIcon from './icons/Clock';
import ErrorIcon from './icons/Error';
import JournalPenIcon from './icons/JournalPen';

const iconMap = {
  coin: CoinIcon,
  visualize: VisualizeIcon,
  bookOpen: BookOpenIcon,
  menu: MenuIcon,
  info: InfoIcon,
  scroll: ScrollIcon,
  map: MapIcon,
  inventory: InventoryIcon,
  trash: TrashIcon,
  log: LogIcon,
  companion: CompanionIcon,
  nearbyNpc: NearbyNpcIcon,
  mapItemBox: MapItemBoxIcon,
  mapWheel: MapWheelIcon,
  clock: ClockIcon,
  error: ErrorIcon,
  x: XIcon,
  journalPen: JournalPenIcon,
} as const;

export type IconName = keyof typeof iconMap;

export const ICON_NAMES = Object.keys(iconMap) as Array<IconName>;

export type IconColor =
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
  | 'rose'
  | 'white';

export interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly color?: IconColor;
  readonly inline?: boolean;
  readonly marginRight?: number;
  readonly wrapper?: 'span' | 'g';
}

/**
 * Renders the requested icon.
 */
export function Icon({
  name,
  size,
  color,
  inline = false,
  marginRight,
  wrapper = 'span',
}: IconProps) {
  const SvgIcon = iconMap[name];

  const colorClasses: Record<IconColor, string> = {
    slate: 'text-slate-400',
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
    white: 'text-white',
  };

  const wrapperClasses = [
    inline ? 'inline-block' : '',
    color ? colorClasses[color] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = marginRight ? { marginRight } : undefined;

  if (wrapper === 'g') {
    return (
      <g
        className={wrapperClasses}
        style={style}
      >
        <SvgIcon
          height={size}
          width={size}
        />
      </g>
    );
  }
  return (
    <span
      className={wrapperClasses}
      style={style}
    >
      <SvgIcon
        height={size}
        width={size}
      />
    </span>
  );
}

Icon.defaultProps = {
  color: undefined,
  inline: false,
  marginRight: undefined,
  size: undefined,
  wrapper: 'span',
};
