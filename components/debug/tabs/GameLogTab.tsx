import DebugSection from '../DebugSection';

interface GameLogTabProps {
  readonly gameLog: Array<string>;
}

function GameLogTab({ gameLog }: GameLogTabProps) {
  return (<DebugSection
    content={gameLog}
    maxHeightClass="max-h-[70vh]"
    title="Current Game Log"
  />)
}

export default GameLogTab;
