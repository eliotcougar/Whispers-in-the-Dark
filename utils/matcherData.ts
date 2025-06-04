/**
 * @file matcherData.ts
 * @description Data definitions used by map node matching logic.
 */

/**
 * Describes a preposition keyword grouping and its matching behavior.
 */
export interface PrepositionDefinition {
  keywords: string[];
  type: 'direct' | 'relational' | 'negating' | 'contextual_linking';
  weight: number;
}

/**
 * Base list of prepositions with weights before sorting by length.
 */
const unsortedPrepositions: PrepositionDefinition[] = [
  { keywords: ['inside of', 'inside'], type: 'direct', weight: 100 },
  { keywords: ['atop of', 'atop'], type: 'direct', weight: 100 },
  { keywords: ['at the center of', 'at the heart of', 'at the'], type: 'direct', weight: 90 },
  { keywords: ['at'], type: 'direct', weight: 85 },
  { keywords: ['within'], type: 'direct', weight: 95 },
  { keywords: ['on top of', 'on'], type: 'direct', weight: 90 },
  { keywords: ['entering into', 'entering'], type: 'direct', weight: 90 },

  { keywords: ['overlooking'], type: 'relational', weight: 60 },
  { keywords: ['leading to', 'leading towards'], type: 'relational', weight: 55 },
  {
    keywords: ['near to', 'near by', 'nearby', 'near', 'close to', 'by', 'beside', 'next to'],
    type: 'relational',
    weight: 50
  },
  { keywords: ['facing'], type: 'relational', weight: 45 },
  { keywords: ['approaching'], type: 'relational', weight: 40 },
  { keywords: ['exiting from', 'exiting', 'leaving from', 'leaving'], type: 'relational', weight: 35 },
  { keywords: ['heading to', 'heading towards', 'going to', 'going towards'], type: 'relational', weight: 50 },
  { keywords: ['coming from', 'arriving from'], type: 'relational', weight: 30 },

  { keywords: ['outside of', 'outside', 'behind'], type: 'negating', weight: 30 },
  { keywords: ['away from', 'far from'], type: 'negating', weight: 20 },
  { keywords: ['beyond'], type: 'negating', weight: 25 },

  { keywords: ['of the', 'of a', 'of an', 'of'], type: 'contextual_linking', weight: 5 },
  { keywords: ['from the', 'from a', 'from an', 'from'], type: 'contextual_linking', weight: 5 }
];

/**
 * Prepositions sorted so longer keywords are matched first.
 */
export const PREPOSITIONS: PrepositionDefinition[] = [...unsortedPrepositions].sort(
  (a, b) => Math.max(...b.keywords.map(k => k.length)) - Math.max(...a.keywords.map(k => k.length))
);

/**
 * Flattened list of keywords used when constructing regular expressions.
 */
export const ALL_PREPOSITION_KEYWORDS_FOR_REGEX: string[] = PREPOSITIONS
  .filter(p => p.type !== 'contextual_linking')
  .flatMap(p => p.keywords)
  .sort((a, b) => b.length - a.length);
