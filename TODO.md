# TODO

## Architecture & State Management
- [ ] `components/app/App.tsx:73` – Split the 1,140-line App container into focused shells (layout, HUD, modal manager) so state wiring and effects live closer to their domains.
- [ ] `components/app/App.tsx:75` – Replace the imperative `gameLogicRef`/`getGameLogic()` bridge with a provider or context so hooks like `useSaveLoad` consume stable state without ref lookups.
- [ ] `components/modals/PageView.tsx:1` – Extract the chapter loading/image generation logic into a hook and break the UI into smaller subcomponents to tame the 590-line modal.
- [ ] `hooks/useGameLogic.ts:1` – Decompose the monolithic hook into domain hooks (map, inventory, dialogue, journal) and expose grouped state instead of a 60+ field object.
- [ ] `hooks/useGameLogic.ts:115` – Remove the placeholder `void parseErrorCounter;` by routing parse error tracking back into the retry logic so the state serves a purpose.
- [ ] `hooks/usePlayerActions.ts:404` – Break `handleActionSelect` into discrete stages (prompt build, AI call, fallbacks) to clarify control flow and enable unit testing.
- [ ] `hooks/useGameInitialization.ts:123` – Split `loadInitialGame` into helpers for saved-state hydration, theme selection, and new-game setup to reduce branching inside the callback.

## Performance & Responsiveness
- [ ] `hooks/useProcessAiResponse.ts:60` – Precompute maps of nodes, NPCs, and inventory items so `correctItemChanges` stops scanning arrays on every change.
- [ ] `hooks/useProcessAiResponse.ts:137` – Batch or short-circuit repeated correction service calls so multiple `destroy` fixes do not await sequential network trips.
- [ ] `hooks/usePlayerActions.ts:123` – Cache frequently used collections in `runDistillIfNeeded` instead of recomputing `mapNodes`, player inventory filters, and NPC lookups inside nested loops.
- [x] `hooks/useAutosave.ts:40` – Replace the `JSON.stringify(dependencies)` sentinel with a stable dependency signature to avoid needless effect reruns and string allocations.
- [x] `hooks/useSaveLoad.ts:99` – Reuse the autosave hook/timer instead of maintaining a second nearly identical effect.
- [x] `utils/promptFormatters/map.ts:309` – Build reusable node/edge indexes and share them across connection/nearby helpers so we avoid repeated `find`/`filter` passes and treat undefined edge statuses as traversable defaults.
- [x] `utils/mapUpdateHandlers.ts:33` – Pre-index nodes, aliases, and edges once per update cycle to eliminate repeated `findIndex`/`Array.from` scans during corrections and renames.
- [x] `utils/mapUpdateHandlers.ts:278` – Swap the `edgesToRemoveIndices.includes` pattern for a `Set` lookup when filtering edges to remove the O(n²) behaviour.
- [x] `utils/modelUsageTracker.ts:16` – Replace the `while (arr.shift())` cleanup with pointer arithmetic or `splice` to avoid O(n²) array shifting under high throughput.

## Code Quality & Maintainability
- [ ] `hooks/useProcessAiResponse.ts:430` – Refactor the response pipeline into composable steps (state prep, map inventory, lore, logging) with typed outputs for readability.
- [ ] `services/loremaster/api.ts:214` – Consolidate the repeated `retryAiCall` + `dispatchAIRequest` scaffolding into a shared helper so extract/collect/integrate/distill stay in sync.
- [x] `services/storyteller/responseParser.ts:135` – Tidy the dialogue correction branch by normalizing imports, removing redundant aliasing, and leaning on reusable validators.
- [x] `services/storyteller/responseParser.ts:147` – Extract the ad-hoc NPC merge/correction block into helpers to reduce duplication and tighten the correction path.
- [x] `utils/mapUpdateHandlers.ts:118` – Move alias-map cleanup and node renaming side effects into utilities so `handleMapUpdates` reads declaratively.

## Testing
- [x] `tests/useProcessAiResponse.test.ts` – Add coverage for item correction, map update delegation, and lore refinement toggles to guard the AI pipeline.
- [x] `tests/mapUpdateHandlers.test.ts` – Add regression tests for node renaming, alias cleanup, and edge removals during map updates.
