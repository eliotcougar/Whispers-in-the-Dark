import DebugSection from '../DebugSection';
import type { Character } from '../../../types';

interface CharactersTabProps {
  readonly characters: Array<Character>;
}

const CharactersTab = ({ characters }: CharactersTabProps) => (
  <DebugSection
    content={characters}
    maxHeightClass="max-h-[70vh]"
    title="Current Characters"
  />
);

export default CharactersTab;
