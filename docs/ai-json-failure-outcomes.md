# AI JSON Failure Outcomes During a Game Turn

This handbook catalogues every failure path we surface while parsing or validating Gemini JSON throughout a player turn. Each entry lists the trigger, the exact feedback text, and where that feedback goes so retry prompts stay aligned.

## Storyteller main-turn pipeline

| Stage | Trigger | Message emitted | Propagation |
| --- | --- | --- | --- |
| `executeAIMainTurn` pre-flight | Gemini returns malformed text even after fence stripping | Throws `Malformed AI JSON response`. | Abort current attempt so `retryAiCall` replays the request with the same prompt. 【F:services/storyteller/api.ts†L479-L506】 |
| `validateBasicStructure` | Parsed payload is not an object | `Storyteller response must be a JSON object that matches the expected schema.` | Records reason `non_object`, aborts, and pipes the text into the next `[Parser Feedback]` block. 【F:services/storyteller/responseParser.ts†L486-L535】 |
| `validateBasicStructure` | `sceneDescription` missing/blank | `Storyteller response must include a non-empty "sceneDescription" field.` | Records reason `missing_scene_description`; retry prompt quotes the message verbatim. 【F:services/storyteller/responseParser.ts†L498-L535】 |
| `validateBasicStructure` | Optional fields fail type/array checks | `Storyteller response contained invalid or mistyped base fields. Ensure optional arrays and strings use the correct types.` | Records reason `invalid_base_fields` and halts before any downstream handlers execute. 【F:services/storyteller/responseParser.ts†L506-L537】 |
| `handleDialogueSetup` outcome | Dialogue setup correction fails, leaving no valid options | `Storyteller response must include valid action options when dialogue is not triggered.` | `buildFailureResult` captures reason `invalid_options` so the retry hint can be injected. 【F:services/storyteller/responseParser.ts†L758-L782】 |
| Final options check | Options array missing, empty, or non-strings after all corrections | `Storyteller response must provide six distinct action options when not initiating dialogue.` | Records `invalid_options`; UI retry banner echoes the same text. 【F:services/storyteller/responseParser.ts†L854-L860】 |
| JSON parse catch | Any exception while parsing or validating | Records `Storyteller response could not be parsed as JSON.` then falls back to `Storyteller response failed due to an unknown parsing error.` | Both strings are stored so the retry loop can show specific feedback and a generic fallback. 【F:services/storyteller/responseParser.ts†L760-L885】 |

* `runStorytellerTurnWithParseRetries` stores the last reason/message pair and injects it into the next prompt before surfacing the banner after the retry budget is exhausted. 【F:hooks/storytellerParseRetry.ts†L66-L151】
* `usePlayerActions` exposes the final error to the UI and keeps the turn in an error state so the player can retry. 【F:hooks/usePlayerActions.ts†L303-L378】

## Dialogue flows

### Dialogue turn parser validation

`parseDialogueResponse` forwards precise failure messages through its `onParseError` callback:

- Structural validation (`npcResponses` / `playerOptions` / boolean and participant checks) → `Dialogue response must include npcResponses and playerOptions with valid speaker/line strings.` 【F:services/dialogue/responseParser.ts†L14-L31】
- `npcAttitudeUpdates` shape problems cover: not-an-array, non-object entries, non-string fields, or trimmed empties. Messages include “npcAttitudeUpdates must be an array…”, “Each npcAttitudeUpdates entry must be an object…”, “npcAttitudeUpdates entries must provide string values…”, and “npcAttitudeUpdates entries cannot use empty strings…”. 【F:services/dialogue/responseParser.ts†L32-L69】
- `npcKnownNameUpdates` validation emits messages for every branch: must be an array, entries must be objects, require `name`, disallow empty strings, enforce string arrays, forbid empty replacements, and require at least one of `newKnownPlayerNames` / `addKnownPlayerName`. 【F:services/dialogue/responseParser.ts†L70-L157】
- Raw JSON parse failures raise the underlying error message or the fallback `Dialogue response failed to parse as valid JSON.` 【F:services/dialogue/responseParser.ts†L183-L187】

`executeDialogueTurn` preserves the earliest error (either from the primary parser or corrections) and uses it as the next retry hint. 【F:services/dialogue/api.ts†L170-L221】

### Dialogue correction retries

When the correction helpers run, they maintain their own failure messaging loop:

- `fetchCorrectedDialogueSetup` insists on non-empty `initialNpcResponses`, `initialPlayerOptions`, and participant names drawn from known NPCs: `Corrected dialogueSetup payload must include non-empty initialNpcResponses, initialPlayerOptions, and participants drawn from known NPCs.` 【F:services/corrections/dialogue.ts†L89-L121】
- `fetchCorrectedDialogueTurn` can surface three outcomes:
  - Schema violations bubble up the exact parser error from the primary validator.
  - Otherwise, it falls back to `Dialogue response must list npcResponses with valid speakers and provide playerOptions that match schema.`
  - Empty outputs trigger `Dialogue response was empty. Return a complete JSON object matching the required structure.` 【F:services/corrections/dialogue.ts†L171-L212】

### Dialogue summaries

`parseDialogueSummaryResponse` mirrors the storyteller parser and emits `Dialogue summary response failed to parse as valid JSON.` when the payload cannot be parsed. Any downstream storyteller failures reuse the table above. 【F:services/dialogue/responseParser.ts†L211-L229】【F:services/dialogue/api.ts†L270-L350】

## Inventory updates

### Primary parser

`parseInventoryResponse` captures the first validation failure and relays it through `onParseError`:

- Non-JSON payload → `Inventory response was not valid JSON.` 【F:services/inventory/responseParser.ts†L33-L121】
- Action-specific validators emit: “Inventory create action was missing required item fields.”, “Inventory change action attempted to destroy an item without a valid id or name.”, “Inventory change action had invalid item payload.”, “Inventory addDetails action payload was invalid.” (and it preserves the malformed payload), “Inventory destroy action requires an item reference with id or name.”, “Inventory move action must include id and newHolderId strings.”, and `Inventory action "<action>" is not supported.` 【F:services/inventory/responseParser.ts†L27-L107】
- If the structure never forms a valid change list, the parser returns `Inventory response must be a JSON object or array describing item changes.` unless a more specific error already fired. 【F:services/inventory/responseParser.ts†L187-L195】

### Inventory correction helpers

The inventory correction stack adds additional guardrails:

- `fetchCorrectedItemPayload` rotates through two feedback strings: `Returned item payload could not be parsed as JSON. Respond with a single JSON object for the item.` and `Correct the '<action>' item payload so it includes valid values for name, type, description, holderId and other required fields. Types must be one of … and never 'junk'.` 【F:services/corrections/item.ts†L146-L179】
- `fetchCorrectedItemAction` reports either `Returned action must be exactly one of ... Respond with only the action string.` or `No action string was returned. Respond with exactly one of ... , or an empty string if unsure.`; returning an empty string ends the retry loop. 【F:services/corrections/item.ts†L243-L275】
- `fetchCorrectedItemTag` demands canonical tags via `Tag must be one of the canonical values: ... Respond with a single tag string.` 【F:services/corrections/item.ts†L322-L347】
- `fetchAdditionalBookChapters` enforces structured chapter arrays: `Return an array with <n> objects containing "heading", "description", and numeric "contentLength" between 50 and 200.` 【F:services/corrections/item.ts†L360-L417】
- `fetchCorrectedAddDetailsPayload` feeds back `Corrected addDetails payload must include id, name, valid type, and optional knownUses/tags/chapters with proper structure.` 【F:services/corrections/item.ts†L433-L491】
- `fetchCorrectedItemChangeArray` either relays the underlying parser error or falls back to `Corrected inventory payload must contain valid ItemChange entries following the documented schema.` 【F:services/corrections/inventory.ts†L254-L303】

## Map updates

### Primary cartographer parser

- Raw parse failures throw `JSON parse failed`, which bubbles to the catch block so the retry prompt can include the thrown error string. 【F:services/cartographer/responseParser.ts†L18-L76】
- Schema validation collects every warning from `isValidAIMapUpdatePayload`; if nothing specific remains it returns `Map update response must include valid nodes/edges formatted according to the documented schema.` 【F:services/cartographer/responseParser.ts†L130-L197】

### Map correction helpers

- `fetchCorrectedMapUpdatePayload` guides retries with `Corrected map update payload must include valid nodes/edges arrays that follow the documented schema and reference existing locations.` 【F:services/corrections/mapUpdatePayload.ts†L43-L79】
- `fetchCorrectedPlaceDetails` and `fetchFullPlaceDetailsForNewMapNode` rely on schema validation but do not emit bespoke error text; they simply retry until a fully populated JSON object arrives. 【F:services/corrections/placeDetails.ts†L98-L199】
- `fetchCorrectedLocalPlace` reports failures in logs but does not pass additional parser feedback, ending the loop when Gemini returns an empty string. 【F:services/corrections/placeDetails.ts†L25-L105】
- `fetchCorrectedName` is used by both map and dialogue flows to reconcile participant/location names; it feeds back either `Return exactly one of the provided valid <entity> names: [...]` or `No name was returned. Respond with a single name from the provided valid list, or an empty string if unsure.` 【F:services/corrections/name.ts†L19-L99】

## NPC corrections within a turn

Storyteller NPC handling leans on the following correction outcomes:

- `fetchCorrectedNPCDetails` keeps retrying until every required field validates; failed attempts only log but ultimately cause the calling parser to discard the NPC addition for that turn. 【F:services/corrections/npc.ts†L23-L136】
- `fetchCorrectedCompanionOrNPCLocation` uses log output only; if Gemini cannot produce a valid string it eventually returns `null`, which triggers the default fallback descriptors. 【F:services/corrections/npc.ts†L107-L204】

## Lore and auxiliary services touched during turns

While lore extraction and integration run outside the main retry loop, they still gate AI JSON before results can influence the next scene:

- `parseExtractFactsResponse` and `parseCollectFactsResponse` return `null` whenever the AI does not provide an array of properly typed entries, causing the calling service to skip updates. 【F:services/loremaster/responseParser.ts†L17-L64】【F:services/loremaster/responseParser.ts†L74-L93】
- `parseIntegrationResponse` rejects change instructions that reference unknown IDs, again returning `null` so no partial lore update slips through. 【F:services/loremaster/responseParser.ts†L65-L94】

By enumerating each failure pathway, we can trace any retry prompt directly back to the guard that produced it and ensure future schema changes keep the feedback loop intact.
