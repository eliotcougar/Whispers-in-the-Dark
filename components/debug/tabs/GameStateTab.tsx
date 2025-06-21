import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { FullGameState } from '../../../types';

interface GameStateTabProps {
  readonly currentState: FullGameState;
  readonly onUndoTurn: () => void;
  readonly previousState?: FullGameState;
}

const GameStateTab = ({ currentState, onUndoTurn, previousState = undefined }: GameStateTabProps) => (
  <>
    <Button
      ariaLabel="Undo last turn"
      disabled={!previousState || currentState.globalTurnNumber <= 1}
      label={`Undo Turn (Global Turn: ${String(currentState.globalTurnNumber)})`}
      onClick={onUndoTurn}
      preset="orange"
      size="sm"
      variant="compact"
    />

    <DebugSection
      content={currentState}
      maxHeightClass="max-h-[30vh]"
      title="Current Game State (Stack[0] - Top)"
    />

    {previousState ? (
      <DebugSection
        content={previousState}
        maxHeightClass="max-h-[30vh]"
        title="Previous Game State (Stack[1] - Bottom)"
      />
    ) : null}
  </>
);

GameStateTab.defaultProps = { previousState: undefined };

export default GameStateTab;
