The **dialogue** service handles conversational interactions with NPCs. It generates responses based on current map context and dialogue history.

* `api.ts` – functions for performing dialogue turns, summarising conversations and obtaining memory summaries. All model calls route through `dispatchAIRequest`.
* `promptBuilder.ts` – constructs the dialogue prompt using player input and recent exchanges.
* `responseParser.ts` – validates the AI's JSON output and extracts conversation choices or summaries.
* `systemPrompt.ts` – the base instruction string guiding dialogue style and structure.
* `index.ts` – convenience exports for the modules above.

Maintain compatibility between dialogue prompts and the parser whenever adjustments are made.
Both null and undefined optional fields in AI responses should be sanitized to undefined and treated as undefined down the line.
- Use the utilities in `utils/jsonUtils.ts` for stripping code fences and safely parsing AI responses.

### Gemini API call guidelines

- Use `retryAiCall` to wrap Gemini requests so failures are automatically retried.
- Call `addProgressSymbol` before each dispatch for UI feedback.
- All dialogue requests must use `dispatchAIRequest`.

### Variable naming guidelines

- `prompt` – string sent as the user content of the AI request.
- `systemInstruction` – accompanying system instruction string.
- `aiResponse` – raw value returned from the AI call.
- `parsedResult` – JSON-parsed form of `aiResponse` when needed.
- `validated*` – results after type validation, e.g. `validatedChanges`.
