import { describe, it, expect } from 'vitest';
import { buildDistillFactsPrompt } from '../services/loremaster/promptBuilder';
import type { ThemeFact } from '../types';

describe('buildDistillFactsPrompt', () => {
  it('includes entity IDs for each fact', () => {
    const facts: Array<ThemeFact> = [
      { id: 1, text: 'First fact', entities: ['a', 'b'], createdTurn: 1, tier: 1 },
      { id: 2, text: 'Second fact', entities: ['c'], createdTurn: 1, tier: 1 },
    ];

    const prompt = buildDistillFactsPrompt('theme', facts, null, null, [], [], []);

    expect(prompt).toContain('ID 1: "First fact" [a, b]');
    expect(prompt).toContain('ID 2: "Second fact" [c]');
  });

  it('includes recent log entries', () => {
    const facts: Array<ThemeFact> = [];
    const prompt = buildDistillFactsPrompt('theme', facts, null, null, [], [], ['log a', 'log b']);
    expect(prompt).toContain('log a');
    expect(prompt).toContain('log b');
  });
});

