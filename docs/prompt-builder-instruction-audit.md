# Prompt builder instruction audit

Goal: identify prompt builders that mix model instructions with contextual data so we can keep rules in system prompts and let builders focus on state.

## Builders mixing context with instructions (needs cleanup)
- services/storyteller/promptBuilder.ts:49-74,218-273 – new game and main turn prompts inject creation rules (NPC seeding requirements, REQUIRED fields, "IMPORTANT" replays) alongside scene/context blobs.
- services/dialogue/promptBuilder.ts:171-175,225-232,247-269 – dialogue turn, summary, and memory prompts add response rules (option counts, attitude updates, JSON change handling, word-count limits) instead of only bundling dialogue context/history.

## Builders now contextual
- services/cartographer/promptBuilder.ts – builders now only pass scene, map, and navigation context; JSON/goal rules live in `services/cartographer/systemPrompt.ts`.
- services/inventory/promptBuilder.ts – builder now limits itself to item/map context; safety rails stay in `services/inventory/systemPrompt.ts`.
- services/librarian/promptBuilder.ts – builder now shares written-item context only; creation/update rules live in `services/librarian/systemPrompt.ts`.
- services/loremaster/promptBuilder.ts – extract/integrate/collect/distill builders now send context/fact lists only; selection/merge/output rules live in `services/loremaster/systemPrompt.ts`.

## System prompt coverage notes
- Cartographer system prompt now explicitly requires JSON-only responses.
- Inventory and Librarian system prompts now spell out “prefer existing item/holder IDs; only invent when a directive clearly creates something new.”
- Cartographer simplified system prompt restates the JSON shapes for existing-node vs new-node outputs.
- Loremaster extract system prompt now restates the expected JSON array shape; collect/distill also reiterate JSON-only responses.
