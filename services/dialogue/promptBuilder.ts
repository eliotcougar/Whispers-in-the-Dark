/**
 * @file promptBuilder.ts
 * @description Helper functions for constructing dialogue-related prompts.
 */
import {
  DialogueSummaryContext,
  DialogueMemorySummaryContext,
  DialogueTurnContext,
} from '../../types';
import { MAX_DIALOGUE_SUMMARIES_IN_PROMPT } from '../../constants';
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
    knownCharactersInTheme,
    inventory,
    playerGender,
    dialogueHistory,
    playerLastUtterance,
    dialogueParticipants,
  } = context;
  let historyToUseInPrompt = [...dialogueHistory];
  if (
    historyToUseInPrompt.length > 0 &&
    historyToUseInPrompt[historyToUseInPrompt.length - 1].speaker.toLowerCase() === 'player' &&
    historyToUseInPrompt[historyToUseInPrompt.length - 1].line === playerLastUtterance
  ) {
    historyToUseInPrompt = historyToUseInPrompt.slice(0, -1);
  }

  const historyString = historyToUseInPrompt
    .map(entry => {
      const thought = entry.thought ? `Narrator THOUGHTS: "${entry.thought}"\n` : '';
      return `${thought}${entry.speaker}: "${entry.line}"`;
    })
    .join('\n');

  const inventoryString =
    inventory.map(item => `${item.name} (Type: ${item.type}, Active: ${!!item.isActive})`).join(', ') ||
    'Empty';
  const knownPlacesString = formatKnownPlacesForPrompt(knownMainMapNodesInTheme, true);

  let characterContextString = 'Known Characters: ';
  if (knownCharactersInTheme.length > 0) {
    characterContextString +=
      knownCharactersInTheme
        .map(c => {
          let charStr = `"${c.name}" (Description: ${c.description.substring(0, 70)}...; Presence: ${c.presenceStatus}`;
          if (c.presenceStatus === 'nearby' || c.presenceStatus === 'companion') {
            charStr += ` at ${c.preciseLocation || 'around'}`;
          } else {
            charStr += `, last seen: ${c.lastKnownLocation || 'Unknown'}`;
          }
          charStr += ')';
          return charStr;
        })
        .join('; ') + '.';
  } else {
    characterContextString += 'None specifically known.';
  }

  let pastDialogueSummariesContext = '';
  dialogueParticipants.forEach(participantName => {
    const participantChar = knownCharactersInTheme.find(char => char.name === participantName);
    if (participantChar && participantChar.dialogueSummaries && participantChar.dialogueSummaries.length > 0) {
      pastDialogueSummariesContext += `\nRecent Past Conversations involving ${participantName}:\n`;
      const summariesToShow = participantChar.dialogueSummaries.slice(-MAX_DIALOGUE_SUMMARIES_IN_PROMPT);
      summariesToShow.forEach(summary => {
        pastDialogueSummariesContext += `- Summary: "${summary.summaryText}" (Participants: ${summary.participants.join(', ')}; Time: ${summary.timestamp}; Location: ${summary.location})\n`;
      });
    }
  });

  return `
Context for Dialogue Turn:
- Current Theme: "${currentTheme.name}"
- System Instruction Modifier for Theme: "${currentTheme.systemInstructionModifier}"
- Current Main Quest: "${currentQuest || 'Not set'}"
- Current Objective: "${currentObjective || 'Not set'}"
- Scene Description (for environmental context): "${currentScene}"
- Local Time: "${localTime || 'Unknown'}", Environment: "${localEnvironment || 'Undetermined'}", Place: "${localPlace || 'Undetermined'}"
- Player's Character Gender: ${playerGender}
- Player's Inventory: ${inventoryString}
- Known Locations: ${knownPlacesString}
- ${characterContextString}
- Current Dialogue Participants: ${dialogueParticipants.join(', ')}
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
  const inventoryString = summaryContext.inventory.map(item => `${item.name} (Type: ${item.type})`).join(', ') || 'Empty';
  const knownPlacesString = formatKnownPlacesForPrompt(
    summaryContext.mapDataForTheme.nodes.filter(n => n.data.nodeType !== 'feature'),
    true,
  );

  let knownCharactersString = 'Known Characters: ';
  if (summaryContext.knownCharactersInTheme.length > 0) {
    knownCharactersString +=
      summaryContext.knownCharactersInTheme
        .map(c => {
          let charStr = `"${c.name}" (Description: ${c.description.substring(0, 70)}...; Presence: ${c.presenceStatus}`;
          if (c.presenceStatus === 'nearby' || c.presenceStatus === 'companion') {
            charStr += ` at ${c.preciseLocation || 'around'}`;
          } else {
            charStr += `, last seen: ${c.lastKnownLocation || 'Unknown'}`;
          }
          charStr += ')';
          return charStr;
        })
        .join('; ') + '.';
  } else {
    knownCharactersString += 'None specifically known.';
  }

  return `
Context for Dialogue Summary:
- Current Theme: "${summaryContext.currentThemeObject!.name}"
- System Instruction Modifier for Theme: "${summaryContext.currentThemeObject!.systemInstructionModifier}"
- Current Main Quest (before dialogue): "${summaryContext.mainQuest || 'Not set'}"
- Current Objective (before dialogue): "${summaryContext.currentObjective || 'Not set'}"
- Scene Description (when dialogue started): "${summaryContext.currentScene}"
- Local Time: "${summaryContext.localTime || 'Unknown'}", Environment: "${summaryContext.localEnvironment || 'Undetermined'}", Place: "${summaryContext.localPlace || 'Undetermined'}"
- Player's Character Gender: "${summaryContext.playerGender}"
- Player's Inventory (before dialogue): ${inventoryString}
- Known Locations (before dialogue): ${knownPlacesString}
- ${knownCharactersString}
- Dialogue Participants: ${summaryContext.dialogueParticipants.join(', ')}

Full Dialogue Transcript:
${dialogueLogString}

Based *only* on the Dialogue Transcript and the provided context, determine what concrete game state changes (items, characters, quest/objective updates, log message, map updates) resulted *directly* from this dialogue.
The "logMessage" field in your response should be a concise summary suitable for the main game log.
Provide the next scene description and FOUR action options for the player as you would for a normal game turn.
If the dialogue revealed a new alias for an existing character, use "charactersUpdated" with "addAlias".
If the dialogue changed some character's general whereabouts, use "newLastKnownLocation" in "charactersUpdated".
If the dialogue revealed new map information (new locations, changed accessibility, etc.), or if Player's own location changed over the course of the dialogue, then set "mapUpdated": true.
Respond using the SAME JSON structure defined in the SYSTEM_INSTRUCTION for regular turns.
`;
};

/**
 * Builds the system and user prompt parts for a dialogue memory summary.
 */
export const buildDialogueMemorySummaryPrompts = (
  context: DialogueMemorySummaryContext,
): { systemInstructionPart: string; userPromptPart: string } => {
  const dialogueLogString = context.dialogueLog.map(entry => `  ${entry.speaker}: ${entry.line}`).join('\n');

  const systemInstructionPart = `You are an AI assistant creating a detailed memory of a conversation. This memory will be stored by the game characters who participated.
Your task is to write a concise yet detailed summary of the conversation.
The summary should be between 500 and 1500 characters. It should be written from the point of view of the Conversation Participants other than the Player.
The summary should ALWAYS mention all names and the "Player" explicitly without pronouns.
It should capture:
- Key topics discussed.
- Important information revealed or exchanged by any participant.
- Significant decisions made or outcomes reached.
- The overall emotional tone or atmosphere of the conversation.
- Any impressions or key takeaways the characters might have.

Output ONLY the summary text. Do NOT use JSON or formatting. Do NOT include any preamble like "Here is the summary:".`;

  const userPromptPart = `Generate a memory summary for the following conversation:
 - Conversation Participants: ${context.dialogueParticipants.join(', ')}
 - Theme: "${context.currentThemeObject!.name}" (System Modifier: ${context.currentThemeObject!.systemInstructionModifier})
- Scene at start of conversation: "${context.currentScene}"
- Context: Time: "${context.localTime || 'Unknown'}", Environment: "${context.localEnvironment || 'Undetermined'}", Place: "${context.localPlace || 'Undetermined'}"
- Full Dialogue Transcript:
${dialogueLogString}

Output ONLY the summary text. Do NOT use JSON or formatting. Do NOT include any preamble like "Here is the summary:".`;

  return { systemInstructionPart, userPromptPart };
};
