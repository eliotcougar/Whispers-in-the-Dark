
# Whispers in the Dark: Game Architecture Overview

This document outlines the high-level architecture and state machine design of the "Whispers in the Dark" text adventure game.

## 1. High-Level Architecture

The game is a single-page web application built with React and TypeScript, interacting with the Google Gemini API for its core narrative and content generation. The architecture can be broadly divided into the following layers:
UI Layer -> Game Logic Layer -> Service Layer -> Data Layer -> Gemini API

### 1.1. UI Layer (React Components)

*   **Framework:** React with TypeScript.
*   **Responsibilities:**
    *   Rendering the game state (scene descriptions, inventory, quests, logs, map, etc.).
    *   Capturing player input (action selections, item interactions, custom text, dialogue choices).
    *   Displaying modals for various features (Image Visualizer, Knowledge Base, Settings, Info, Theme Memory, Map Display, Debug View, Title Menu, Dialogue).
*   **Key Components:**
    *   `App.tsx`: The root component, orchestrating the overall UI and integrating the `useGameLogic` hook.
    *   `SceneDisplay.tsx`: Renders the main narrative, quest, objective, and local context, using `MapNode` data for highlighting locations.
    *   `ActionOptions.tsx`: Displays clickable action choices, using `MapNode` data for highlighting.
    *   `InventoryDisplay.tsx`: Manages the player's inventory, item interactions, and junk discarding. Items dropped are not removed; their `holderId` is set to the current map node so they remain in the world.
    *   `GameLogDisplay.tsx`: Shows a history of game events.
    *   `DialogueDisplay.tsx`: Handles the UI for conversations with NPCs, using `MapNode` data for highlighting.
    *   `MapDisplay.tsx`: Visualizes the `MapData` for the current theme. Includes pan/zoom interactions and exposes layout tuning via `MapControls`.
    *   `MapNodeView.tsx`: Renders individual nodes within the map SVG.
    *   Modal Components (`ImageVisualizer.tsx`, `KnowledgeBase.tsx`, `SettingsDisplay.tsx`, `InfoDisplay.tsx`, `HistoryDisplay.tsx`, `DebugView.tsx`, `TitleMenu.tsx`): Provide focused views for specific functionalities. The `KnowledgeBase` primarily focuses on characters, with location details coming from the map.
    *   `LoadingSpinner.tsx`, `ErrorDisplay.tsx`: Provide feedback during loading or error states.
    *   `MainToolbar.tsx`: Contains buttons for primary game actions and information display, including opening the map.

### 1.2. Game Logic Layer (`useGameLogic` Hook)

*   **Location:** `hooks/useGameLogic.ts`
*   **Responsibilities:**
    *   Manages the core game state using a stack of `FullGameState` objects. This stack holds snapshots of the narrative world state (current theme name, scene, inventory, quests, objectives, player score, local time/environment/place, `dialogueState` object, `mapData` object for all map nodes and edges, `currentMapNodeId`, etc.).
    *   Handles player actions by constructing prompts for the AI based on the current game state.
    *   Orchestrates calls to AI services (main game turn, dialogue turns, summarization, corrections, map updates).
    *   Processes AI responses: parses JSON, validates data, and constructs a new `FullGameState`.
        *   If the storyteller AI's response includes `mapUpdated: true` or if `localPlace` changes significantly, it triggers the cartographer service.
        *   Applies the `AIMapUpdatePayload` returned by the cartographer service to `FullGameState.mapData`.
        *   If the cartographer service indicates a new main map node was added without full details, `useGameLogic` calls `fetchFullPlaceDetailsForNewMapNode_Service` to complete its data.
    *   Manages the "Reality Shift" mechanic (via `useRealityShift`), theme selection, and dialogue mode.
    *   Provides undo functionality by swapping the two-element `GameStateStack`.
    *   Determines `currentMapNodeId` based on AI suggestions or by using `selectBestMatchingMapNode`, which operates on `MapNode[]`.
    *   Delegates to sub hooks: `usePlayerActions`, `useDialogueFlow`, `useMapUpdates`, and `useGameInitialization`.
    *   The player's inventory is derived from all items whose `holderId` equals `PLAYER_HOLDER_ID`. Dropped items keep existing data but have their `holderId` set to the current map node so they persist on the ground. Main turn prompts include any such location items so the AI can describe them.
*   **Key Functions:**
    *   `executePlayerAction()`: Core function for a standard game turn.
    *   `loadInitialGame()`: Sets up a new game or loads an existing one.
    *   `processAiResponse()`: Modifies a draft `FullGameState` based on parsed AI data (storyteller or dialogue summary) and map update results.
    *   `commitGameState()`: Pushes a new `FullGameState` onto the stack.
    *   `handleUndoTurn()`: Restores the previous `FullGameState` from the stack.

### 1.3. Service Layer

This layer abstracts external interactions and complex data processing.

*   **AI Interaction Services:**
    *   `services/geminiClient.ts`: Initializes the Google Gemini API client.
    *   `services/storyteller/` (Storyteller service):
        *   `api.ts` orchestrates main turn calls and theme summarization.
        *   `promptBuilder.ts` builds storyteller prompts.
        *   `responseParser.ts` validates and extracts storyteller JSON.
        *   `systemPrompt.ts` contains storyteller instructions.
        *   `index.ts` re-exports these utilities.
    *   `services/dialogue/` (Dialogue service):
        *   `api.ts` handles dialogue turns, summaries, and memory summaries.
        *   `promptBuilder.ts` builds dialogue prompts.
        *   `responseParser.ts` parses dialogue responses.
        *   `systemPrompt.ts` contains dialogue instructions.
        *   `index.ts` re-exports these utilities.
    *   `services/correctionService.ts`: Attempts to fix malformed data from AI responses. `fetchFullPlaceDetailsForNewMapNode_Service` is key for completing main map node data.
    *   `services/cartographer/` (Cartographer service):
        *   `api.ts` orchestrates map update requests.
        *   `promptBuilder.ts` constructs the AI prompt.
        *   `responseParser.ts` validates and extracts the AI payload.
        *   `systemPrompt.ts` holds `MAP_UPDATE_SYSTEM_INSTRUCTION`.
        *   `index.ts` re-exports these utilities.
    *   `services/modelDispatcher.ts`: Provides AI model fallback when dispatching requests.
        *   `dispatchAIRequest(modelNames, prompt, systemInstruction?, config?)` tries each model in order until one succeeds.  It returns the `GenerateContentResponse` from the first working model.
        *   `dispatchAIRequestWithModelInfo` accepts the same parameters plus a `debugLog` array to capture which model was used and the raw response text for troubleshooting.
        *   Callers such as `storyteller/api.ts` log `response.usageMetadata` token counts (total, thoughts, prompt) when using this interface to help diagnose high token usage.
*   **Data Processing & Validation:**
    *   `services/storyteller/responseParser.ts`: Parses the storyteller AI's JSON, validates, and attempts corrections.
    *   `services/dialogue/responseParser.ts`: Parses dialogue AI JSON for turns and summaries.
    *   `services/validationUtils.ts`: General data structure validation.
    *   `utils/mapUpdateValidationUtils.ts`: Specific validation for `AIMapUpdatePayload`.
*   **Persistence Service:**
   *   `services/saveLoadService.ts`: Handles saving and loading the entire `FullGameState`, including `mapData` and `currentMapNodeId`, and converts older save versions when necessary.
*   **Utility Functions:**
   *   `utils/promptFormatters.ts` and the files under `utils/promptFormatters/`: format inventory, map context, and main turn.
   *   `utils/aiErrorUtils.ts`: Interprets errors from the Gemini API.
   *   `utils/cloneUtils.ts`: Deep clone helpers for game state objects.
  *   `utils/entityUtils.ts`: Entity lookup helpers plus `generateUniqueId`, `buildNodeId`, `buildEdgeId`, `buildCharacterId`, and `buildItemId` for deterministic IDs. `generateUniqueId` sanitizes the base string before appending a random suffix.
   *   `utils/gameLogicUtils.ts`: Applies item and character changes, manages logs, and selects the next theme.
   *   `utils/highlightHelper.tsx`: Builds highlight information for entity names in text.
   *   `utils/initialStates.ts`: Produces the default `FullGameState` objects.
   *   `utils/jsonUtils.ts`: Extracts JSON from AI responses and provides safe parsing.
   *   `utils/loadingProgress.ts`: Tracks progress text for asynchronous operations.
   *   `utils/mapConstants.ts`: Constants used when rendering the map.
   *   `utils/mapGraphUtils.ts`: Helpers for navigating the map hierarchy.
   *   `utils/mapHierarchyUpgradeUtils.ts`: Upgrades feature nodes with children into regions and inserts connector nodes.
   *   `utils/mapLayoutUtils.ts`: Performs a nested circle layout for map visualization.
   *   `utils/mapNodeMatcher.ts`: Contains `selectBestMatchingMapNode` for fuzzy location lookups.
   *   `utils/mapPathfinding.ts`: Calculates travel paths between nodes.
   *   `utils/mapUpdateHandlers.ts`: Applies AI map update payloads to `MapData`.
   *   `utils/mapUpdateValidationUtils.ts`: Validates `AIMapUpdatePayload` structures.
   *   `utils/mapSynonyms.ts` and `utils/matcherData.ts`: Provide regex helpers and keyword lists used when parsing player text.
   *   `utils/svgUtils.ts`: Converts screen coordinates to the map's SVG space.

### 1.4. Data Layer

*   **Type Definitions:**
    *   `types.ts`: Defines `FullGameState` (with `mapData: MapData`, `currentMapNodeId: string | null`, `mapLayoutConfig: MapLayoutConfig`), `MapData`, `MapNode`, `MapEdge`, `AIMapUpdatePayload`, etc. Items include a `holderId` for their owner and `Character` objects have a unique `id` similar to `MapNode.id`.
*   **Constants & Configuration:**
    *   `constants.ts`: Global constants and model names. `PLAYER_HOLDER_ID` marks items belonging to the player.
    *   `services/cartographer/systemPrompt.ts`: Defines `MAP_UPDATE_SYSTEM_INSTRUCTION` (exported as `SYSTEM_INSTRUCTION`).
*   **Theme Definitions:**
    *   `themes.ts`: Defines adventure themes.
    *   `CustomGameSetupScreen.tsx` allows starting a game from a user-chosen theme.

### 1.5. External Dependencies

*   **`@google/genai`:** Google Gemini API client.
*   **React & ReactDOM:** UI framework.
*   **TailwindCSS:** Styling.

## 2. State Machine Architecture

The game's state transitions are primarily driven by changes to `FullGameState` within `useGameLogic`.

### 2.1. Key Game States

1.  **`Initializing`**: Application startup, loads local storage.
2.  **`TitleScreen`**: Active if no game is initialized.
3.  **`Gameplay_MainLoop`**: Core gameplay.
    *   The storyteller AI response's `mapUpdated: true` flag or a significant change in `localPlace` triggers the cartographer service.
    *   `currentMapNodeId` is updated based on the cartographer service's suggestions, explicit AI storyteller suggestions, or `selectBestMatchingMapNode`.
4.  **`Gameplay_Dialogue`**: Player in conversation. Map context provided to dialogue AI is derived from `MapData`.
5.  **`ModalView_X`**: Full-screen modals (MapDisplay, Settings, etc.).
6.  **`ErrorState`**: Handles errors.

### 2.2. Location Data Flow

*   **Storyteller AI (`storyteller/api`)**: Provides `sceneDescription`, `logMessage`, `localPlace`, and a `mapUpdated` flag.
*   **`useGameLogic`**:
    *   If `mapUpdated` is true or `localPlace` significantly changes, calls the cartographer service.
    *   Receives `AIMapUpdatePayload` from the cartographer service.
    *   Updates `FullGameState.mapData` based on this payload.
    *   If a new *main* `MapNode` is added by the cartographer service and lacks full description/aliases (as per `MAP_UPDATE_SYSTEM_INSTRUCTION`), `useGameLogic` calls `fetchFullPlaceDetailsForNewMapNode_Service` to populate them.
*   **Cartographer service**:
    *   Takes narrative context, current `MapData`, and known main place names for the theme.
    *   Uses an auxiliary AI to generate `AIMapUpdatePayload` (node/edge changes).
    *   Applies these changes, creating/updating/deleting `MapNode`s and `MapEdge`s within `MapData`.
    *   If a node is renamed via `nodesToUpdate`, any `nodesToRemove` entry with that old or new name is ignored.
*   **Map Data (`FullGameState.mapData`)**: Becomes the single source of truth for all map-related information (nodes, their descriptions, aliases, statuses, connections).
*   **Knowledge Base**: Focuses on characters currently.

### 2.3. Hierarchical Map System

`MapNode` objects can represent locations at several hierarchical levels. Each node **must specify** a `nodeType` (`region`, `location`, `settlement`, `exterior`, `interior`, `room`, or `feature`) **and a `status`** (`undiscovered`, `discovered`, `rumored`, `quest_target`, or `blocked`). Every node also includes a `parentNodeId` (use `"Universe"` for the root node) indicating its place in the hierarchy. Nodes are laid out near their parent in the map view. The hierarchy is represented solely with `parentNodeId`, replacing the old containment-edge approach. This allows the map to contain nested areas such as rooms within buildings or features within rooms.

Edges represent potentially traversable connections between *feature* nodes only. A valid edge connects sibling features (same parent), features whose parents share the same grandparent, **or a feature with the child of one of its sibling locations** (a child–grandchild connection). Edges with the type `shortcut` are exempt from these hierarchy rules and may link any two feature nodes directly. When the AI proposes a non-shortcut edge that violates the rules, the cartographer service incrementally climbs each node's parent chain, inserting connector feature nodes at every level until a common ancestor is reached. The edge is then rerouted through this chain rather than being skipped. Newly inserted connector features inherit their parent node's status (for example, connectors under rumored nodes remain rumored), and any replacement edges reuse the status from the connection they replace.

### 2.4. Map Layout and Visualization

The `MapDisplay` component visualizes nodes and edges stored in `MapData`. A nested circle layout is calculated with `applyNestedCircleLayout` from `mapLayoutUtils.ts` whenever the map view opens or layout sliders change.

* Each parent node encloses its children, positioned around the circumference of a circle sized to avoid overlaps.
* Layout parameters (`IDEAL_EDGE_LENGTH`, `NESTED_PADDING`, `NESTED_ANGLE_PADDING`, and label spacing values) are stored in `mapLayoutConfig` and can be tuned through `MapControls`.
* `useMapInteractions` enables panning and zooming the SVG view.
