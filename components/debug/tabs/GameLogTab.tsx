import DebugSection from '../DebugSection';

interface GameLogTabProps {
  readonly gameLog: Array<string>;
}

const GameLogTab = ({ gameLog }: GameLogTabProps) => (
  <DebugSection
    content={gameLog}
    maxHeightClass="max-h-[70vh]"
    title="Current Game Log"
  />
);

export default GameLogTab;
