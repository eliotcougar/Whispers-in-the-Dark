The **corrections** helpers attempt to fix malformed AI responses. They are used when JSON fails validation or when map nodes require additional information.

* `constants.ts` – defines `CORRECTION_TEMPERATURE` used when dispatching AI requests.
* `npc.ts`, `item.ts`, `name.ts` – small utilities that request corrected data for specific entity types.
* `map.ts` – sophisticated routines that repair or refine `AIMapUpdatePayload` results.
* `dialogue.ts` – fixes issues with conversation summaries and turn outputs.
* `index.ts` – exports all correction helpers together.

Use these utilities to keep the game running smoothly when the main models return inconsistent data.
Both null and undefined optional fields in AI responses should be sanitized to undefined and treated as undefined down the line.
- The shared helpers in `utils/jsonUtils.ts` simplify fence stripping and JSON parsing; use them in correction routines.

### Gemini API call guidelines

- Wrap each Gemini request in `retryAiCall` so transient API failures are retried automatically.
- Call `addProgressSymbol` before dispatching to display progress feedback.
- Route all requests through `dispatchAIRequest` specifying the desired model names and label.

### Variable naming guidelines

- `prompt` – string sent as the user content of the AI request.
- `systemInstruction` – accompanying system instruction string.
- `aiResponse` – raw value returned from the AI call.
- `parsedResult` – JSON-parsed form of `aiResponse` when needed.
- `validated*` – results after type validation, e.g. `validatedChanges`.
