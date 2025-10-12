import DebugSection from '../DebugSection';
import type { StoryArc } from '../../../types';

interface StoryArcTabProps {
  readonly storyArc: StoryArc | null;
}

function StoryArcTab({ storyArc }: StoryArcTabProps) {
  return (
    <DebugSection
      content={storyArc ?? 'Story arc data is unavailable.'}
      maxHeightClass="max-h-[70vh]"
      title="Story Arc"
    />
  );
}

export default StoryArcTab;
