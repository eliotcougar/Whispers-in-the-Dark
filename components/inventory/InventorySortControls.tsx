import * as React from 'react';
import Button from '../elements/Button';
import { SortOrder } from '../../hooks/useInventoryDisplay';

interface InventorySortControlsProps {
  readonly sortOrder: SortOrder;
  readonly disabled: boolean;
  readonly onSortByName: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onSortByType: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function InventorySortControls({ sortOrder, disabled, onSortByName, onSortByType }: InventorySortControlsProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Button
        ariaLabel="Sort by Name"
        className={`${sortOrder === 'name' ? 'bg-sky-600 text-white hover:bg-sky-500 ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'} disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:ring-0`}
        disabled={disabled}
        label="Sort by Name"
        onClick={onSortByName}
        pressed={sortOrder === 'name'}
        size="sm"
        variant="toggle"
      />

      <Button
        ariaLabel="Sort by Type"
        className={`${sortOrder === 'type' ? 'bg-sky-600 text-white hover:bg-sky-500 ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-800' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'} disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed disabled:ring-0`}
        disabled={disabled}
        label="Sort by Type"
        onClick={onSortByType}
        pressed={sortOrder === 'type'}
        size="sm"
        variant="toggle"
      />
    </div>
  );
}

export default InventorySortControls;
