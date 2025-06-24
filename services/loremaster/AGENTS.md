The **loremaster** service refines and selects immutable facts about the game world.

* `api.ts` – orchestrates refine, collect and distill requests via Gemini.
* `promptBuilder.ts` – builds prompts for extracting, integrating and selecting facts.
* `responseParser.ts` – validates the JSON responses.
* `systemPrompt.ts` – holds the base instructions for each mode.
* `index.ts` – re-exports the main functions.

Follow patterns from other services: wrap Gemini calls in `retryAiCall`, add progress symbols before dispatching and always use `dispatchAIRequest`.
