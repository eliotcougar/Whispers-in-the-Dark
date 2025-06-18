/**
 * Provides a single Icon component that renders SVGs from the resources folder.
 */
import realityShiftSvg from '../resources/reality_shift.svg?raw';
import coinSvg from '../resources/coin.svg?raw';
import visualizeSvg from '../resources/visualize.svg?raw';
import bookOpenSvg from '../resources/book_open.svg?raw';
import menuSvg from '../resources/menu.svg?raw';
import infoSvg from '../resources/info.svg?raw';
import scrollSvg from '../resources/scroll.svg?raw';
import mapSvg from '../resources/map.svg?raw';
import inventorySvg from '../resources/inventory.svg?raw';
import trashSvg from '../resources/trash.svg?raw';
import logSvg from '../resources/log.svg?raw';
import companionSvg from '../resources/companion.svg?raw';
import nearbyNpcSvg from '../resources/nearby_npc.svg?raw';
import mapItemBoxSvg from '../resources/map_item_box.svg?raw';
import mapWheelSvg from '../resources/map_wheel.svg?raw';

/* eslint-disable react/no-danger */

const iconMap = {
  realityShift: realityShiftSvg,
  coin: coinSvg,
  visualize: visualizeSvg,
  bookOpen: bookOpenSvg,
  menu: menuSvg,
  info: infoSvg,
  scroll: scrollSvg,
  map: mapSvg,
  inventory: inventorySvg,
  trash: trashSvg,
  log: logSvg,
  companion: companionSvg,
  nearbyNpc: nearbyNpcSvg,
  mapItemBox: mapItemBoxSvg,
  mapWheel: mapWheelSvg,
} as const;

export type IconName = keyof typeof iconMap;

export interface IconProps {
  readonly name: IconName;
  readonly className?: string;
  readonly size?: number;
  readonly wrapper?: 'span' | 'g';
}

/**
 * Renders the requested icon.
 */
export function Icon({ name, className = '', size, wrapper = 'span' }: IconProps) {
  const svgMarkup = iconMap[name];
  const attrs = (className ? ` class="${className}"` : '') +
    (size ? ` width="${size}" height="${size}"` : '');
  const rendered = svgMarkup.replace('<svg', `<svg${attrs}`);
  if (wrapper === 'g') {
    return <g dangerouslySetInnerHTML={{ __html: rendered }} />;
  }
  return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
}

Icon.defaultProps = {
  className: '',
  size: undefined,
  wrapper: 'span',
};
