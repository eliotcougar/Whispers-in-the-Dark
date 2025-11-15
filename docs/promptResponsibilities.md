# Prompt Responsibility & Instruction Placement

## Purpose
- Clarify how each AI service splits durable instructions from per-call context so future changes stay aligned.
- Map the responsibilities between every system prompt and its main prompt builders across the game.
- Highlight instruction snippets ripe for extraction into shared literals.

## System vs Main Prompt Responsibilities
- **System prompts** hold persona, output contracts, cross-turn invariants, and safety rails; reuse helpers from `prompts/helperPrompts.ts` so these rules live in one source of truth.
- **Main prompt builders** gather live state (scenes, actions, inventory, map, debug directives) and should only frame how to use that data, never restating schemas or invariant rules already covered by the system prompt.
- **Decision checklist**: if guidance must persist across turns or services, keep it in the system prompt (or a shared literal); if it references volatile state or user choices, keep it in the builder; if multiple services need it, centralize it under `prompts/` and import.

## Service Profiles
### Storyteller
- **System prompt** (`services/storyteller/systemPrompt.ts:8`) casts the model as Dungeon Master, mandates quest/map/NPC tracking, and imports `LOCAL_CONDITIONS_GUIDE` plus `ITEMS_GUIDE` to keep evergreen rules centralized.
- **Prompt builders** (`services/storyteller/promptBuilder.ts:37` and `services/storyteller/promptBuilder.ts:82`) seed new games and assemble turn context: inventories, map state, recent events, travel goals, and optional debug directives.
- **Responsibility split**: the system instruction demands outputs such as `mapHint`, `playerItemsHint`, comma-free names, and dialogue hooks; the builders only surface the structured data required to satisfy those demands.

### Dialogue
- **System prompt** (`services/dialogue/systemPrompt.ts:7`) defines the JSON layout, exit-option rule, and persona constraints for conversational turns.
- **Prompt builders** (`services/dialogue/promptBuilder.ts:54` and `services/dialogue/promptBuilder.ts:181`) curate dialogue history, hero traits, relevant facts, inventory snapshots, and participant memories without reiterating the response schema.
- **Responsibility split**: system-level guardrails enforce option counts and attitude updates, while builders focus on trimming history (e.g., removing narrator thoughts) and inject only the context the schema needs.

### Cartographer
- **System prompt** (`services/cartographer/systemPrompt.ts:9`) codifies map-edit rules, imports hierarchy guides, and restricts destructive edits across both full and simplified modes.
- **Prompt builders** (`services/cartographer/promptBuilder.ts:27` and `services/cartographer/promptBuilder.ts:65`) deliver narrative context, map hints, prior node IDs, and filtered lists of accessible nodes or names to avoid duplicating items/NPCs.
- **Responsibility split**: validation logic (physical locations only, parent-child integrity, deletion safeguards) lives in the system prompt; builders provide the evidence—scene text, hints, existing map excerpts—needed to apply those rules.

### Inventory
- **System prompt** (`services/inventory/systemPrompt.ts:12`) specialises in regular items, enumerating allowed actions, critical create/move/destroy rules, holder constraints, and toggle behaviour.
- **Prompt builder** (`services/inventory/promptBuilder.ts:102`) filters items by allowed types, groups them by holder, embeds hints, and appends any new-item JSON so the system instructions can be followed verbatim.
- **Observation**: helper routines such as `filterAllowedItems`, `groupItemsByHolder`, and NPC inventory formatting mirror the librarian service, making this pair a prime candidate for shared utilities once the instruction literals are unified.

### Librarian
- **System prompt** (`services/librarian/systemPrompt.ts:4`) mirrors the inventory contract but for written items, enforcing chapter counts, tag requirements, and the same create/move/destroy safeguards.
- **Prompt builder** (`services/librarian/promptBuilder.ts:74`) filters the global inventory down to written types, groups by holder, and surfaces new written items before invoking the system prompt’s rules.
- **Responsibility split**: type-specific validation (chapter counts, text tags) stays in the system instruction; the builder’s job is to supply only the items, NPCs, and map context relevant to those rules.

### Loremaster
- **System prompts** (`services/loremaster/systemPrompt.ts:8`, `services/loremaster/systemPrompt.ts:74`, `services/loremaster/systemPrompt.ts:106`, `services/loremaster/systemPrompt.ts:111`) define four distinct modes—extract, integrate, collect, distill—with tailored quality bars, action vocabularies, and examples.
- **Prompt builders** (`services/loremaster/promptBuilder.ts:19`, `services/loremaster/promptBuilder.ts:42`, `services/loremaster/promptBuilder.ts:80`, `services/loremaster/promptBuilder.ts:109`) assemble the corresponding datasets: turn narratives, existing fact lists, log excerpts, inventory and map names, and candidate facts.
- **Responsibility split**: exhaustive checklists (what counts as immutable lore, merge/prune criteria, selection caps) stay stable in the system prompts, while builders slice the game state to match whichever mode is active.

## Instruction Reuse Opportunities
- **Create/Move/Destroy contract**: `services/inventory/systemPrompt.ts:21` and `services/librarian/systemPrompt.ts:14` duplicate the same critical rules (including the “New Items array takes precedence” note); pull this into a shared literal (e.g., `ITEM_UPDATE_RULES`) inside `prompts/helperPrompts.ts` and interpolate it in both system prompts.
- **Holder constraint**: the reminder that `holderId`/`newHolderId` must be `node-*`, `npc-*`, or `player` appears in both `services/inventory/systemPrompt.ts:121` and `services/librarian/systemPrompt.ts:97`; centralize it alongside the create/move/destroy rules.
- **Toggle instructions**: the three-line guidance about paired on/off knownUses exists in `services/inventory/systemPrompt.ts:125` and already lives in `prompts/helperPrompts.ts:163`; keep only the helper version and reference it through a shared literal.
- **Dedicated-button warning**: the “NEVER add ${DEDICATED_BUTTON_USES_STRING} known uses” sentence is repeated at `services/inventory/systemPrompt.ts:129`, `services/librarian/systemPrompt.ts:102`, and `prompts/helperPrompts.ts:168`; expose a single helper string so all prompts read from the same copy.
- **Closing JSON reminder**: the tail lines `Provide the ... update as JSON as described in the SYSTEM_INSTRUCTION` are identical in `services/inventory/promptBuilder.ts:147` and `services/librarian/promptBuilder.ts:114`; consider a small helper like `buildJsonReminder('inventory')` to avoid drift.

## Implementation Tips
- Introduce new global rules by adding them to a helper literal first, then interpolating inside the relevant system prompts.
- Before expanding a system prompt, confirm the prompt builder already supplies the data needed to act on that rule; if not, extend the builder instead of embedding context in the system prompt.
- When prompt builders gain new sections, keep them obviously labelled (mirroring the Storyteller and Cartographer patterns) so downstream parsing stays resilient.
