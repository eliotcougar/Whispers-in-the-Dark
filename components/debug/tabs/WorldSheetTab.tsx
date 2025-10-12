import DebugSection from '../DebugSection';
import type { WorldSheet } from '../../../types';

interface WorldSheetTabProps {
  readonly worldSheet: WorldSheet | null;
}

function WorldSheetTab({ worldSheet }: WorldSheetTabProps) {
  return (
    <DebugSection
      content={worldSheet ?? 'World sheet data is unavailable.'}
      maxHeightClass="max-h-[70vh]"
      title="World Sheet"
    />
  );
}

export default WorldSheetTab;
