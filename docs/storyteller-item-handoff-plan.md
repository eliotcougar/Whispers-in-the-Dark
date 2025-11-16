# Storyteller Item Handoff Plan

## Goal
Transition the Storyteller service from a hybrid narrator+item bookkeeper into a high-level narrative orchestrator. Item bookkeeping (creation, movement, updates, destruction, written content) will be delegated to Inventory AI and Librarian AI. The Storyteller will emit lightweight item directives instead of pre-aggregated hints (`playerItemsHint`, `worldItemsHint`, `npcItemsHint`, `librarianHint`, `newItems`).

## High-Level Flow (Target)
1. Storyteller produces narrative output plus `itemDirectives` (array of free-form instructions).
2. Optional auxiliary router consumes the directives and partitions them into Inventory vs Librarian workloads, eliminating duplicate handling.
3. Inventory AI and Librarian AI read their respective directive subsets, apply system prompts to build final item updates, and output deterministic JSON updates.
4. Game state updater applies Inventory/Librarian results; Storyteller focuses on narrative consistency.

## Proposed Storyteller Output Contract
Replace current hint fields with a single array. The directives stay lightweight: they are free-form instructions with optional pointers to affected items, leaving structured JSON generation to the downstream services.

```ts
interface ItemDirective {
  /** Unique within the turn; keep short e.g. "note-3fj2" for traceability */
  directiveId: string;
  /** Optional pointer(s) to relevant item IDs already known to the game state */
  itemIds?: string | Array<string>;
  /** Optional provisional labels for items that do not yet exist */
  provisionalNames?: Array<string>;
  /** Optional hint suggesting which service should handle it */
  suggestedHandler?: 'inventory' | 'librarian' | 'either' | 'unknown';
  /** Free-form instruction describing the observed or required change */
  instruction: string;
  /** Optional metadata for future extensions (urgency, confidence, etc.) */
  metadata?: Record<string, unknown>;
}
```

Add to `GameStateFromAI`:
```ts
  itemDirectives?: Array<ItemDirective>;
```

### Storyteller Prompt Changes
- System prompt: remove explicit instructions for writing the four hints/newItems; replace with directive to populate `itemDirectives` per the schema above, emphasising concise actionable text.
- Prompt builder: keep inventories/known uses/locations in context so the storyteller can reference item IDs when possible; avoid hint-specific reminders.
- Add examples that demonstrate the minimum descriptive payload for a directive (e.g., state transitions, item type cues, new item appearance/function) so downstream services can reconstruct full schema entries without guesswork.

## Auxiliary Item Router (Optional AI Call)
Introduce a lightweight service (`services/itemDispatch`) that ensures each directive is handled exactly once.

### Input
```ts
interface ItemDispatchRequest {
  directives: Array<ItemDirective>;
  knownInventoryItemIds: Array<string>;
  knownWrittenItemIds: Array<string>;
}
```

### Output
```ts
interface ItemDispatchResponse {
  inventoryDirectives: Array<ItemDirective>;
  librarianDirectives: Array<ItemDirective>;
  sharedDirectives: Array<ItemDirective>; // explicitly mark shared work
  unresolvedDirectives: Array<ItemDirective>; // router could not classify
  rationale: string; // short natural-language explanation for logging/debug
}
```

### Routing Strategy
1. **Deterministic pass:** If `suggestedHandler` narrows the target, route accordingly. Otherwise inspect directive text and IDs (e.g., references to “chapter”, “page”, or known written item IDs → Librarian; equipment/gear terms or regular item IDs → Inventory).
2. **Conflict resolution:** For ambiguous directives, invoke the auxiliary router AI to disambiguate or split the instruction. The router may emit derived directives with suffixed IDs (`note-3fj2-A`) when a single instruction drives multiple downstream updates.
3. **Duplicate prevention:** Inventory and Librarian receive disjoint directive lists plus any explicitly shared entries. Downstream responses echo `directiveId`, enabling supervisor logic to ensure each directive is acknowledged exactly once.
4. **Fallback:** If the router leaves anything unresolved, log and surface in UI/debug, optionally retry with developer assistance.

## Inventory AI Updates
- Prompt builder: consume `inventoryDirectives`, rendering them in a dedicated section (e.g., `## Item Directives (Regular)`), replacing `playerItemsHint`, `worldItemsHint`, `npcItemsHint`, and `newItems`.
- System prompt: instruct the model to interpret each directive, resolve the implied actions, and produce the standard `create`/`move`/`change` JSON outputs.
- Schema change: expand request payload to include `directives`. Inventory AI output should reference `directiveId` to confirm which instructions were applied.
- Additional context to surface in the prompt builder:
  - For every directive, show the raw instruction text plus any matched in-memory item records (ID, name, type, description, holder) so the AI can validate manipulations without reconstructing state from scratch.
  - When a directive references a location holder (node ID) include a short plain-language label for that node using existing map metadata.
  - When provisional names are present (new items) capture the storyteller wording verbatim and remind the AI that full schema fields must be synthesised from that prose.

### Suggested Output snippet
```json
{
  "directiveId": "note-lantern-3fj2",
  "observations": "Storyteller indicated the player lights the lantern.",
  "create": [],
  "move": [],
  "change": [
    {
      "id": "item-old-lantern-7fr4",
      "name": "Old Lantern",
      "isActive": true
    }
  ]
}
```

## Librarian AI Updates
- Mirror the Inventory changes but for `librarianDirectives`.
- Encourage the model to interpret narrative cues about new pages/chapters even when no structured chapter breakdown is provided; generate structured content only inside the Librarian response.
- Include `directiveId` echoes in responses to simplify auditing and prevent duplicate work.
- Prompt builder additions:
  - Render each directive with instruction text, any supplied provisional names, and linked item metadata for referenced IDs (including existing chapter summaries where available).
  - Keep a “Relevant Scene Excerpt” snippet (scene description + log message) near the directives so the Librarian can infer tone and content details even if the storyteller kept the directive terse.

## Required Context for Directive Execution (Inventory & Librarian)
To allow every create/move/change/destroy action without guessing, the prompt builders must supply all of the following alongside the directives:
- **Item records:** Full schema for referenced items (id, name, type, description, tags, knownUses with on/off variants, isActive, holderId, condition fields, stack counts, written content summaries for books/scrolls). This enables safe `change` actions (toggles, renames, tag updates) without hallucinating state.
- **Holder catalog:** Player entry plus all valid holder IDs with human-readable labels and types (map nodes with placeName/type/parent if relevant; NPCs with name/aliases/presenceStatus/location). This is required for `create`/`move` decisions and holder validation.
- **New-item scaffolding:** Allowed item types (regular vs written), any template defaults (e.g., chapter count expectations), and the storyteller’s provisional names/type cues from directives so the AI can synthesise full schema objects.
- **Location context:** Short scene/log snippet and current map node labels so the AI can infer where to place newly created items or written clues even when the directive omits an explicit holder.
- **Duplication guards:** Existing item and written titles per holder (including known aliases) so the AI can avoid duplicate creates and pick the right target for `change`/`destroy`.
- **Safety rails:** The shared create/move/destroy contract, holder-type rules, and dedicated-button/knownUses warnings from `prompts/helperPrompts.ts` to prevent invalid operations.

## Supervisor / State Application Changes
1. Update turn-processing pipeline to call the router after Storyteller, before Inventory/Librarian.
2. Change data model (`GameStateFromAI`) consumers to handle absence of old hints and depend solely on directives.
3. Modify `turnReducer` (or equivalent store logic) to read `directiveId`s and confirm each directive is processed once; raise warnings otherwise.
4. Adjust persistence schema if hints were stored in save files; ensure migration script handles new structure.

## Migration Plan
1. **Discovery:** Instrument the current turn processor to log actual item updates from Inventory/Librarian to inform directive examples and router rules.
2. **Cutover:** Storyteller emits only `itemDirectives`; Inventory/Librarian consume only routed directives. Remove legacy hint/newItems paths from prompts, parsers, and reducers in the same change.
3. **Cleanup:** Update docs, tests, snapshot fixtures, save-game schema, and remove redundant helper strings.

## Testing Checklist
- Parser unit tests for `itemDirectives` (validations, error handling).
- Router tests covering deterministic and AI-assisted branches, duplicate detection, unresolved flows.
- Integration tests verifying Inventory/Librarian outputs match existing behaviour across representative scenarios (create, move, destroy, written pages, mixed items).
- Regression tests for Storyteller output to ensure narrative unchanged and map/NPC logic unaffected.
- Save/load tests to ensure new structure is persisted and restored correctly.

## Observability & Tooling
- Add debug overlay listing directive IDs, router decisions, and downstream acknowledgements.
- Extend developer console command to re-run router on-demand during QA.
- Telemetry: percentage of directives routed deterministically vs AI-assisted, unresolved counts, latency impact.

## Turn Simulation Notes
- **Scenario A – Picking up an existing item:** Storyteller directive `"note-lantern-3fj2"` (itemIds: `"item-old-lantern-7fr4"`, instruction: "Player snatches the Old Lantern from the workbench and tucks it into their satchel, keeping it unlit."). Inventory prompt must surface both the directive text and the full lantern record (type `equipment`, current holder `node-workshop-1b4d`) so the AI can issue a `move` and optional `change` (isActive false). Without the item record, the downstream AI would have to infer tags/knownUses from memory.
- **Scenario B – Newly discovered written clue:** Storyteller directive `"note-etched-plate-9kdm"` (provisionalNames: `["Etched Plague Tablet"]`, suggestedHandler: `librarian`, instruction: "A bronze tablet etched with rituals slides from the altar; its script describes the rite of cleansing in three stanzas."). Librarian prompt must provide the directive, nearby scene snippet, and node label to decide where the tablet lives, plus guidance that the storyteller description must be transformed into chapters. Resulting response creates a `book` item with three chapter entries, derived from the prose.
- **Scenario C – Mixed operations:** Directive `"note-tonic-1pqa"` (instruction: "Raen mixes two vials and leaves the resulting Nightglass Tonic on the infirmary tray for anyone to take.", no itemIds). Router should send this to Inventory with an empty ID list; prompt builder must remind the AI that it needs to create a new item and assign it to the infirmary node, even though the storyteller omitted schema specifics. This illustrates why the storyteller instructions must mention item type cues ("tonic", "potion") and purpose so the inventory AI can fill structured fields.
- **Takeaway:** Both prompt builders need to accompany each directive with (a) mapped item records where IDs exist, (b) clear location labels, and (c) the latest scene/log snippets, otherwise downstream models will lack the structured hints previously carried in the old `*_ItemsHint` strings. Storyteller prompts should explicitly require descriptive phrases for type, function, and state to keep directives actionable.

## Open Questions / Follow-Ups
- Should the Storyteller include short quotes or bullet lists when describing newly revealed written content, or rely purely on prose that the Librarian interprets?
- Should the router ever split a single directive into multiple? If so, define naming convention (`directive-foo-XXXX-a`).
- Does the Inventory/Librarian output need to reference original directive IDs in every action, or can we rely on ordering? (Recommendation: include `directiveId` for clarity.)
- How should we handle interdependent operations (e.g., item transformed then read)? Possibly allow a single directive to describe multiple phases and rely on downstream services to coordinate via `sharedDirectives`.
- Decide whether auxiliary router uses deterministic logic only or may call a minimal model (e.g., `gemini-flash-lite`) for ambiguous cases; specify budget and rate limiting.
- Storyteller directive guidelines need concrete prompts/examples to guarantee that new-item creations carry enough descriptive detail (type, purpose, activation rules) for downstream services to synthesise valid JSON without guessing.

## Checklist for Implementation
- [x] Extend `GameStateFromAI` types and validation to support `itemDirectives`.
- [x] Update Storyteller prompts (system + examples) and response parser to emit/accept the new directives; remove hint/newItems handling.
- [x] Implement `services/itemDispatch` (deterministic classifier + optional AI fallback) and wire it into the turn pipeline.
- [x] Adjust Inventory and Librarian prompt builders/system prompts to consume routed directives, including echoing `directiveId` in responses.
- [ ] Update Inventory/Librarian response schemas and reducers to guard against duplicate processing using directive IDs.
- [x] Refresh helper literals in `prompts/helperPrompts.ts` to document the new directive schema and delete legacy hint guidance.
- [x] Revise save/load and serialization logic to keep `itemDirectives` transient (legacy hint fields already dropped from saves).
- [ ] Expand unit/integration test coverage and add telemetry/dashboards noted above.
- [ ] Clean up deprecated hint fields, helpers, and documentation after rollout completes.
