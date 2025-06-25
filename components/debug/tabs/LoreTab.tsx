import DebugSection from '../DebugSection';
import type { ThemeFact } from '../../../types';

interface LoreTabProps {
  readonly themeFacts: Array<ThemeFact>;
}

function LoreTab({ themeFacts }: LoreTabProps) {
  const formatted = [...themeFacts]
    .sort((a, b) => (b.tier - a.tier) || (b.createdTurn - a.createdTurn))
    .map(
      (fact, idx) => `${String(idx + 1)}. (Tier ${String(fact.tier)}) ${fact.text}`,
    )
    .join('\n');

  return (
    <DebugSection
      content={formatted}
      isJson={false}
      maxHeightClass="max-h-[70vh]"
      title="Current Theme Lore"
    />
  );
}

export default LoreTab;
