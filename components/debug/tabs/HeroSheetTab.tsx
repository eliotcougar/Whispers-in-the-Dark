import DebugSection from '../DebugSection';
import type { HeroSheet, HeroBackstory } from '../../../types';

interface HeroSheetTabProps {
  readonly heroSheet: HeroSheet | null;
  readonly heroBackstory: HeroBackstory | null;
}

function HeroSheetTab({ heroSheet, heroBackstory }: HeroSheetTabProps) {
  return (
    <>
      <DebugSection
        content={heroSheet ?? 'Hero sheet data is unavailable.'}
        title="Hero Sheet"
      />
      <DebugSection
        content={heroBackstory ?? 'Hero backstory data is unavailable.'}
        title="Hero Backstory"
      />
    </>
  );
}

export default HeroSheetTab;
