# Whispers in the Dark

An AI-powered text adventure built with React and TypeScript. The game uses Google's Gemini models to generate the narrative, handle conversations, and create scene images.  Reality frequently shifts between different themes such as dungeon crawls, Greek myths, or samurai tales.  Players manage an inventory, explore a node based map of locations, talk to NPCs, and can manually or randomly switch realities.

## Getting Started

1. **Install Node.js 18 or newer**.
2. **Set the environment variable `GEMINI_API_KEY`** with your API key so the app can talk to the Gemini service.
3. *(Optional)* Provide a Google OAuth client ID to enable "Login with Google".
   You can set the `GOOGLE_CLIENT_ID` environment variable or assign
   `window.GOOGLE_CLIENT_ID` in `index.html` before loading the application.
   The app uses the [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/overview)
   library to request a short-lived access token and automatically fetch your
   personal API key from Google AI Studio.
4. Install dependencies and launch the dev server:
   ```bash
   npm install
   npm run dev
   ```
   The game will be available at `http://localhost:5173`.
5. To verify TypeScript compilation and bundling run:
   ```bash
   npm run build
   ```
6. To lint the project run the test script:
   ```bash
   npm test
   ```

## Features

- AI driven story generation with optional custom starting theme.
- Dynamic map with nodes and edges that update based on the narrative.
- Dialogue system with memory summaries so NPCs remember past talks.
- Manual and random "Reality Shifts" that change the current theme.
- Items can reside in any NPC's inventory or map location, and all such
  items are included when viewing or saving the full game state.
- Save/Load to local files plus automatic local storage saves.
- Map display, knowledge base, image visualizer and more.
