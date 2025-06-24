import * as React from 'react';
import Button from '../elements/Button';
import { FilterMode } from '../../hooks/useInventoryDisplay';

interface InventoryFilterControlsProps {
  readonly filterMode: FilterMode;
  readonly disabled: boolean;
  readonly onFilterAll: (e: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onFilterKnowledge: (e: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onFilterArchived: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function InventoryFilterControls({ filterMode, disabled, onFilterAll, onFilterKnowledge, onFilterArchived }: InventoryFilterControlsProps) {
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
        ariaLabel="Show Knowledge"
        disabled={disabled}
        label="Knowledge"
        onClick={onFilterKnowledge}
        preset={filterMode === 'knowledge' ? 'sky' : 'slate'}
        pressed={filterMode === 'knowledge'}
        size="sm"
        variant="toggle"
      />

      <Button
        ariaLabel="Show Archived"
        disabled={disabled}
        label="Archived"
        onClick={onFilterArchived}
        preset={filterMode === 'archived' ? 'sky' : 'slate'}
        pressed={filterMode === 'archived'}
        size="sm"
        variant="toggle"
      />
    </div>
  );
}

export default InventoryFilterControls;
