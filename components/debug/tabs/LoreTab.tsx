import DebugSection from '../DebugSection';
import type { ThemeFact } from '../../../types';

interface LoreTabProps {
  readonly themeFacts: Array<ThemeFact>;
}

function LoreTab({ themeFacts }: LoreTabProps) {
  return (
    <DebugSection
      content={themeFacts}
      maxHeightClass="max-h-[70vh]"
      title="Current Theme Lore"
    />
  );
}

export default LoreTab;
