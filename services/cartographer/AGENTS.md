The **cartographer** service is responsible for updating the map. It calls the auxiliary model with map context to produce an `AIMapUpdatePayload` that describes nodes and edges to add, update or remove.

* `api.ts` – orchestrates map update calls and applies the returned payload to the game's `MapData` structure.
* `promptBuilder.ts` – builds the prompt given to the map model.
* `responseParser.ts` – parses and validates the AI response before it is merged into the game state.
* `systemPrompt.ts` – contains the detailed instructions that define the payload format and valid values.
* `index.ts` – re-exports these helpers.

Edits here should maintain strict validation rules so invalid map structures do not propagate to the rest of the game.
Both null and undefined optional fields in AI responses should be sanitized to undefined and treated as undefined down the line.
- Parsing helpers in `utils/jsonUtils.ts` should be used to handle map AI JSON responses.

### Gemini API call guidelines

- Wrap Gemini requests in `retryAiCall` so temporary errors trigger retries.
- Call `addProgressSymbol` before dispatching to give feedback.
- All map update requests must use `dispatchAIRequest`.

### Variable naming guidelines

- `prompt` – string sent as the user content of the AI request.
- `systemInstruction` – accompanying system instruction string.
- `aiResponse` – raw value returned from the AI call.
- `parsedResult` – JSON-parsed form of `aiResponse` when needed.
- `validated*` – results after type validation, e.g. `validatedChanges`.
