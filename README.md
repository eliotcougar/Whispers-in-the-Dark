# Whispers in the Dark

Whispers in the Dark is a browser-based text adventure powered by Google's Gemini language models. The project grew out of an experiment in combining creative writing with real-time AI assistance. The player explores a node-based map and manages an inventory while pursuing quests in a themed setting of their choice. The entire experience runs in a single-page React application written in TypeScript and was co-created by **Eliot the Cougar** and **OpenAI Codex**.

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

## Running the Game Locally

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
- **Google AI Studio** – Uses your account's key automatically so Imagen 4 works, but page loads are slower: <https://aistudio.google.com/apps/drive/1kMjQkUizy3b6XyyUBh-nNr9a_OalvvKk?showPreview=true>

## Features

- AI driven storytelling that begins in a theme of your choice.
- Node-based map that evolves as the narrative unfolds.
- Dialogue system where NPCs remember past conversations.
- Inventory items persist on the map even when dropped.
- Save/Load to local files with automatic local storage backups.
- Image generator, knowledge base, map viewer, and more.

## Authors

Created collaboratively by **Eliot the Cougar** and **OpenAI Codex**.
