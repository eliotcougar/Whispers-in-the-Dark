/**
 * @file promptBuilder.ts
 * @description Constructs prompts for the Loremaster service.
 */
import { ThemeFact } from '../../types';

export const buildExtractFactsPrompt = (
  themeName: string,
  turnContext: string,
): string => {
  return `Theme: ${themeName}
  Context:
  ${turnContext}

  List immutable facts according to your instructions.`;
};

export const buildIntegrateFactsPrompt = (
  themeName: string,
  existingFacts: Array<ThemeFact>,
  newFacts: Array<string>,
): string => {
  const existing = existingFacts.map(f => `- ${f.text}`).join('\n') || 'None.';
  const proposed = newFacts.map(f => `- ${f}`).join('\n') || 'None.';
  return `Theme: ${themeName}

  Known Facts:
  ${existing}

  New Candidate Facts:
  ${proposed}
  
  Provide integration instructions acording to your instructions.`;
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
  return `**Context for Fact Selection**
  Theme: ${themeName}
  Last Scene: "${lastScene}"
  Recent Log:
  ${logLines}
  ${detailedContext}

  Player Action: "${playerAction}"
  
  ------
  
  Select the 10 most relevant facts from the list of Known Facts:
  ${factLines}

  Respond with a JSON array of strings.`;
};

export const buildDistillFactsPrompt = (
  themeName: string,
  facts: Array<ThemeFact>,
): string => {
  const factLines = facts
    .map(f => `- ID ${String(f.id)}: "${f.text}" (Tier ${String(f.tier)}`)
    .join('\n');
  return `Theme: ${themeName}
  Current Facts:
  ${factLines}
  
  Identify pairs of facts that could be merged into a single, more specific statement. If merging, provide instructions.`;
};
