import { describe, it, expect } from 'vitest';
import { parseDialogueTurnResponse } from '../services/dialogue/responseParser';

describe('parseDialogueTurnResponse', () => {
  it('captures npc attitude updates when provided', () => {
    const response = JSON.stringify({
      dialogueEnds: false,
      npcResponses: [{ speaker: 'Eldra', line: 'I was too harsh before.' }],
      playerOptions: ['Explain yourself.', 'End conversation.'],
      npcAttitudeUpdates: [
        { name: ' Eldra ', newAttitudeTowardPlayer: ' curious now ' },
      ],
    });

    const parsed = parseDialogueTurnResponse(response);

    expect(parsed?.npcAttitudeUpdates).toEqual([
      { name: 'Eldra', newAttitudeTowardPlayer: 'curious now' },
    ]);
  });

  it('captures known player name updates when provided', () => {
    const response = JSON.stringify({
      dialogueEnds: false,
      npcResponses: [{ speaker: 'Marla', line: 'So you are called Dawn?' }],
      playerOptions: ['Smile.', 'End conversation.'],
      npcKnownNameUpdates: [
        { name: 'Marla', newKnownPlayerNames: [' Dawn ', 'Hero'], addKnownPlayerName: ' Star ' },
        { name: 'Jorin', newKnownPlayerNames: [] },
        { name: 'Sera', newKnownPlayerNames: [], addKnownPlayerName: ' Friend ' },
      ],
    });

    const parsed = parseDialogueTurnResponse(response);

    expect(parsed?.npcKnownNameUpdates).toEqual([
      { name: 'Marla', newKnownPlayerNames: ['Dawn', 'Hero'], addKnownPlayerName: 'Star' },
      { name: 'Jorin', newKnownPlayerNames: [] },
      { name: 'Sera', newKnownPlayerNames: [], addKnownPlayerName: 'Friend' },
    ]);
  });

  it('leaves previous attitudes untouched when npcAttitudeUpdates is omitted', () => {
    const response = JSON.stringify({
      dialogueEnds: false,
      npcResponses: [{ speaker: 'Marla', line: 'I still feel the same.' }],
      playerOptions: ['Keep talking.', 'End conversation.'],
    });

    const parsed = parseDialogueTurnResponse(response);

    expect(parsed).not.toBeNull();
    expect(parsed?.npcAttitudeUpdates).toBeUndefined();
  });

  it('rejects payloads with invalid npc attitude entries', () => {
    const response = JSON.stringify({
      dialogueEnds: false,
      npcResponses: [{ speaker: 'Sorn', line: 'Fine, be that way.' }],
      playerOptions: ['Leave.', 'End conversation.'],
      npcAttitudeUpdates: [
        { name: '   ', newAttitudeTowardPlayer: 'resigned' },
      ],
    });

    expect(parseDialogueTurnResponse(response)).toBeNull();
  });

  it('rejects payloads with empty attitude text', () => {
    const response = JSON.stringify({
      dialogueEnds: false,
      npcResponses: [{ speaker: 'Serin', line: 'Perhaps I misjudged you.' }],
      playerOptions: ['Nod.', 'End conversation.'],
      npcAttitudeUpdates: [
        { name: 'Serin', newAttitudeTowardPlayer: '   ' },
      ],
    });

    expect(parseDialogueTurnResponse(response)).toBeNull();
  });

  it('rejects payloads that omit the new attitude string', () => {
    const response = JSON.stringify({
      dialogueEnds: false,
      npcResponses: [{ speaker: 'Farlan', line: 'I might reconsider.' }],
      playerOptions: ['Wait.', 'End conversation.'],
      npcAttitudeUpdates: [
        { name: 'Farlan' },
      ],
    });

    expect(parseDialogueTurnResponse(response)).toBeNull();
  });

  it('rejects known name payloads with invalid data', () => {
    const response = JSON.stringify({
      dialogueEnds: false,
      npcResponses: [{ speaker: 'Lysa', line: 'I forget your name.' }],
      playerOptions: ['Remind her.', 'End conversation.'],
      npcKnownNameUpdates: [
        { name: '   ', addKnownPlayerName: 'Hero' },
      ],
    });

    expect(parseDialogueTurnResponse(response)).toBeNull();
  });
});
