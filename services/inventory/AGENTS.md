The **inventory** service coordinates small item management requests to the AI. It mirrors the pattern of other services by exposing helper modules for prompt construction, response parsing and the base system instruction.

* `api.ts` – wraps `dispatchAIRequest`, first trying `MINIMAL_MODEL_NAME` and falling back to a full model if needed.
* `promptBuilder.ts` – composes prompts using provided `playerItemsHint`, `worldItemsHint`, `npcItemsHint` and pre-generated suggested item IDs.
* `responseParser.ts` – validates and parses the AI's JSON output into `ItemChange[]`.
* `systemPrompt.ts` – the instruction string describing the item change format.
* `index.ts` – re-exports these helpers for convenient importing.

Maintain compatibility between the prompt builder and parser when adjusting this service.
Both null and undefined optional fields in AI responses should be sanitized to undefined and treated as undefined down the line.