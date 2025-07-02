import * as React from 'react';
import Button from '../elements/Button';
import { FilterMode } from '../../hooks/useInventoryDisplay';

interface InventoryFilterControlsProps {
  readonly filterMode: FilterMode;
  readonly disabled: boolean;
  readonly onFilterAll: (e: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onFilterStashed: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function InventoryFilterControls({ filterMode, disabled, onFilterAll, onFilterStashed }: InventoryFilterControlsProps) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Button
        ariaLabel="Show All"
        disabled={disabled}
        label="All"
        onClick={onFilterAll}
        preset={filterMode === 'all' ? 'sky' : 'slate'}
        pressed={filterMode === 'all'}
        size="sm"
        variant="toggle"
      />


      <Button
        ariaLabel="Show Stashed"
        disabled={disabled}
        label="Stashed"
        onClick={onFilterStashed}
        preset={filterMode === 'stashed' ? 'sky' : 'slate'}
        pressed={filterMode === 'stashed'}
        size="sm"
        variant="toggle"
      />
    </div>
  );
}

export default InventoryFilterControls;
