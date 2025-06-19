/**
 * Provides a single Icon component that renders SVGs from the icons folder.
*/
import RealityShiftIcon from './icons/reality_shift.svg?react';
import CoinIcon from './icons/coin.svg?react';
import VisualizeIcon from './icons/visualize.svg?react';
import BookOpenIcon from './icons/book_open.svg?react';
import MenuIcon from './icons/menu.svg?react';
import InfoIcon from './icons/info.svg?react';
import ScrollIcon from './icons/scroll.svg?react';
import MapIcon from './icons/map.svg?react';
import InventoryIcon from './icons/inventory.svg?react';
import TrashIcon from './icons/trash.svg?react';
import LogIcon from './icons/log.svg?react';
import CompanionIcon from './icons/companion.svg?react';
import NearbyNpcIcon from './icons/nearby_npc.svg?react';
import MapItemBoxIcon from './icons/map_item_box.svg?react';
import MapWheelIcon from './icons/map_wheel.svg?react';
import XIcon from './icons/x.svg?react';

const iconMap = {
  realityShift: RealityShiftIcon,
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
  x: XIcon,
} as const;

export type IconName = keyof typeof iconMap;

export type IconColor =
  | 'amber'
  | 'emerald'
  | 'green'
  | 'white'
  | 'sky'
  | 'indigo';

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
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    green: 'text-green-400',
    white: 'text-white',
    sky: 'text-sky-400',
    indigo: 'text-indigo-400',
  };

  const svgClasses = [color ? colorClasses[color] : '']
    .filter(Boolean)
    .join(' ');

  const style = marginRight ? { marginRight } : undefined;
  const wrapperClasses = inline ? 'inline-block' : undefined;

  if (wrapper === 'g') {
    return (
      <g
        className={wrapperClasses}
        style={style}
      >
        <SvgIcon
          className={svgClasses}
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
        className={svgClasses}
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
