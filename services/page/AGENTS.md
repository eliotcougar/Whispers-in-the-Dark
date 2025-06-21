The **page** service generates text for small written items like notes or pages.
Follow the same request structure as other services: an `api.ts` module exporting
`generatePageText` which wraps `dispatchAIRequest` with retry logic. Keep prompts
simple and system instructions concise. Use AUXILIARY_MODEL_NAME first and fall
back to GEMINI_MODEL_NAME. Add progress symbols before requests and sanitize AI
responses with the provided JSON helpers when applicable.
