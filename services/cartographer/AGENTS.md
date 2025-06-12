The **cartographer** service is responsible for updating the map. It calls the auxiliary model with map context to produce an `AIMapUpdatePayload` that describes nodes and edges to add, update or remove.

* `api.ts` – orchestrates map update calls and applies the returned payload to the game's `MapData` structure.
* `promptBuilder.ts` – builds the prompt given to the map model.
* `responseParser.ts` – parses and validates the AI response before it is merged into the game state.
* `systemPrompt.ts` – contains the detailed instructions that define the payload format and valid values.
* `index.ts` – re-exports these helpers.

Edits here should maintain strict validation rules so invalid map structures do not propagate to the rest of the game.
