/**
 * @file promptBuilder.ts
 * @description Constructs prompts for the Loremaster service.
 */
import { ThemeFact } from '../../types';

export const buildExtractFactsPrompt = (
  themeName: string,
  turnContext: string,
): string => {
  return `Theme: ${themeName}\nContext:\n${turnContext}\nList immutable facts:`;
};

export const buildIntegrateFactsPrompt = (
  themeName: string,
  existingFacts: Array<ThemeFact>,
  newFacts: Array<string>,
): string => {
  const existing = existingFacts.map(f => `- ${f.text}`).join('\n') || 'None.';
  const proposed = newFacts.map(f => `- ${f}`).join('\n') || 'None.';
  return `Theme: ${themeName}\nKnown Facts:\n${existing}\nNew Candidate Facts:\n${proposed}\nProvide integration instructions.`;
};

export interface FactForSelection {
  text: string;
  tier: number;
}

export const buildCollectRelevantFactsPrompt = (
  themeName: string,
  facts: Array<FactForSelection>,
  lastScene: string,
  playerAction: string,
  recentLog: Array<string>,
  detailedContext: string,
): string => {
  const factLines = facts
    .map((f, idx) => `${String(idx + 1)}. (Tier ${String(f.tier)}) ${f.text}`)
    .join('\n');
  const logLines = recentLog.map(l => `- ${l}`).join('\n');
  return `Theme: ${themeName}\nKnown Facts:\n${factLines}\n\nLast Scene: "${lastScene}"\nPlayer Action: "${playerAction}"\nRecent Log:\n${logLines}\n${detailedContext}\nSelect the 10 most relevant facts from the list. Respond with a JSON array of strings.`;
};

export const buildDistillFactsPrompt = (
  themeName: string,
  facts: Array<ThemeFact>,
): string => {
  const factLines = facts
    .map(f => `- (ID ${String(f.id)}, Tier ${String(f.tier)}) ${f.text}`)
    .join('\n');
  return `Theme: ${themeName}\nCurrent Facts:\n${factLines}\nIdentify any two facts that could be merged into a single, more specific statement. If merging, provide instructions.`;
};
