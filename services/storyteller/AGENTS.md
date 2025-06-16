The **storyteller** service encapsulates all communication with the main narrative model. It exposes helper modules that build prompts, parse responses and store the system instruction used for each request.

* `api.ts` – high level functions such as `executeAIMainTurn` and theme summarisation. These send fully formatted prompts to `dispatchAIRequest` and log usage metadata so token counts can be monitored.
* `promptBuilder.ts` – constructs the large prompts for new games and turns using utilities from `utils/promptFormatters`.
* `responseParser.ts` – validates the JSON returned by the model and converts it into game state structures.
* `systemPrompt.ts` – holds the base instruction string given to the model.
* `index.ts` – re-exports the modules above for convenient importing.

When modifying this service keep the prompt format and returned interfaces aligned with code in `useGameLogic` and the AI prompts.
Both null and undefined optional fields in AI responses should be sanitized to undefined and treated as undefined down the line.

### Gemini API call guidelines

- Wrap Gemini requests in `retryAiCall` so transient failures are retried.
- Use `addProgressSymbol` before dispatching to provide progress updates.
- Always send requests via `dispatchAIRequest`.

### Variable naming guidelines

- `prompt` – string sent as the user content of the AI request.
- `systemInstruction` – accompanying system instruction string.
- `aiResponse` – raw value returned from the AI call.
- `parsedResult` – JSON-parsed form of `aiResponse` when needed.
- `validated*` – results after type validation, e.g. `validatedChanges`.
