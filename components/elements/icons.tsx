/**
 * Provides a single Icon component that renders SVGs from the icons folder.
*/
import realityShiftSvg from './icons/reality_shift.svg?raw';
import coinSvg from './icons/coin.svg?raw';
import visualizeSvg from './icons/visualize.svg?raw';
import bookOpenSvg from './icons/book_open.svg?raw';
import menuSvg from './icons/menu.svg?raw';
import infoSvg from './icons/info.svg?raw';
import scrollSvg from './icons/scroll.svg?raw';
import mapSvg from './icons/map.svg?raw';
import inventorySvg from './icons/inventory.svg?raw';
import trashSvg from './icons/trash.svg?raw';
import logSvg from './icons/log.svg?raw';
import companionSvg from './icons/companion.svg?raw';
import nearbyNpcSvg from './icons/nearby_npc.svg?raw';
import mapItemBoxSvg from './icons/map_item_box.svg?raw';
import mapWheelSvg from './icons/map_wheel.svg?raw';
import xSvg from './icons/x.svg?raw';

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
  x: xSvg,
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
  const svgMarkup = iconMap[name];

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

  const svgAttrs = (svgClasses ? ` class="${svgClasses}"` : '') +
    (size ? ` width="${String(size)}" height="${String(size)}"` : '');
  const rendered = svgMarkup.replace('<svg', `<svg${svgAttrs}`);

  const style = marginRight ? { marginRight } : undefined;
  const wrapperClasses = inline ? 'inline-block' : undefined;

  if (wrapper === 'g') {
    return (
      <g
        className={wrapperClasses}
        dangerouslySetInnerHTML={{ __html: rendered }}
        style={style}
      />
    );
  }
  return (
    <span
      className={wrapperClasses}
      dangerouslySetInnerHTML={{ __html: rendered }}
      style={style}
    />
  );
}

Icon.defaultProps = {
  color: undefined,
  inline: false,
  marginRight: undefined,
  size: undefined,
  wrapper: 'span',
};
