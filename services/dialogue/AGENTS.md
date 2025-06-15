The **dialogue** service handles conversational interactions with NPCs. It generates responses based on current map context and dialogue history.

* `api.ts` – functions for performing dialogue turns, summarising conversations and obtaining memory summaries. All model calls route through `dispatchAIRequest`.
* `promptBuilder.ts` – constructs the dialogue prompt using player input and recent exchanges.
* `responseParser.ts` – validates the AI's JSON output and extracts conversation choices or summaries.
* `systemPrompt.ts` – the base instruction string guiding dialogue style and structure.
* `index.ts` – convenience exports for the modules above.

Maintain compatibility between dialogue prompts and the parser whenever adjustments are made.
Both null and undefined optional fields in AI responses should be sanitized to undefined and treated as undefined down the line.