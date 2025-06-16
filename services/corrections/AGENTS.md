The **corrections** helpers attempt to fix malformed AI responses. They are used when JSON fails validation or when map nodes require additional information.

* `base.ts` – shared helpers for calling the correction models. Provides `callCorrectionAI` and `callMinimalCorrectionAI` wrappers that rely on `dispatchAIRequest`.
* `character.ts`, `item.ts`, `name.ts` – small utilities that request corrected data for specific entity types.
* `map.ts` – sophisticated routines that repair or refine `AIMapUpdatePayload` results.
* `dialogue.ts` – fixes issues with conversation summaries and turn outputs.
* `index.ts` – exports all correction helpers together.

Use these utilities to keep the game running smoothly when the main models return inconsistent data.
Both null and undefined optional fields in AI responses should be sanitized to undefined and treated as undefined down the line.

### Variable naming guidelines

- `prompt` – string sent as the user content of the AI request.
- `systemInstruction` – accompanying system instruction string.
- `aiResponse` – raw value returned from the AI call.
- `parsedResult` – JSON-parsed form of `aiResponse` when needed.
- `validated*` – results after type validation, e.g. `validatedChanges`.
