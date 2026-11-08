# Whispers in the Dark

Whispers in the Dark is a browser-based text adventure with Google Gemini and optional local ChatGPT support. The project grew out of an experiment in combining creative writing with real-time AI assistance. The player explores a node-based map and manages an inventory while pursuing quests in a setting of their choice. The entire experience runs in a single-page React application written in TypeScript and was co-created by **Eliot the Cougar** and **OpenAI Codex**.

## What is Vibe-Coding?

Vibe-coding is an experimental workflow where OpenAI Codex and a human developer iterate together in short cycles. The AI proposes code and documentation while the human reviews, tests, and refines each change. We keep a running dialogue about goals, design choices, and the next small task so the AI can generate focused patches. This repo emerged from many such sessions between **Eliot the Cougar** and **OpenAI Codex**, blending our styles into a single project.

### Pros

- Rapid prototyping from natural-language instructions.
- Tight feedback loops from automated tests and linting.
- Code and documentation evolve side by side.

### Cons

- Requires careful review because the AI may introduce subtle mistakes.
- Complex ideas can take several iterations to refine.

Vibe-coding excels at creative exploration but still relies on human judgment to keep the project cohesive.

## Local ChatGPT gameplay

Use **Node.js 22 or newer** for the local ChatGPT service.

1. Run `npm install` and `npm run dev` from this folder.
2. Open the local URL printed by Vite (normally http://127.0.0.1:5173/Whispers-in-the-Dark/; localhost also works).
3. Open **AI Connection**, choose **ChatGPT**, and select **Continue with ChatGPT**.
4. Complete OpenAI sign-in and explicitly allow the game to use your eligible ChatGPT Plus or Pro plan. Return to the game, choose an available model, and select **Done**.
5. Start a new game or load a save. The selected model powers all text services.

You can change providers from **AI Connection** on the title menu or in **Settings**. Gemini keys and the ChatGPT connection are kept separately. The game never switches providers automatically after an error.

For Gemini, choose **Text model** in **AI Connection**. The selected model handles every text request, including storytelling, dialogue, lore, corrections, and image-prompt preparation. **Gemini Flash-Lite** is the default. Choosing a model uses only that model; **Automatic** restores the original per-task model choices and fallbacks. Gemini and ChatGPT remember their model choices separately.

Text and image providers are independent. ChatGPT text requests share your Codex/ChatGPT Work allowance; use **Manage usage** to review the app’s limits. The game does not add an allowance or silently purchase credits.

The local Vite service handles OAuth, model discovery, and completed text responses. Credentials stay outside the project and browser storage, under `~/.config/whispers-in-the-dark/chatgpt/`. On Windows, the directory is restricted to the current user; Unix files use owner-only permissions. Only one local server may use this credential store at a time. **Sign out** revokes the renewable session when possible and clears local tokens; disconnect the app in ChatGPT settings if remote revocation could not be confirmed.

For a built local version, run `npm run build`, then `npm run preview`. Static hosting (including GitHub Pages) does not provide the local sign-in service. The service accepts only loopback clients and same-origin game requests.

The current OpenAI preview requires streaming, client-supplied context, and `store: false`. Gemini temperature, token limits, and thinking budgets are not sent to ChatGPT. JSON schemas are included in the instructions, and the game retains its existing parsing, validation, and correction steps. Partial or failed streams are never returned as successful turns.

See [OpenAI’s sign-in guide](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) and [preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

## OpenAI API images

1. Open **AI Connection → Images** in the title menu or Settings.
2. Choose **OpenAI** as the image provider.
3. Enter your OpenAI API key and select **Save image key**. Saving stores the key without generating a picture or making a paid API request.
4. Choose an **Image model** and Low, Medium, or High image quality. The default remains `gpt-image-2.5-flare`; each provider remembers its own image model.
5. Use **Visualize Scene**, or read a picture/map item to generate its illustration.

Image generation uses the key’s **OpenAI API credits**, separately from ChatGPT sign-in. Text gameplay can continue using either ChatGPT sign-in or Gemini. The game rewrites visual prompts using the selected text provider before sending them to the image API; prompt preparation must succeed first.

The local service stores the image key in its protected credential file outside the project and browser storage. The UI shows only whether a key is saved; it never retrieves the saved key. **Remove key** removes the local copy without changing the text connection. Image preferences are stored separately from text preferences. Static hosting does not provide this local OpenAI service.

Choose **Disabled** to avoid new image requests, or **Google Gemini** to choose a Gemini image model. Existing cached illustrations remain available. Image generation uses the selected model without switching to another model or provider after an error. OpenAI generates one JPEG per request; wide scenes use 1536×1024 output.

See the [official Image API guide](https://developers.openai.com/api/docs/guides/image-generation). Model access, API credits, or organization verification may be required by the API account.

## Running locally with Gemini

1. **Install Node.js 18 or newer.**
2. **Set `GEMINI_API_KEY` in your environment.** During `npm run dev` the key is copied into your browser's local storage so the client can talk to Gemini automatically.
3. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
   Visit [http://localhost:5173](http://localhost:5173) to play.
4. To create a production bundle run:
   ```bash
   npm run build
   npm run preview
   ```
   The built version does not read `GEMINI_API_KEY` from your environment. After you launch `npm run preview`, open the game and enter your API key manually in the settings screen.

## Play the Latest Stable Release

- **GitHub Pages** – Fast loading but you must enter your API key manually and Imagen 4 images are disabled: <https://eliotcougar.github.io/Whispers-in-the-Dark/>
- **Google AI Studio** – Uses your account's key automatically so Imagen 4 works, but page loads are slower: <https://ai.studio/apps/drive/1CMEcImNGuJk8DsEUjEftUpkrpatEZcdb>

## Features

- AI driven storytelling that begins in a setting of your choice.
- Node-based map that evolves as the narrative unfolds.
- Dialogue system where NPCs remember past conversations.
- Inventory items persist on the map even when dropped.
- Save/Load to local files with automatic local storage backups.
- Image generator, knowledge base, map viewer, and more.

## Authors

Created collaboratively by **Eliot the Cougar** and **OpenAI Codex**.
