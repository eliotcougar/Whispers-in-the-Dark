import { describe, it, expect, vi } from 'vitest';
import {
  buildNewGameFirstTurnPrompt,
  parseAIResponse,
  executeAIMainTurn,
} from '../services/storyteller';
import { FANTASY_AND_MYTH_THEMES } from '../themes';
import { MAIN_TURN_OPTIONS_COUNT, LOCAL_STORAGE_SAVE_KEY } from '../constants';
import { saveGameStateToLocalStorage } from '../services/storage';
import { getInitialGameStates } from '../utils/initialStates';
import type { GenerateContentResponse } from '@google/genai';

vi.mock('../services/storyteller/api', () => ({
  executeAIMainTurn: vi.fn(),
}));

const mockedExecute = vi.mocked(executeAIMainTurn);

const fakeAiJson = JSON.stringify({
  sceneDescription: 'You awaken in a damp cell.',
  options: [
    'Look around.',
    'Call out for help.',
    'Inspect the door.',
    'Check your pockets.',
    'Wait quietly.',
    'Plan an escape.',
  ],
  mainQuest: 'Reach the heart of the dungeon.',
  currentObjective: 'Escape the cell.',
  itemChange: [],
  logMessage: 'You slowly regain consciousness.',
  localTime: 'Dawn',
  localEnvironment: 'Stale air and darkness',
  localPlace: 'Dungeon cell',
  mapUpdated: true,
  currentMapNodeId: 'cell_1',
});

describe('game start sequence', () => {
  it('generates a valid initial scene', async () => {
    mockedExecute.mockResolvedValue({
      response: { text: fakeAiJson } as unknown as GenerateContentResponse,
      thoughts: [],
      systemInstructionUsed: 'test',
      jsonSchemaUsed: undefined,
    });

    const theme = FANTASY_AND_MYTH_THEMES[0];
    const prompt = buildNewGameFirstTurnPrompt(theme, 'Male');

    const { response } = await executeAIMainTurn(prompt, theme.systemInstructionModifier);
    const parsed = await parseAIResponse(
      response.text ?? '',
      'Male',
      theme,
      undefined,
      undefined,
      undefined,
      [],
      { nodes: [], edges: [] },
      [],
    );

    expect(mockedExecute).toHaveBeenCalledOnce();
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(parsed.sceneDescription).toBeTruthy();
    expect(Array.isArray(parsed.options)).toBe(true);
    expect(parsed.options.length).toBe(MAIN_TURN_OPTIONS_COUNT);
    expect(parsed.mainQuest).toBeTruthy();
    expect(parsed.currentObjective).toBeTruthy();
    expect(parsed.logMessage).toBeTruthy();
    expect(parsed.mapUpdated).toBe(true);
    expect(parsed.currentMapNodeId).toBeTruthy();
    expect(parsed.localTime).toBeTruthy();
    expect(parsed.localEnvironment).toBeTruthy();
    expect(parsed.localPlace).toBeTruthy();
  });

  it('completes the start sequence and saves the state', async () => {
    const saved: Record<string, string> = {};
    const setItem = vi.fn((key: string, value: string) => {
      saved[key] = value;
    });
    const getItem = vi.fn((key: string) => saved[key] ?? null);
    const removeItem = vi.fn();
    const clear = vi.fn();
    const keyFn = vi.fn();
    globalThis.localStorage = {
      setItem,
      getItem,
      removeItem,
      clear,
      key: keyFn,
      length: 0,
    } as unknown as Storage;

    mockedExecute.mockResolvedValue({
      response: { text: fakeAiJson } as unknown as GenerateContentResponse,
      thoughts: [],
      systemInstructionUsed: 'test',
      jsonSchemaUsed: undefined,
    });

    const theme = FANTASY_AND_MYTH_THEMES[0];
    const prompt = buildNewGameFirstTurnPrompt(theme, 'Male');
    const { response } = await executeAIMainTurn(prompt, theme.systemInstructionModifier);
    const parsed = await parseAIResponse(
      response.text ?? '',
      'Male',
      theme,
      undefined,
      undefined,
      undefined,
      [],
      { nodes: [], edges: [] },
      [],
    );

    expect(parsed).not.toBeNull();
    if (!parsed) return;

    const state = getInitialGameStates();
    state.playerGender = 'Male';
    state.currentThemeName = theme.name;
    state.currentThemeObject = theme;
    state.currentScene = parsed.sceneDescription;
    state.actionOptions = parsed.options;
    state.mainQuest = parsed.mainQuest ?? null;
    state.currentObjective = parsed.currentObjective ?? null;
    state.gameLog.push(parsed.logMessage ?? '');
    state.localTime = parsed.localTime ?? state.localTime;
    state.localEnvironment = parsed.localEnvironment ?? state.localEnvironment;
    state.localPlace = parsed.localPlace ?? state.localPlace;
    state.currentMapNodeId = parsed.currentMapNodeId ?? null;
    state.globalTurnNumber = 1;

    const result = saveGameStateToLocalStorage([state, undefined]);
    expect(result).toBe(true);
    expect(setItem).toHaveBeenCalledWith(
      LOCAL_STORAGE_SAVE_KEY,
      expect.any(String),
    );
    const savedString = saved[LOCAL_STORAGE_SAVE_KEY];
    const parsedSaved = JSON.parse(savedString) as Record<string, unknown>;
    const current = parsedSaved.current as Record<string, unknown>;
    expect(current.currentThemeName).toBe(theme.name);
    expect(current.currentScene).toBe(parsed.sceneDescription);
    expect(Array.isArray(current.actionOptions)).toBe(true);
  });
});
