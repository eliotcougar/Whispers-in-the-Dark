/**
 * @file ItemTypeDisplay.tsx
 * @description Displays the item type label with theme-based coloring.
 */
import * as React from 'react';
import { Item } from '../../types';

export interface ItemTypeDisplayProps {
  readonly type: Item['type'];
}

export function ItemTypeDisplay({ type }: ItemTypeDisplayProps): React.ReactElement {
  const colorMap: Record<Item['type'], string> = {
    'single-use': 'text-red-400',
    'multi-use': 'text-yellow-400',
    equipment: 'text-sky-400',
    container: 'text-orange-400',
    key: 'text-lime-400',
    weapon: 'text-amber-400',
    ammunition: 'text-cyan-400',
    vehicle: 'text-indigo-400',
    knowledge: 'text-purple-400',
    'status effect': 'text-pink-400',
    page: 'text-green-400',
    book: 'text-green-400',
  };

  const color = colorMap[type];

  return (
    <span className={`text-xs italic ${color}`}>
      {type}
    </span>
  );
}

export default ItemTypeDisplay;
