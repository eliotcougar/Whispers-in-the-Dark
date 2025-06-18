/**
 * Provides a single Icon component that renders SVGs from the resources folder.
 */
import RealityShiftIcon from '../resources/reality_shift.svg?react';
import CoinIcon from '../resources/coin.svg?react';
import VisualizeIcon from '../resources/visualize.svg?react';
import BookOpenIcon from '../resources/book_open.svg?react';
import MenuIcon from '../resources/menu.svg?react';
import InfoIcon from '../resources/info.svg?react';
import ScrollIcon from '../resources/scroll.svg?react';
import MapIcon from '../resources/map.svg?react';
import InventoryIcon from '../resources/inventory.svg?react';
import TrashIcon from '../resources/trash.svg?react';
import LogIcon from '../resources/log.svg?react';
import CompanionIcon from '../resources/companion.svg?react';
import NearbyNpcIcon from '../resources/nearby_npc.svg?react';
import MapItemBoxIcon from '../resources/map_item_box.svg?react';
import MapWheelIcon from '../resources/map_wheel.svg?react';

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
export function Icon({ name, className, size }: IconProps) {
  const SvgIcon = iconMap[name];
  return <SvgIcon className={className} width={size} height={size} />;
}
