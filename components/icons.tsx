/**
 * Provides a single Icon component that renders SVGs from the resources folder.
 */
import realityShift from '../resources/reality_shift.svg?raw';
import coin from '../resources/coin.svg?raw';
import visualize from '../resources/visualize.svg?raw';
import bookOpen from '../resources/book_open.svg?raw';
import menu from '../resources/menu.svg?raw';
import info from '../resources/info.svg?raw';
import scroll from '../resources/scroll.svg?raw';
import map from '../resources/map.svg?raw';
import inventory from '../resources/inventory.svg?raw';
import trash from '../resources/trash.svg?raw';
import log from '../resources/log.svg?raw';
import companion from '../resources/companion.svg?raw';
import nearbyNpc from '../resources/nearby_npc.svg?raw';
import mapItemBox from '../resources/map_item_box.svg?raw';
import mapWheel from '../resources/map_wheel.svg?raw';

const iconMap = {
  realityShift,
  coin,
  visualize,
  bookOpen,
  menu,
  info,
  scroll,
  map,
  inventory,
  trash,
  log,
  companion,
  nearbyNpc,
  mapItemBox,
  mapWheel
} as const;

export type IconName = keyof typeof iconMap;

export interface IconProps {
  readonly name: IconName;
  readonly className?: string;
  readonly size?: number;
}

/**
 * Renders the requested icon.
 */
export function Icon({ name, className = '', size }: IconProps) {
  const svgString = iconMap[name];
  return (
    <span
      className={className}
      style={size ? { width: size, height: size, display: 'inline-block' } : undefined}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
}
