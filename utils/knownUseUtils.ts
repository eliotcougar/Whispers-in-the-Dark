import { KnownUse } from '../types';
import { createHeuristicRegexes } from './mapSynonyms';
import knownUseSynonymsRaw from '../resources/knownUseSynonyms';

const synonyms = knownUseSynonymsRaw as { block: Record<string, string> };

export const BLOCKED_KNOWN_USE_SYNONYMS: Record<string, string> = synonyms.block;

export const BLOCKED_KNOWN_USE_CANONICALS = Array.from(
  new Set(Object.values(BLOCKED_KNOWN_USE_SYNONYMS)),
);

let heuristics: Array<[RegExp, string]> | null = null;

function getHeuristics(): Array<[RegExp, string]> {
  if (heuristics) return heuristics;
  heuristics = createHeuristicRegexes(
    BLOCKED_KNOWN_USE_SYNONYMS,
    BLOCKED_KNOWN_USE_CANONICALS,
  );
  return heuristics;
}

export function isBlockedKnownUseText(text: string): boolean {
  const regs = getHeuristics();
  return regs.some(([regex]) => regex.test(text));
}

export function isBlockedKnownUse(ku: KnownUse): boolean {
  const combined = `${ku.actionName} ${ku.description} ${ku.promptEffect}`;
  return isBlockedKnownUseText(combined);
}

export function filterBlockedKnownUses(
  uses: Array<KnownUse> | undefined,
): Array<KnownUse> | undefined {
  if (!uses) return uses;
  return uses.filter(ku => !isBlockedKnownUse(ku));
}
