# Correction Service Function Usage

This document lists every helper exported from `services/corrections` and explains where each function is exercised in the codebase (or notes when it currently has no runtime callers).

## Dialogue helpers
- **`fetchCorrectedDialogueSetup`** – Invoked while parsing storyteller turns when the dialogue setup blob fails structural validation, letting the parser fall back to a corrected payload before proceeding. 【F:services/storyteller/responseParser.ts†L543-L596】
- **`fetchCorrectedDialogueTurn`** – Used in the dialogue API to repair malformed turn responses after the primary parser fails, keeping conversational flows alive. 【F:services/dialogue/api.ts†L180-L229】

## Inventory helpers
- **`fetchCorrectedItemChangeArray`** – Called by `applyInventoryDirectives` whenever the inventory response cannot be parsed so it can retry with a corrected list of changes; tests also mock it to verify no unnecessary correction occurs. 【F:services/inventory/api.ts†L382-L452】【F:tests/inventoryNoCorrection.test.ts†L19-L60】
- **`fetchCorrectedAddDetailsPayload`** – Rehydrates `addDetails` actions that arrive with malformed payloads inside the same inventory workflow. 【F:services/inventory/api.ts†L382-L436】
- **`fetchCorrectedItemPayload`** – Currently exported but unused; a repository-wide search only finds the definition in `services/corrections/item.ts`. 【c30210†L1-L9】
- **`fetchCorrectedItemAction`** – Likewise only defined at present with no active call sites beyond the helper itself. 【a8516e†L1-L12】
- **`fetchCorrectedItemTag`** – Exercised in the correction heuristics unit test to prove the synonym/regex shortcut path returns a valid canonical tag without hitting the API. 【F:tests/correctionHeuristics.test.ts†L14-L39】
- **`fetchAdditionalBookChapters`** – Exported for future fallbacks but not used by runtime code yet. 【bb52c4†L1-L6】
- **`fetchCorrectedAddDetailsPayload`** – already covered above.

## Map place helpers
- **`fetchCorrectedLocalPlace`** – Defined for inferring the player’s immediate location, but nothing in the current codebase invokes it. 【04979d†L1-L7】
- **`fetchCorrectedPlaceDetails`** – Prepared to repair partial map-node payloads, though no modules call it right now. 【811c79†L1-L6】
- **`fetchFullPlaceDetailsForNewMapNode`** – Triggered after map updates add a main node that still lacks description/aliases, and mocked in map-update tests. 【F:utils/mapUpdateHandlers.ts†L214-L243】【F:tests/mapUpdateHandlers.test.ts†L23-L27】
- **`fetchCorrectedNodeType`** – Covered by the heuristics unit test to confirm local inference resolves node types without remote calls. 【F:tests/correctionHeuristics.test.ts†L14-L22】
- **`fetchLikelyParentNode`** – Invoked when cartographer batching cannot determine parents for newly proposed nodes, letting the helper guess a hierarchy fix. 【F:services/cartographer/processNodeAdds.ts†L240-L276】
- **`fetchCorrectedNodeIdentifier`** – Used while applying map updates to salvage references that point at incomplete or malformed node IDs; tests override it to assert the fallback is optional. 【F:services/cartographer/applyUpdates.ts†L119-L136】【F:tests/applyUpdatesPartialId.test.ts†L1-L22】

## Map edge & connector helpers
- **`fetchCorrectedEdgeType`** – Validated via the heuristics test to demonstrate synonym handling without contacting the API. 【F:tests/correctionHeuristics.test.ts†L14-L25】
- **`fetchConnectorChains`** – Drives connector-chain refinement so new intermediary nodes/edges can be suggested; the partial-ID test suite mocks it to isolate chain handling. 【F:services/cartographer/refineConnectorChains.ts†L10-L148】【F:tests/applyUpdatesPartialId.test.ts†L1-L12】

## Map hierarchy helpers
- **`decideFeatureHierarchyUpgrade`** – Called from the hierarchy upgrade utility when a feature improperly owns children, choosing between upgrading the parent or converting the child. 【F:utils/mapHierarchyUpgradeUtils.ts†L188-L205】
- **`chooseHierarchyResolution`** – Used by the cartographer’s hierarchy resolver to pick among several valid structural fixes when conflicts remain. 【F:services/cartographer/hierarchyResolver.ts†L86-L102】

## Map update payload helper
- **`fetchCorrectedMapUpdatePayload`** – Applied inside the cartographer response parser after schema validation fails, giving the correction service a chance to repair the entire payload. 【F:services/cartographer/responseParser.ts†L180-L215】

## Duplicate-name helper
- **`assignSpecificNamesToDuplicateNodes`** – Executed during map update handling to rename identical place entries and mocked in map-update tests to observe rename behavior. 【F:utils/mapUpdateHandlers.ts†L235-L243】【F:tests/mapUpdateHandlers.test.ts†L23-L27】

## NPC helpers
- **`fetchCorrectedNPCDetails`** – Leveraged both when turning partial NPC updates into full records and when promoting malformed additions into usable characters. 【F:services/storyteller/responseParser.ts†L280-L417】
- **`fetchCorrectedCompanionOrNPCLocation`** – Declared for fixing malformed `preciseLocation` strings but presently unused. 【41feb2†L1-L7】

## Name-matching helper
- **`fetchCorrectedName`** – Used throughout the storyteller pipeline to reconcile NPC identifiers, sanitize dialogue participant lists, and in the game-response hook to fix mismatched item names before applying inventory changes. 【F:services/storyteller/responseParser.ts†L340-L372】【F:services/storyteller/responseParser.ts†L803-L851】【F:hooks/useProcessAiResponse.ts†L120-L148】
