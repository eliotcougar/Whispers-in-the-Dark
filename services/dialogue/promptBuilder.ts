/**
 * @file promptBuilder.ts
 * @description Helper functions for constructing dialogue-related prompts.
 */
import {
  DialogueSummaryContext,
  DialogueMemorySummaryContext,
  DialogueTurnContext,
} from '../../types';
import {
  MAX_DIALOGUE_SUMMARIES_IN_PROMPT,
  MAIN_TURN_OPTIONS_COUNT,
} from '../../constants';
import { formatKnownPlacesForPrompt } from '../../utils/promptFormatters/map';

/**
 * Builds the prompt used to fetch the next dialogue turn.
 */
export const buildDialogueTurnPrompt = (
  context: DialogueTurnContext,
): string => {
  const {
    currentTheme,
    currentQuest,
    currentObjective,
    currentScene,
    localTime,
    localEnvironment,
    localPlace,
    knownMainMapNodesInTheme,
    knownNPCsInTheme: knownNPCsInTheme,
    inventory,
    playerGender,
    dialogueHistory,
    playerLastUtterance,
    dialogueParticipants,
    relevantFacts,
  } = context;
  let historyToUseInPrompt = [...dialogueHistory];
  if (
    historyToUseInPrompt.length > 0 &&
    historyToUseInPrompt[historyToUseInPrompt.length - 1].speaker.toLowerCase() === 'player' &&
    historyToUseInPrompt[historyToUseInPrompt.length - 1].line === playerLastUtterance
  ) {
    historyToUseInPrompt = historyToUseInPrompt.slice(0, -1);
  }

  // Trim Narrator THOUGHTS from all but the most recent NPC responses
  const trimmedHistory = historyToUseInPrompt.map(entry => ({ ...entry }));
  let foundLastPlayer = false;
  for (let i = trimmedHistory.length - 1; i >= 0; i--) {
    const entry = trimmedHistory[i];
    if (entry.speaker.toLowerCase() === 'player') {
      foundLastPlayer = true;
    } else if (foundLastPlayer && 'thought' in entry) {
      delete entry.thought;
    }
  }

  const historyString = trimmedHistory
    .map(entry => {
      const thought = entry.thought ? `Narrator THOUGHTS: "${entry.thought}"\n` : '';
      return `${thought}${entry.speaker}: "${entry.line}"`;
    })
    .join('\n');

    const inventoryString =
      inventory.length > 0
        ? inventory.map(item => `${item.name} (Type: ${item.type}, Active: ${String(!!item.isActive)})`).join(', ')
        : 'Empty';
  const knownPlacesString = formatKnownPlacesForPrompt(
    knownMainMapNodesInTheme,
    true,
    false,
  );

  let npcContextString = '## Known NPCs: ';
  if (knownNPCsInTheme.length > 0) {
    npcContextString +=
      knownNPCsInTheme
        .map(npc => {
          let npcStr = `"${npc.name}" (Description: ${npc.description}; Presence: ${npc.presenceStatus}`;
          if (npc.presenceStatus === 'nearby' || npc.presenceStatus === 'companion') {
            npcStr += ` at ${npc.preciseLocation ?? 'around'}`;
          } else {
            npcStr += `, last seen: ${npc.lastKnownLocation ?? 'Unknown'}`;
          }
          npcStr += ')';
          return npcStr;
        })
        .join('; ') + '.';
  } else {
    npcContextString += 'None specifically known.';
  }

  let pastDialogueSummariesContext = '';
  dialogueParticipants.forEach(participantName => {
    const participantNPC = knownNPCsInTheme.find(npc => npc.name === participantName);
    if (participantNPC?.dialogueSummaries && participantNPC.dialogueSummaries.length > 0) {
      pastDialogueSummariesContext += `\nRecent Past Conversations involving ${participantName}:\n`;
      const summariesToShow = participantNPC.dialogueSummaries.slice(-MAX_DIALOGUE_SUMMARIES_IN_PROMPT);
      summariesToShow.forEach(summary => {
        pastDialogueSummariesContext += `- Summary: "${summary.summaryText}" (Participants: ${summary.participants.join(', ')}; Time: ${summary.timestamp}; Location: ${summary.location})\n`;
      });
    }
  });

  const relevantFactsSection =
    relevantFacts.length > 0
      ? relevantFacts.map(f => `- ${f}`).join('\n')
      : 'None';

  return `**Context for Dialogue Turn**
Current Theme: "${currentTheme.name}";
System Instruction Modifier for Theme: "${currentTheme.systemInstructionModifier}";
Current Main Quest: "${currentQuest ?? 'Not set'}";
Current Objective: "${currentObjective ?? 'Not set'}";
Scene Description (for environmental context): "${currentScene}";
Local Time: "${localTime ?? 'Unknown'}", Environment: "${localEnvironment ?? 'Undetermined'}", Place: "${localPlace ?? 'Undetermined'}";
Player's Character Gender: ${playerGender};

## Relevant Facts about the world:
${relevantFactsSection}

## Player's Inventory:
${inventoryString}

## Known Locations:
${knownPlacesString}

${npcContextString}

## Dialogue Context:
- Current Dialogue Participants: ${dialogueParticipants.join(', ')};
${pastDialogueSummariesContext.trim() ? pastDialogueSummariesContext : '\n- No specific past dialogue summaries available for current participants.'}

- Dialogue History (most recent last; lines starting with THOUGHT describe internal thoughts):
${historyString}

- Player's Last Utterance/Choice: "${playerLastUtterance}"

Based on this context, provide the next part of the dialogue according to the DIALOGUE_SYSTEM_INSTRUCTION.
The NPC(s) should respond to the player's last utterance, taking into account any relevant past conversation summaries.
Provide new dialogue options, ensuring the last one is a way to end the dialogue.
`;
};

/**
 * Builds the prompt used for summarizing a completed dialogue.
 */
export const buildDialogueSummaryPrompt = (
  summaryContext: DialogueSummaryContext,
): string => {
  const dialogueLogString = summaryContext.dialogueLog.map(entry => `${entry.speaker}: "${entry.line}"`).join('\n');
  const inventoryString =
    summaryContext.inventory.length > 0
      ? summaryContext.inventory.map(item => `${item.name} (Type: ${item.type})`).join(', ')
      : 'Empty';
  const knownPlacesString = formatKnownPlacesForPrompt(
    summaryContext.mapDataForTheme.nodes.filter(
      n => n.data.nodeType !== 'feature',
    ),
    true,
    false,
  );

  let knownNPCsString = 'Known NPCs: ';
  if (summaryContext.knownNPCsInTheme.length > 0) {
    knownNPCsString +=
      summaryContext.knownNPCsInTheme
        .map(npc => {
          let npcStr = `"${npc.name}" (Description: ${npc.description}; Presence: ${npc.presenceStatus}`;
          if (npc.presenceStatus === 'nearby' || npc.presenceStatus === 'companion') {
            npcStr += ` at ${npc.preciseLocation ?? 'around'}`;
          } else {
            npcStr += `, last seen: ${npc.lastKnownLocation ?? 'Unknown'}`;
          }
          npcStr += ')';
          return npcStr;
        })
        .join('; ') + '.';
  } else {
    knownNPCsString += 'None specifically known.';
  }

  return `
Context for Dialogue Summary:
- Current Theme: "${summaryContext.currentThemeObject?.name ?? summaryContext.themeName}"
- System Instruction Modifier for Theme: "${summaryContext.currentThemeObject?.systemInstructionModifier ?? 'None'}"
- Current Main Quest (before dialogue): "${summaryContext.mainQuest ?? 'Not set'}"
- Current Objective (before dialogue): "${summaryContext.currentObjective ?? 'Not set'}"
- Scene Description (when dialogue started): "${summaryContext.currentScene}"
- Local Time: "${summaryContext.localTime ?? 'Unknown'}", Environment: "${summaryContext.localEnvironment ?? 'Undetermined'}", Place: "${summaryContext.localPlace ?? 'Undetermined'}"
- Player's Character Gender: "${summaryContext.playerGender}"

- Player's Inventory (before dialogue):
${inventoryString}
- Known Locations (before dialogue):
${knownPlacesString}
- ${knownNPCsString}
- Dialogue Participants: ${summaryContext.dialogueParticipants.join(', ')}

## Full Dialogue Transcript:
${dialogueLogString}

Based *only* on the Dialogue Transcript and the provided context, determine what specific game state changes (items, NPCs, quest/objective updates, log message, map updates) resulted *directly* from this dialogue.
The "logMessage" field in your response should be a concise summary suitable for the main game log.
Provide the next scene description and ${String(MAIN_TURN_OPTIONS_COUNT)} action options for the player as you would for a normal game turn.
If the dialogue revealed a new alias for an existing NPC, use "npcsUpdated" with "addAlias".
If the dialogue changed some NPC's general whereabouts, use "newLastKnownLocation" in "npcsUpdated".
If the dialogue revealed new map information (new locations, changed accessibility, etc.), or if Player's own location changed over the course of the dialogue, then set "mapUpdated": true.
`;
};

/**
 * Builds the system and user prompt parts for a dialogue memory summary.
 */
export const buildDialogueMemorySummaryPrompts = (
  context: DialogueMemorySummaryContext,
): { systemInstructionPart: string; userPromptPart: string } => {
  const dialogueLogString = context.dialogueLog.map(entry => `  ${entry.speaker}: ${entry.line}`).join('\n');

  const systemInstructionPart = `You are an AI assistant creating a detailed memory of a conversation. This memory will be remembered by the NPCs who participated.
Your task is to write a concise yet detailed summary of the conversation.
The summary should be between 500 and 1500 characters. It should be written from the point of view of the Conversation Participants other than the Player.
The summary should ALWAYS mention all names and the "Player" explicitly without pronouns.
It should capture:
- Key topics discussed.
- Important information revealed or exchanged by any participant.
- Significant decisions made or outcomes reached.
- The overall emotional tone or atmosphere of the conversation.
- Any impressions or key takeaways the NPCs might have.

Output ONLY the summary text. Do NOT use JSON or formatting. Do NOT include any preamble like "Here is the summary:".`;

  const userPromptPart = `Generate a memory summary for the following conversation:
- Conversation Participants: ${context.dialogueParticipants.join(', ')}
- Theme: "${context.currentThemeObject?.name ?? context.themeName}" (${context.currentThemeObject?.systemInstructionModifier ?? 'None'})
- Scene at the start of conversation: "${context.currentScene}"
- Context: Time: "${context.localTime ?? 'Unknown'}", Environment: "${context.localEnvironment ?? 'Undetermined'}", Place: "${context.localPlace ?? 'Undetermined'}"

## Full Dialogue Transcript:
${dialogueLogString}

Output ONLY the summary text. Do NOT use JSON or formatting. Do NOT include any preamble like "Here is the summary:".`;

  return { systemInstructionPart, userPromptPart };
};
