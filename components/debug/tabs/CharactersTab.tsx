import DebugSection from '../DebugSection';
import type { Character } from '../../../types';

interface CharactersTabProps {
  readonly characters: Array<Character>;
}

function CharactersTab({ characters }: CharactersTabProps) {
  return (<DebugSection
    content={characters}
    maxHeightClass="max-h-[70vh]"
    title="Current Characters"
  />)
}

export default CharactersTab;
