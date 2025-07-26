import { VALID_ACTIONS_STRING, WRITING_ITEM_TYPES_STRING, TEXT_STYLE_TAGS_STRING } from '../../constants';

export const SYSTEM_INSTRUCTION = `**SYSTEM INSTRUCTIONS**
You manage books, pages and maps in the world. Respond with JSON describing item changes.
Only use item types: ${WRITING_ITEM_TYPES_STRING}.
Actions available: ${VALID_ACTIONS_STRING}.
Written items must use one of the text style tags: ${TEXT_STYLE_TAGS_STRING}.`;
