/**
 * @file promptBuilder.ts
 * @description Constructs prompts for the Loremaster service.
 */
import {
  ThemeFact,
  FactWithEntities,
  WorldFacts,
  HeroSheet,
  HeroBackstory,
} from '../../types';
import {
  formatWorldFactsForPrompt,
  formatHeroSheetForPrompt,
  formatHeroBackstoryForPrompt,
  formatRecentEventsForPrompt,
} from '../../utils/promptFormatters';

export const buildExtractFactsPrompt = (
  themeName: string,
  turnContext: string,
  worldFacts?: WorldFacts,
  heroSheet?: HeroSheet,
  heroBackstory?: HeroBackstory,
): string => {
  const worldInfo = worldFacts ? `\n${formatWorldFactsForPrompt(worldFacts)}` : '';
  const heroInfo = heroSheet ? `\n${formatHeroSheetForPrompt(heroSheet, false)}` : '';
  const heroPast = heroBackstory
    ? `\n${formatHeroBackstoryForPrompt(heroBackstory)}`
    : '';
  const extras = `${worldInfo}${heroInfo}${heroPast}`;
  return `Theme: ${themeName}

  ## Context:
${turnContext}${extras}

List immutable facts according to your instructions. Return JSON as:
[{"entities": ["id1", "id2"], "text": "fact"}]
`;
};

export const buildIntegrateFactsPrompt = (
  themeName: string,
  existingFacts: Array<ThemeFact>,
  newFacts: Array<FactWithEntities>,
  logMessage: string,
  currentScene: string,
): string => {
  const existing =
    existingFacts
      .map(f => `- ID ${String(f.id)}: ${f.text} [${f.entities.join(', ')}]`)
      .join('\n') || 'None.';
  const proposed =
    newFacts
      .map(f => `- ${f.text} [${f.entities.join(', ')}]`)
      .join('\n') || 'None.';
  const events = formatRecentEventsForPrompt(
    [logMessage, currentScene].filter(e => e.trim() !== ''),
  );
  return `Theme: ${themeName}

  ## Recent Events:
${events || 'None'}

  ## Known Facts:
${existing}

  ## New Candidate Facts:
${proposed}

Provide facts integration, changes and pruning instructions acording to your instructions.
`;
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

  ## Player Actions:
${playerAction}

  ------
  
Select the 10 most relevant facts from the list of Known Facts:
${factLines}
`;
};

export const buildDistillFactsPrompt = (
  themeName: string,
  facts: Array<ThemeFact>,
  currentQuest: string | null,
  currentObjective: string | null,
  inventoryItemNames: Array<string>,
  mapNodeNames: Array<string>,
  recentLogEntries: Array<string>,
): string => {
  const factLines = facts
    .map(
      f =>
        `- ID ${String(f.id)}: "${f.text}" [${f.entities.join(', ')}] (Tier ${String(f.tier)})`,
    )
    .join('\n');
  const inventoryLines = inventoryItemNames
    .map(name => `- ${name}`)
    .join('\n');
  const mapLines = mapNodeNames.map(name => `- ${name}`).join('\n');
  const logLines = recentLogEntries.map(l => `- ${l}`).join('\n');
  return `Theme: ${themeName}
Current Quest: ${currentQuest ?? 'None'}
Current Objective: ${currentObjective ?? 'None'}

## Recent Events:
${logLines || 'None'}

## Inventory Items:
${inventoryLines || 'None'}

## Known Places:
${mapLines || 'None'}

## Current Facts:
${factLines}

Identify sets of facts that could be merged into a single, more specific statement.
Delete facts that reference obsolete quests, objectives, conditions, items or places. If merging or deleting, provide instructions.
`;
};
