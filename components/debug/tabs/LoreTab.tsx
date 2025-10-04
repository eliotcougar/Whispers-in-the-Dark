import DebugSection from '../DebugSection';
import type { LoreFact } from '../../../types';

interface LoreTabProps {
  readonly loreFacts: Array<LoreFact>;
}

function LoreTab({ loreFacts }: LoreTabProps) {
  const formatted = [...loreFacts]
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
      title="Current Lore"
    />
  );
}

export default LoreTab;
