import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseAIResponse } from '../services/storyteller';
import { FANTASY_AND_MYTH_THEMES } from '../themes';
import type { AdventureTheme, HeroSheet, NPC } from '../types';

const correctionsMocks = vi.hoisted(() => ({
  fetchCorrectedNameMock: vi.fn(),
  fetchCorrectedNPCDetailsMock: vi.fn(),
  fetchCorrectedDialogueSetupMock: vi.fn(),
}));

vi.mock('../services/corrections', () => ({
  fetchCorrectedName: correctionsMocks.fetchCorrectedNameMock,
  fetchCorrectedNPCDetails: correctionsMocks.fetchCorrectedNPCDetailsMock,
  fetchCorrectedDialogueSetup: correctionsMocks.fetchCorrectedDialogueSetupMock,
}));

describe('parseAIResponse dialogue setup sanitization', () => {
  const theme: AdventureTheme = FANTASY_AND_MYTH_THEMES[0];
  const heroSheet: HeroSheet = {
    name: 'Captain',
    heroShortName: 'Captain',
    gender: 'Female',
    occupation: 'Pirate captain',
    traits: ['Bold'],
    startingItems: ['Cutlass'],
  };

  const knownNPC: NPC = {
    id: 'npc-One-Eyed-Finn-a1b2',
    name: 'One-Eyed Finn',
    description: 'Gruff boatswain with a sharp eye.',
    aliases: ['Finn'],
    presenceStatus: 'companion',
    attitudeTowardPlayer: 'loyal',
    knowsPlayerAs: ['Captain'],
    lastKnownLocation: null,
    preciseLocation: null,
    dialogueSummaries: [],
  };

  beforeEach(() => {
    correctionsMocks.fetchCorrectedNameMock.mockReset();
    correctionsMocks.fetchCorrectedNPCDetailsMock.mockReset();
    correctionsMocks.fetchCorrectedDialogueSetupMock.mockReset();
  });

  it('corrects participant typos and normalizes player options before validation', async () => {
    correctionsMocks.fetchCorrectedNameMock.mockResolvedValue('One-Eyed Finn');
    correctionsMocks.fetchCorrectedDialogueSetupMock.mockResolvedValue(null);

    const aiResponse = JSON.stringify({
      sceneDescription: 'The crew gathers on deck under a stormy sky.',
      dialogueSetup: {
        participants: ['One-Eyued Finn'],
        initialNpcResponses: [
          {
            speaker: 'npc-One-Eyued-Finn-z9x8',
            line: "Stowin' yer steel, Captain? Good. Means ye might finally listen.",
          },
        ],
        initialPlayerOptions: [
          {
            text: "The contract pays for the knowledge we need. It's necessary leverage for Isla de Muerta.",
            nextAction: 'continueDialogue',
          },
          {
            text: 'You question my command, Finn? Remember the Pirate Code on mutiny.',
            nextAction: 'continueDialogue',
          },
          {
            text: "This long-term goal will yield far more than mere silver. You'll all be rich men.",
            nextAction: 'continueDialogue',
          },
          {
            text: 'This conversation is over. Get back to your post and prepare for the raid.',
            nextAction: 'endDialogue',
          },
        ],
      },
      options: [],
      logMessage: 'One-Eyued Finn grumbles under his breath.',
      mainQuest: 'Secure the artifact of Isla de Muerta.',
      currentObjective: 'Keep the crew focused on the contract.',
      mapUpdated: false,
      currentMapNodeId: 'node-ship-bridge-1234',
      localTime: 'Dusk',
      localEnvironment: 'Rolling waves and cold wind',
      localPlace: 'Deck of the Crimson Wraith',
      itemChange: [],
      npcsAdded: [],
      npcsUpdated: [],
    });

    const result = await parseAIResponse(
      aiResponse,
      theme,
      heroSheet,
      undefined,
      undefined,
      undefined,
      [knownNPC],
      { nodes: [], edges: [] },
      [],
    );

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    if (!result.data?.dialogueSetup) {
      throw new Error('Expected dialogueSetup to be present.');
    }

    const { dialogueSetup } = result.data;

    expect(dialogueSetup.participants).toEqual(['One-Eyed Finn']);
    expect(dialogueSetup.initialNpcResponses[0].speaker).toBe('One-Eyed Finn');
    expect(dialogueSetup.initialPlayerOptions.every(opt => typeof opt === 'string')).toBe(true);
    expect(correctionsMocks.fetchCorrectedNameMock).toHaveBeenCalledWith(
      'dialogue participant',
      'One-Eyued Finn',
      expect.any(String),
      expect.any(String),
      expect.arrayContaining(['One-Eyed Finn']),
      theme,
    );
  });

  it('strips errant fields from initial player options while preserving text', async () => {
    correctionsMocks.fetchCorrectedDialogueSetupMock.mockResolvedValue(null);

    const aiResponse = JSON.stringify({
      sceneDescription: 'Finn eyes the treasure map, clearly agitated.',
      dialogueSetup: {
        participants: ['One-Eyed Finn'],
        initialNpcResponses: [
          {
            speaker: 'One-Eyed Finn',
            line: "This treasure hunt's gone soft, Captain. When do we raise the black flag?",
          },
        ],
        initialPlayerOptions: [
          {
            text: 'The contract is our best leverage; we stay the course.',
            nextAction: 'continueDialogue',
            target: 'npc-One-Eyed-Finn-e9h8',
          },
          {
            text: "Stand down, Finn. Mutiny talk ends here.",
            action: 'StartCombat',
            consequence: 'FinnMutinyAttempt',
          },
          'Dismiss his concerns and return to your charts.',
          {
            text: 'Order Finn to muster the boarding party and be ready.',
            target: 'crew',
            urgency: 'high',
          },
        ],
      },
      options: [],
      logMessage: 'Finn continues to grumble, testing your patience.',
      mainQuest: 'Secure the artifact of Isla de Muerta.',
      currentObjective: 'Keep the crew focused on the contract.',
      mapUpdated: false,
      currentMapNodeId: 'node-ship-bridge-1234',
      localTime: 'Nightfall',
      localEnvironment: 'Lantern-lit deck swaying with the tide',
      localPlace: 'Quarterdeck of the Crimson Wraith',
      itemChange: [],
      npcsAdded: [],
      npcsUpdated: [],
    });

    const result = await parseAIResponse(
      aiResponse,
      theme,
      heroSheet,
      undefined,
      undefined,
      undefined,
      [knownNPC],
      { nodes: [], edges: [] },
      [],
    );

    expect(result.error).toBeNull();
    expect(result.data?.dialogueSetup?.initialPlayerOptions).toEqual([
      'The contract is our best leverage; we stay the course.',
      'Stand down, Finn. Mutiny talk ends here.',
      'Dismiss his concerns and return to your charts.',
      'Order Finn to muster the boarding party and be ready.',
    ]);
    expect(correctionsMocks.fetchCorrectedNameMock).not.toHaveBeenCalled();
  });
});
