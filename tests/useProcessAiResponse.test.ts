import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  UseProcessAiResponseProps,
} from '../hooks/useProcessAiResponse';
import type {
  FullGameState,
  GameStateFromAI,
  GameStateStack,
  Item,
  TurnChanges,
} from '../types';
import React, {
  act,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { createRoot } from 'react-dom/client';
import { getInitialGameStates } from '../utils/initialStates';
import { structuredCloneGameState } from '../utils/cloneUtils';
import { PLAYER_HOLDER_ID } from '../constants';

const processMapUpdatesMock = vi.fn<(
  aiData: GameStateFromAI,
  draftState: FullGameState,
  baseSnapshot: FullGameState,
  turnChanges: TurnChanges,
) => Promise<void>>();
const refineLoreServiceMock = vi.fn().mockResolvedValue(null);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const applyInventoryHintsMock = vi.fn().mockResolvedValue(null);
const applyLibrarianHintsMock = vi.fn().mockResolvedValue(null);
const generatePageTextMock = vi.fn().mockResolvedValue(null);
const fetchCorrectedNameMock = vi.fn().mockResolvedValue(null);

vi.mock('../hooks/useMapUpdateProcessor', () => ({
  __esModule: true,
  useMapUpdateProcessor: () => ({ processMapUpdates: processMapUpdatesMock }),
}));

vi.mock('../services/loremaster', () => ({
  __esModule: true,
  refineLore: refineLoreServiceMock,
}));

vi.mock('../services/inventory', () => ({
  __esModule: true,
  applyInventoryHints: applyInventoryHintsMock,
}));

vi.mock('../services/librarian', () => ({
  __esModule: true,
  applyLibrarianHints: applyLibrarianHintsMock,
}));

vi.mock('../services/page', () => ({
  __esModule: true,
  generatePageText: generatePageTextMock,
}));

vi.mock('../services/corrections', () => ({
  __esModule: true,
  fetchCorrectedName: fetchCorrectedNameMock,
}));

const { useProcessAiResponse } = await import('../hooks/useProcessAiResponse');

type HookResult = ReturnType<typeof useProcessAiResponse>;

const HookHarness = forwardRef<HookResult, UseProcessAiResponseProps>((props, ref) => {
  const value = useProcessAiResponse(props);
  useImperativeHandle(ref, () => value, [value]);
  return null;
});

HookHarness.displayName = 'HookHarness';

interface HookSetupOptions {
  readonly props: UseProcessAiResponseProps;
}

const renderUseProcessAiResponse = ({ props }: HookSetupOptions) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref = React.createRef<HookResult>();

  act(() => {
    const elementProps: UseProcessAiResponseProps & React.RefAttributes<HookResult> = { ...props, ref };
    const element = React.createElement(HookHarness, elementProps);
    root.render(element);
  });

  const getResult = (): HookResult => {
    if (!ref.current) {
      throw new Error('Hook result not available');
    }
    return ref.current;
  };

  const cleanup = () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };

  return { getResult, cleanup };
};

const createHookProps = (
  setGameStateStack: UseProcessAiResponseProps['setGameStateStack'],
): UseProcessAiResponseProps => ({
  loadingReasonRef: { current: null },
  setLoadingReason: vi.fn(),
  setError: vi.fn(),
  setGameStateStack,
  debugLore: false,
  openDebugLoreModal: vi.fn(),
  actIntroRef: { current: null },
  onActIntro: vi.fn(),
});

const makeAiResponse = (patch: Partial<GameStateFromAI> = {}): GameStateFromAI => ({
  sceneDescription: 'A mysterious chamber',
  options: ['Look around.'],
  itemChange: [],
  ...patch,
});

const cloneState = (state: FullGameState): FullGameState => structuredCloneGameState(state);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useProcessAiResponse', () => {
  it('corrects duplicate create actions into change updates', async () => {
    const baseState = getInitialGameStates();
    const existingItem: Item = {
      id: 'item-existing',
      name: 'Ancient Key',
      type: 'key',
      description: 'Tarnished bronze key',
      holderId: PLAYER_HOLDER_ID,
      tags: [],
    };
    baseState.inventory = [existingItem];

    const draftState = cloneState(baseState);
    const baseSnapshot = cloneState(baseState);

    const stackRef: { value: GameStateStack } = {
      value: [cloneState(baseState), cloneState(baseState)],
    };
    const setGameStateStack = vi.fn((updater: React.SetStateAction<GameStateStack>) => {
      stackRef.value = typeof updater === 'function' ? updater(stackRef.value) : updater;
    });

    const { getResult, cleanup } = renderUseProcessAiResponse({
      props: createHookProps(setGameStateStack),
    });

    const { processAiResponse } = getResult();

    const aiData = makeAiResponse({
      itemChange: [
        {
          action: 'create',
          item: {
            id: 'temp-id',
            name: 'Ancient Key',
            type: 'key',
            description: 'Tarnished bronze key',
            holderId: PLAYER_HOLDER_ID,
          },
        },
      ],
    });

    await act(async () => {
      await processAiResponse(aiData, draftState, {
        baseStateSnapshot: baseSnapshot,
      });
    });

    expect(fetchCorrectedNameMock).not.toHaveBeenCalled();
    expect(draftState.inventory).toHaveLength(1);
    expect(draftState.inventory[0].id).toBe('item-existing');

    cleanup();
  });

  it('deduplicates correction requests for repeated destroy entries', async () => {
    const baseState = getInitialGameStates();
    const playerItem: Item = {
      id: 'item-mystic',
      name: 'Mystic Orb',
      type: 'equipment',
      description: 'A glowing relic.',
      holderId: PLAYER_HOLDER_ID,
      tags: [],
    };
    baseState.inventory = [playerItem];

    const draftState = cloneState(baseState);
    const baseSnapshot = cloneState(baseState);

    const stackRef: { value: GameStateStack } = {
      value: [cloneState(baseState), cloneState(baseState)],
    };
    const setGameStateStack = vi.fn((updater: React.SetStateAction<GameStateStack>) => {
      stackRef.value = typeof updater === 'function' ? updater(stackRef.value) : updater;
    });

    const { getResult, cleanup } = renderUseProcessAiResponse({
      props: createHookProps(setGameStateStack),
    });

    const { processAiResponse } = getResult();

    fetchCorrectedNameMock.mockResolvedValue('Mystic Orb');

    const aiData = makeAiResponse({
      itemChange: [
        {
          action: 'destroy',
          item: {
            id: 'temp-1',
            name: 'Mystic Orb?',
          },
        },
        {
          action: 'destroy',
          item: {
            id: 'temp-2',
            name: 'Mystic Orb?',
          },
        },
      ],
    });

    await act(async () => {
      await processAiResponse(aiData, draftState, {
        baseStateSnapshot: baseSnapshot,
      });
    });

    expect(fetchCorrectedNameMock).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('delegates map updates when mapUpdated flag is set', async () => {
    const baseState = getInitialGameStates();
    const draftState = cloneState(baseState);
    const baseSnapshot = cloneState(baseState);

    const stackRef: { value: GameStateStack } = {
      value: [cloneState(baseState), cloneState(baseState)],
    };
    const setGameStateStack = vi.fn((updater: React.SetStateAction<GameStateStack>) => {
      stackRef.value = typeof updater === 'function' ? updater(stackRef.value) : updater;
    });

    const { getResult, cleanup } = renderUseProcessAiResponse({
      props: createHookProps(setGameStateStack),
    });

    const { processAiResponse } = getResult();

    const aiData = makeAiResponse({
      mapUpdated: true,
    });

    await act(async () => {
      await processAiResponse(aiData, draftState, {
        baseStateSnapshot: baseSnapshot,
      });
    });

    expect(processMapUpdatesMock).toHaveBeenCalledTimes(1);
    const [aiArg, draftArg, snapshotArg, turnChangesArg] = processMapUpdatesMock.mock.calls[0];
    expect(aiArg).toBe(aiData);
    expect(draftArg).toBe(draftState);
    expect(snapshotArg).toBe(baseSnapshot);
    expect(turnChangesArg).toBeDefined();

    cleanup();
  });

  it('toggles loading state and triggers lore refinement when theme is present', async () => {
    const baseState = getInitialGameStates();
    const draftState = cloneState(baseState);
    const baseSnapshot = cloneState(baseState);

    const stackRef: { value: GameStateStack } = {
      value: [cloneState(baseState), cloneState(baseState)],
    };
    const setGameStateStack = vi.fn((updater: React.SetStateAction<GameStateStack>) => {
      stackRef.value = typeof updater === 'function' ? updater(stackRef.value) : updater;
    });

    const setIsLoading = vi.fn();
    const setIsTurnProcessing = vi.fn();

    const { getResult, cleanup } = renderUseProcessAiResponse({
      props: createHookProps(setGameStateStack),
    });

    const { processAiResponse } = getResult();

    const aiData = makeAiResponse({
      logMessage: 'Insights gained.',
    });

    await act(async () => {
      await processAiResponse(aiData, draftState, {
        baseStateSnapshot: baseSnapshot,
        setIsLoading,
        setIsTurnProcessing,
      });
    });

    expect(setIsLoading).toHaveBeenCalledWith(false);
    expect(setIsTurnProcessing).toHaveBeenCalledWith(true);
    expect(refineLoreServiceMock).toHaveBeenCalledTimes(1);
    expect(draftState.turnState).toBe('awaiting_input');

    cleanup();
  });

  it('enters dialogue mode when dialogue setup is present by default', async () => {
    const baseState = getInitialGameStates();
    const draftState = cloneState(baseState);
    const baseSnapshot = cloneState(baseState);

    const stackRef: { value: GameStateStack } = {
      value: [cloneState(baseState), cloneState(baseState)],
    };
    const setGameStateStack = vi.fn((updater: React.SetStateAction<GameStateStack>) => {
      stackRef.value = typeof updater === 'function' ? updater(stackRef.value) : updater;
    });

    const { getResult, cleanup } = renderUseProcessAiResponse({
      props: createHookProps(setGameStateStack),
    });

    const { processAiResponse } = getResult();

    const aiData = makeAiResponse({
      options: [],
      dialogueSetup: {
        participants: ['Hero', 'Caretaker'],
        initialNpcResponses: [{ speaker: 'Caretaker', line: 'Welcome to the keep.' }],
        initialPlayerOptions: ['Greet the caretaker.'],
      },
    });

    await act(async () => {
      await processAiResponse(aiData, draftState, {
        baseStateSnapshot: baseSnapshot,
      });
    });

    expect(draftState.dialogueState).not.toBeNull();
    expect(draftState.dialogueState?.participants).toContain('Caretaker');
    expect(draftState.turnState).toBe('dialogue_turn');
    expect(draftState.actionOptions).toEqual([]);

    cleanup();
  });

  it('suppresses dialogue setup when requested', async () => {
    const baseState = getInitialGameStates();
    const draftState = cloneState(baseState);
    const baseSnapshot = cloneState(baseState);

    const stackRef: { value: GameStateStack } = {
      value: [cloneState(baseState), cloneState(baseState)],
    };
    const setGameStateStack = vi.fn((updater: React.SetStateAction<GameStateStack>) => {
      stackRef.value = typeof updater === 'function' ? updater(stackRef.value) : updater;
    });

    const { getResult, cleanup } = renderUseProcessAiResponse({
      props: createHookProps(setGameStateStack),
    });

    const { processAiResponse } = getResult();

    const aiData = makeAiResponse({
      dialogueSetup: {
        participants: ['Hero', 'Caretaker'],
        initialNpcResponses: [{ speaker: 'Caretaker', line: 'Welcome to the keep.' }],
        initialPlayerOptions: ['Greet the caretaker.'],
      },
    });

    await act(async () => {
      await processAiResponse(aiData, draftState, {
        baseStateSnapshot: baseSnapshot,
        suppressDialogueSetup: true,
      });
    });

    expect(draftState.dialogueState).toBeNull();
    expect(draftState.turnState).toBe('awaiting_input');
    expect(draftState.actionOptions).toEqual(aiData.options);

    cleanup();
  });
});
