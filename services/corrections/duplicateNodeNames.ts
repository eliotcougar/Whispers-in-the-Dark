/**
 * @file services/corrections/duplicateNodeNames.ts
 * @description Helper for renaming duplicate map nodes via Minimal AI.
 */
import {
  AdventureTheme,
  MapNode,
  MinimalModelCallRecord,
} from '../../types';
import {
  MINIMAL_MODEL_NAME,
  GEMINI_LITE_MODEL_NAME,
  GEMINI_MODEL_NAME,
  CORRECTION_TEMPERATURE,
  LOADING_REASON_UI_MAP,
  MAX_RETRIES,
} from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { retryAiCall } from '../../utils/retry';
import { isApiConfigured } from '../geminiClient';

export interface NodeRenameResult {
  nodeId: string;
  newName: string;
}

export const assignSpecificNamesToDuplicateNodes = async (
  nodes: Array<MapNode>,
  theme: AdventureTheme,
  debugLog?: Array<MinimalModelCallRecord>,
): Promise<Array<NodeRenameResult>> => {
  if (!isApiConfigured()) {
    console.error('assignSpecificNamesToDuplicateNodes: API Key not configured.');
    return [];
  }

  const nameGroups = new Map<string, Array<MapNode>>();
  nodes.forEach(node => {
    const key = node.placeName.toLowerCase();
    const arr = nameGroups.get(key) ?? [];
    arr.push(node);
    nameGroups.set(key, arr);
  });

  const renames: Array<NodeRenameResult> = [];

  for (const group of Array.from(nameGroups.values())) {
    if (group.length <= 1) continue;
    // keep the first node name unchanged
    for (let i = 1; i < group.length; i += 1) {
      const node = group[i];
      const prompt = `You are an AI assistant disambiguating map location names in a text adventure game.\n` +
        `Theme: "${theme.name}"\n` +
        `Another map node shares the name "${group[0].placeName}". Provide a short, unique new name for the following node.\n` +
        `Node Type: ${node.type}\n` +
        `Aliases: ${(node.aliases ?? []).join(', ') || 'None'}\n` +
        `Description: ${node.description}`;
      const systemInstruction =
        'Respond ONLY with a short Title Case name that distinguishes this location.';

      const result = await retryAiCall<string>(async attempt => {
        try {
          addProgressSymbol(LOADING_REASON_UI_MAP.corrections.icon);
          const { response } = await dispatchAIRequest({
            modelNames: [MINIMAL_MODEL_NAME, GEMINI_LITE_MODEL_NAME, GEMINI_MODEL_NAME],
            prompt,
            systemInstruction,
            temperature: CORRECTION_TEMPERATURE,
            label: 'Corrections',
            debugLog,
          });
          const aiResponse = response.text?.trim();
          if (aiResponse) {
            const cleaned = aiResponse.replace(/^['"]+|['"]+$/g, '').trim();
            if (cleaned) {
              return { result: cleaned };
            }
          }
        } catch (error: unknown) {
          console.error(
            `assignSpecificNamesToDuplicateNodes error (Attempt ${String(attempt + 1)}/${String(
              MAX_RETRIES + 1,
            )}):`,
            error,
          );
          throw error;
        }
        return { result: null };
      });

      if (result) {
        renames.push({ nodeId: node.id, newName: result });
      }
    }
  }

  return renames;
};

