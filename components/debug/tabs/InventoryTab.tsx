import DebugSection from '../DebugSection';
import type { Item } from '../../../types';

interface InventoryTabProps {
  readonly inventory: Array<Item>;
}

function InventoryTab({ inventory }: InventoryTabProps) {
  return (<DebugSection
    content={inventory}
    maxHeightClass="max-h-[70vh]"
    title="Current Inventory"
  />)
}

export default InventoryTab;
