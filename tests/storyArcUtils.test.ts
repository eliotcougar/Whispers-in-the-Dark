import { describe, it, expect } from 'vitest';
import { formatStoryArcContext } from '../utils/promptFormatters';
import { isStoryArcValid } from '../utils/storyArcUtils';
import type { StoryArc } from '../types';

describe('story arc helpers', () => {
  it('isStoryArcValid detects invalid current act', () => {
    const arc: StoryArc = { title: 'Arc', overview: 'Overview', acts: [], currentAct: 1 };
    expect(isStoryArcValid(arc)).toBe(false);
  });

  it('formatStoryArcContext returns empty string for invalid arc', () => {
    const arc: StoryArc = { title: 'Arc', overview: 'Overview', acts: [], currentAct: 1 };
    const result = formatStoryArcContext(arc);
    expect(result).toBe('');
  });

  it('formatStoryArcContext formats a valid arc', () => {
    const arc: StoryArc = {
      title: 'Arc',
      overview: 'Overview',
      currentAct: 1,
      acts: [
        {
          actNumber: 1,
          title: 'Act 1',
          description: 'Desc',
          mainObjective: 'Main',
          sideObjectives: ['Side'],
          successCondition: 'Finish',
          completed: false,
        },
      ],
    };
    const result = formatStoryArcContext(arc);
    expect(result).toContain('Current Act 1: Act 1');
  });
});
