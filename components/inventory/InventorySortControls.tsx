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
        disabled={disabled}
        label="Sort by Name"
        onClick={onSortByName}
        preset={sortOrder === 'name' ? 'sky' : 'slate'}
        pressed={sortOrder === 'name'}
        size="sm"
        variant="toggle"
      />

      <Button
        ariaLabel="Sort by Type"
        disabled={disabled}
        label="Sort by Type"
        onClick={onSortByType}
        preset={sortOrder === 'type' ? 'sky' : 'slate'}
        pressed={sortOrder === 'type'}
        size="sm"
        variant="toggle"
      />
    </div>
  );
}

export default InventorySortControls;
