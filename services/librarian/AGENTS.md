The **librarian** service manages written items like books, pages and maps.
It mirrors the inventory service design with modules `api.ts`, `promptBuilder.ts`, `responseParser.ts`, `systemPrompt.ts` and `index.ts`.
Wrap requests in `retryAiCall`, add progress symbols, and always use `dispatchAIRequest`.
