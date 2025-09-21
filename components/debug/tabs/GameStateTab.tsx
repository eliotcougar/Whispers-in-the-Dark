import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { FullGameState } from '../../../types';
import { safeParseJson } from '../../../utils/jsonUtils';
import {
  cloneGameStateWithoutImages,
  structuredCloneGameState,
} from '../../../utils/cloneUtils';

interface GameStateTabProps {
  readonly currentState: FullGameState;
  readonly onUndoTurn: () => void;
  readonly onApplyGameState: (state: FullGameState) => void;
  readonly previousState?: FullGameState;
}

function GameStateTab({ currentState, onUndoTurn, onApplyGameState, previousState = undefined }: GameStateTabProps) {
  const [editableText, setEditableText] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);

  const sanitizedCurrentState = useMemo(() => {
    const sanitized = cloneGameStateWithoutImages(currentState);
    delete (sanitized as Partial<FullGameState>).lastDebugPacket;
    return sanitized;
  }, [currentState]);

  const sanitizedPreviousState = useMemo(() => {
    if (!previousState) return undefined;
    const sanitized = cloneGameStateWithoutImages(previousState);
    delete (sanitized as Partial<FullGameState>).lastDebugPacket;
    return sanitized;
  }, [previousState]);

  useEffect(() => {
    setEditableText(JSON.stringify(sanitizedCurrentState, null, 2));
  }, [sanitizedCurrentState]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditableText(e.target.value);
      setParseError(null);
    },
    [],
  );

  const handleApply = useCallback(() => {
    const parsed = safeParseJson<FullGameState>(editableText);
    if (parsed) {
      const merged = structuredCloneGameState(parsed);

      merged.inventory = merged.inventory.map(item => {
        const orig = currentState.inventory.find(i => i.id === item.id);
        if (orig) {
          return {
            ...item,
            chapters: item.chapters?.map((ch, i) => ({
              ...ch,
              imageData: orig.chapters?.[i]?.imageData,
            })),
          };
        }
        return item;
      });

      merged.playerJournal = merged.playerJournal.map((ch, i) => ({
        ...ch,
        imageData: currentState.playerJournal[i]?.imageData,
      }));

      onApplyGameState(merged);
      setParseError(null);
    } else {
      setParseError('Invalid JSON');
    }
  }, [editableText, onApplyGameState, currentState]);

  return (
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

      <div className="my-2">
        <label
          className="block text-sm text-amber-300 mb-1"
          htmlFor="gameStateEdit"
        >
          Edit Game State
        </label>

        <textarea
          className="w-full p-2 bg-slate-900 text-white border border-slate-600 rounded-md text-sm min-h-[40em] font-mono"
          id="gameStateEdit"
          onChange={handleChange}
          value={editableText}
        />

        <Button
          ariaLabel="Verify and apply edited game state"
          label="Verify & Apply"
          onClick={handleApply}
          preset="green"
          size="sm"
          variant="compact"
        />

        {parseError ? (
          <p className="text-red-400 text-xs mt-1">
            {parseError}
          </p>
      ) : null}
      </div>

      <DebugSection
        content={sanitizedCurrentState}
        maxHeightClass="max-h-[30vh]"
        title="Current Game State (Stack[0] - Top)"
      />

      {sanitizedPreviousState ? (
        <DebugSection
          content={sanitizedPreviousState}
          maxHeightClass="max-h-[30vh]"
          title="Previous Game State (Stack[1] - Bottom)"
        />
    ) : null}
    </>
  );
}

GameStateTab.defaultProps = { previousState: undefined };

export default GameStateTab;
