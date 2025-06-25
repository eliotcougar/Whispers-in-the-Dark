import DebugSection from '../DebugSection';
import type { NPC } from '../../../types';

interface NPCsTabProps {
  readonly npcs: Array<NPC>;
}

function NPCsTab({ npcs: npcs }: NPCsTabProps) {
  return (
    <DebugSection
      content={npcs}
      maxHeightClass="max-h-[70vh]"
      title="Current NPCs"
    />
  );
}

export default NPCsTab;
