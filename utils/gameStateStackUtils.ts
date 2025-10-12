import type {
  FullGameState,
  GameStateStack,
  DebugPacket,
  GameTurnState,
} from '../types';

const DIALOGUE_PHASE_STATES: ReadonlySet<GameTurnState> = new Set([
  'dialogue_turn',
  'dialogue_memory',
  'dialogue_summary',
]);

const isDialogueStackState = (state?: FullGameState): boolean => {
  if (!state) return false;
  if (state.dialogueState) return true;
  return state.turnState ? DIALOGUE_PHASE_STATES.has(state.turnState) : false;
};

export const selectFallbackGameStateForTurn = (
  current: FullGameState,
  previous: FullGameState | undefined,
): FullGameState => {
  if (!isDialogueStackState(current) && current.turnState === 'awaiting_input') {
    return current;
  }
  if (previous && !isDialogueStackState(previous) && previous.turnState === 'awaiting_input') {
    return previous;
  }
  if (previous && !isDialogueStackState(previous)) {
    return previous;
  }
  if (!isDialogueStackState(current)) {
    return current;
  }
  return previous ?? current;
};

export interface CommitStackResolution {
  nextStack: GameStateStack;
  fallbackDebugForAwaiting: DebugPacket | null;
  dialogueFallbackDebug: DebugPacket | null;
  preserveDialogueFallback: boolean;
}

export const resolveNextStackForCommit = (
  sanitized: FullGameState,
  prevCurrent: FullGameState,
  prevPrevious: FullGameState | undefined,
): CommitStackResolution => {
  const sanitizedIsDialogue = isDialogueStackState(sanitized);

  if (!sanitizedIsDialogue && sanitized.turnState === 'awaiting_input') {
    const fallbackPrevState = selectFallbackGameStateForTurn(prevCurrent, prevPrevious);
    return {
      nextStack: [sanitized, fallbackPrevState],
      fallbackDebugForAwaiting: fallbackPrevState.lastDebugPacket ?? null,
      dialogueFallbackDebug: null,
      preserveDialogueFallback: false,
    };
  }

  if (sanitizedIsDialogue) {
    const fallbackPrevState = selectFallbackGameStateForTurn(prevCurrent, prevPrevious);
    return {
      nextStack: [sanitized, fallbackPrevState],
      fallbackDebugForAwaiting: null,
      dialogueFallbackDebug: fallbackPrevState.lastDebugPacket ?? null,
      preserveDialogueFallback: true,
    };
  }

  const fallbackPrevState = selectFallbackGameStateForTurn(prevCurrent, prevPrevious);
  return {
    nextStack: [sanitized, fallbackPrevState],
    fallbackDebugForAwaiting: null,
    dialogueFallbackDebug: null,
    preserveDialogueFallback: false,
  };
};
