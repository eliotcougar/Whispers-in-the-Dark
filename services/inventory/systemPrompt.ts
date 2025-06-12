/**
 * @file systemPrompt.ts
 * @description System instruction for the inventory AI helper.
 */

import { ITEMS_GUIDE } from '../../prompts/helperPrompts';

export const SYSTEM_INSTRUCTION = `
You assist a text adventure engine with concise inventory updates.
Respond ONLY with a JSON array of ItemChange objects describing the modifications.
${ITEMS_GUIDE}
`;
