/**
 * @file itemDirectives.ts
 * @description Minimal-model helper to classify ambiguous item directives.
 */

import { GenerateContentResponse } from '@google/genai';
import { MINIMAL_MODEL_NAME, LOADING_REASON_UI_MAP, MAX_RETRIES } from '../../constants';
import { ItemDirective } from '../../types';
import { dispatchAIRequest } from '../modelDispatcher';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { retryAiCall } from '../../utils/retry';
import { safeParseJson } from '../../utils/jsonUtils';

export interface ResolveItemDirectivesParams {
  directives: Array<ItemDirective>;
  sceneDescription?: string;
  logMessage?: string;
  knownInventoryItemIds?: Array<string>;
  knownWrittenItemIds?: Array<string>;
  holderNames?: Record<string, string>;
}

interface DirectiveResolution {
  directiveId: string;
  instruction?: string;
  itemIds?: Array<string> | string;
  metadata?: Record<string, unknown>;
  provisionalNames?: Array<string>;
  suggestedHandler: 'inventory' | 'librarian' | 'either';
}

const DIRECTIVE_RESOLUTION_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      directiveId: {
        type: 'string',
        description: 'Directive id to classify (e.g., note-foo-1a2b).',
      },
      instruction: {
        type: 'string',
        description: 'Optional clarified instruction (keep concise).',
      },
      itemIds: {
        oneOf: [
          { type: 'string' },
          {
            type: 'array',
            items: { type: 'string' },
          },
        ],
        description: 'Optional narrowed item ids relevant to this directive.',
      },
      metadata: {
        type: 'object',
        description: 'Optional extra metadata from the router (urgency, confidence).',
      },
      provisionalNames: {
        type: 'array',
        description: 'Optional provisional names for unidentified items.',
        items: { type: 'string' },
      },
      suggestedHandler: {
        enum: ['inventory', 'librarian', 'either'],
        description: 'Target handler for this directive.',
      },
    },
    propertyOrdering: [
      'directiveId',
      'instruction',
      'itemIds',
      'metadata',
      'provisionalNames',
      'suggestedHandler',
    ],
    required: ['directiveId', 'suggestedHandler'],
    additionalProperties: false,
  },
} as const;

export const resolveItemDirectives = async ({
  directives,
  sceneDescription,
  logMessage,
  knownInventoryItemIds = [],
  knownWrittenItemIds = [],
  holderNames = {},
}: ResolveItemDirectivesParams): Promise<Array<ItemDirective> | null> => {
  const ambiguous = directives.filter(
    d => !d.suggestedHandler || d.suggestedHandler === 'unknown' || d.suggestedHandler === 'either',
  );
  if (ambiguous.length === 0) {
    return directives;
  }

  const directiveList = ambiguous
    .map(
      d =>
        `<ID: ${d.directiveId}> - ${d.instruction}${d.itemIds ? ` (itemIds: ${JSON.stringify(d.itemIds)})` : ''}${
          d.provisionalNames?.length ? ` (provisional: ${d.provisionalNames.join(', ')})` : ''
        }${d.suggestedHandler ? ` (suggested: ${d.suggestedHandler})` : ''}`,
    )
    .join('\n');
  const holderCatalog = Object.entries(holderNames)
    .map(([id, name]) => `<ID: ${id}> - ${name}`)
    .join('\n');

  const prompt = [
    'Classify each item directive into inventory vs librarian. Prefer librarian for written/page/book/map/picture content; prefer inventory for gear, status effects, equipment, and physical moves/changes.',
    'If unsure, set suggestedHandler to "either". Keep instructions concise; do not invent new directives.',
    sceneDescription ? `Scene: ${sceneDescription}` : null,
    logMessage ? `Log: ${logMessage}` : null,
    knownInventoryItemIds.length ? `Known inventory item ids: ${knownInventoryItemIds.map(id => `<ID: ${id}>`).join(', ')}` : null,
    knownWrittenItemIds.length ? `Known written item ids: ${knownWrittenItemIds.map(id => `<ID: ${id}>`).join(', ')}` : null,
    holderCatalog ? `Holder catalog:\n${holderCatalog}` : null,
    'Directives to classify:',
    directiveList,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await retryAiCall<{
    response: GenerateContentResponse;
    promptUsed: string;
    systemInstructionUsed: string;
    jsonSchemaUsed?: unknown;
  }>(async () => {
    addProgressSymbol(LOADING_REASON_UI_MAP.storyteller.icon);
    const { response, promptUsed, systemInstructionUsed, jsonSchemaUsed } = await dispatchAIRequest({
      modelNames: [MINIMAL_MODEL_NAME],
      prompt,
      systemInstruction:
        'Return only JSON per schema. Do not add new directives. Keep instructions concise and faithful to inputs.',
      jsonSchema: DIRECTIVE_RESOLUTION_SCHEMA,
      temperature: 0.2,
    });
    return { result: { response, promptUsed, systemInstructionUsed, jsonSchemaUsed } };
  }, MAX_RETRIES);

  if (!result) return null;
  const parsed = safeParseJson<unknown>(result.response.text ?? '');
  const parsedArray = Array.isArray(parsed) ? parsed : null;
  if (!parsedArray) return directives;

  const resolutions: Array<DirectiveResolution> = [];
  for (const entry of parsedArray) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<DirectiveResolution>;
    const directiveId =
      typeof candidate.directiveId === 'string' ? candidate.directiveId.trim() : '';
    const handler = candidate.suggestedHandler;
    if (!directiveId) continue;
    if (handler !== 'inventory' && handler !== 'librarian' && handler !== 'either') continue;
    resolutions.push({ ...candidate, directiveId, suggestedHandler: handler } as DirectiveResolution);
  }
  if (resolutions.length === 0) return directives;

  const byId = new Map<string, DirectiveResolution>();
  resolutions.forEach(res => byId.set(res.directiveId, res));

  const merged: Array<ItemDirective> = directives.map(d => {
    const res = byId.get(d.directiveId);
    if (!res) return d;
    return {
      ...d,
      instruction: res.instruction ?? d.instruction,
      itemIds: res.itemIds ?? d.itemIds,
      metadata: res.metadata ?? d.metadata,
      provisionalNames: res.provisionalNames ?? d.provisionalNames,
      suggestedHandler: res.suggestedHandler,
    };
  });

  return merged;
};
