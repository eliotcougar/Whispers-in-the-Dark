import { describe, it, expect } from 'vitest';
import {
  selectFallbackGameStateForTurn,
  resolveNextStackForCommit,
} from '../utils/gameStateStackUtils';
import { getInitialGameStates } from '../utils/initialStates';
import { structuredCloneGameState } from '../utils/cloneUtils';
import type { DebugPacket, FullGameState, GameStateStack } from '../types';

const makeDebugPacket = (label: string): DebugPacket => ({
  prompt: label,
  rawResponseText: null,
  parsedResponse: null,
  timestamp: new Date().toISOString(),
  storytellerThoughts: null,
  mapUpdateDebugInfo: null,
  inventoryDebugInfo: null,
  librarianDebugInfo: null,
  loremasterDebugInfo: null,
  dialogueDebugInfo: null,
});

const cloneWithTurnState = (state: FullGameState, turnState: FullGameState['turnState']) => {
  const cloned = structuredCloneGameState(state);
  cloned.turnState = turnState;
  return cloned;
};

describe('resolveNextStackForCommit', () => {
  it('retains the last awaiting_input snapshot through non-dialogue pipeline states', () => {
    const awaiting = getInitialGameStates();
    awaiting.turnState = 'awaiting_input';

    const loremasterCollect = cloneWithTurnState(awaiting, 'loremaster_collect');
    const storyteller = cloneWithTurnState(awaiting, 'storyteller');
    const mapUpdates = cloneWithTurnState(awaiting, 'map_updates');

    const collectResolution = resolveNextStackForCommit(
      loremasterCollect,
      awaiting,
      undefined,
    );
    expect(collectResolution.nextStack).toEqual([loremasterCollect, awaiting]);

    const storytellerResolution = resolveNextStackForCommit(
      storyteller,
      collectResolution.nextStack[0],
      collectResolution.nextStack[1],
    );
    expect(storytellerResolution.nextStack).toEqual([storyteller, awaiting]);

    const mapResolution = resolveNextStackForCommit(
      mapUpdates,
      storytellerResolution.nextStack[0],
      storytellerResolution.nextStack[1],
    );
    expect(mapResolution.nextStack).toEqual([mapUpdates, awaiting]);
  });

  it('preserves the pre-dialogue turn as the previous stack entry during dialogue phases', () => {
    const base = getInitialGameStates();
    base.turnState = 'awaiting_input';
    base.lastDebugPacket = makeDebugPacket('awaiting');

    const preDialogue = structuredCloneGameState(base);

    const dialogueTurn = cloneWithTurnState(base, 'dialogue_turn');
    dialogueTurn.lastDebugPacket = makeDebugPacket('dialogue_turn');

    const dialogueMemory = cloneWithTurnState(base, 'dialogue_memory');
    dialogueMemory.lastDebugPacket = makeDebugPacket('dialogue_memory');

    const awaitingDuringDialogue = structuredCloneGameState(base);
    awaitingDuringDialogue.turnState = 'awaiting_input';
    awaitingDuringDialogue.dialogueState = {
      participants: ['One-Eyed Finn'],
      history: [],
      options: ['Option'],
    };
    awaitingDuringDialogue.lastDebugPacket = makeDebugPacket('awaiting_dialogue');

    const stack: GameStateStack = [dialogueTurn, preDialogue];

    const resolutionDuringDialogue = resolveNextStackForCommit(
      dialogueMemory,
      stack[0],
      stack[1],
    );

    expect(resolutionDuringDialogue.nextStack[1]).toEqual(preDialogue);
    expect(resolutionDuringDialogue.dialogueFallbackDebug?.prompt).toBe('awaiting');
    expect(resolutionDuringDialogue.preserveDialogueFallback).toBe(true);

    const awaitingMidDialogueResolution = resolveNextStackForCommit(
      awaitingDuringDialogue,
      resolutionDuringDialogue.nextStack[0],
      resolutionDuringDialogue.nextStack[1],
    );
    expect(awaitingMidDialogueResolution.nextStack[1]).toEqual(preDialogue);
    expect(awaitingMidDialogueResolution.preserveDialogueFallback).toBe(true);

    const postDialogueAwaiting = cloneWithTurnState(base, 'awaiting_input');
    postDialogueAwaiting.lastDebugPacket = makeDebugPacket('awaiting_after');
    const resolutionAfterDialogue = resolveNextStackForCommit(
      postDialogueAwaiting,
      awaitingMidDialogueResolution.nextStack[0],
      awaitingMidDialogueResolution.nextStack[1],
    );

    expect(resolutionAfterDialogue.nextStack[1]).toEqual(preDialogue);
    expect(resolutionAfterDialogue.fallbackDebugForAwaiting?.prompt).toBe('awaiting');
    expect(resolutionAfterDialogue.preserveDialogueFallback).toBe(false);
  });

  it('selectFallbackGameStateForTurn returns the last awaiting_input state when available', () => {
    const awaiting = getInitialGameStates();
    awaiting.turnState = 'awaiting_input';

    const dialogue = structuredCloneGameState(awaiting);
    dialogue.turnState = 'dialogue_turn';

    const result = selectFallbackGameStateForTurn(dialogue, awaiting);
    expect(result).toBe(awaiting);
  });
});
