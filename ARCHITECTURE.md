
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
    *   `InventoryDisplay.tsx`: Manages the player's inventory, item interactions, and junk discarding.
    *   `GameLogDisplay.tsx`: Shows a history of game events.
    *   `DialogueDisplay.tsx`: Handles the UI for conversations with NPCs, using `MapNode` data for highlighting.
    *   `MapDisplay.tsx`: Visualizes the `MapData` for the current theme. Includes pan/zoom interactions and exposes layout tuning via `MapControls`.
    *   `MapNodeView.tsx`: Renders individual nodes within the map SVG.
    *   Modal Components (`ImageVisualizer.tsx`, `KnowledgeBase.tsx`, `SettingsDisplay.tsx`, `InfoDisplay.tsx`, `ThemeMemoryDisplay.tsx`, `DebugView.tsx`, `TitleMenu.tsx`): Provide focused views for specific functionalities. The `KnowledgeBase` now primarily focuses on Characters, with location information being map-centric.
    *   `LoadingSpinner.tsx`, `ErrorDisplay.tsx`: Provide feedback during loading or error states.
    *   `MainToolbar.tsx`: Contains buttons for primary game actions and information display, including opening the map.

### 1.2. Game Logic Layer (`useGameLogic` Hook)

*   **Location:** `hooks/useGameLogic.ts`
*   **Responsibilities:**
    *   Manages the core game state using a stack of `FullGameState` objects. This stack holds snapshots of the narrative world state (current theme name, scene, inventory, quests, objectives, player score, local time/environment/place, `dialogueState` object, `mapData` object for all map nodes and edges, `currentMapNodeId`, etc.).
    *   Handles player actions by constructing prompts for the AI based on the current game state.
    *   Orchestrates calls to AI services (main game turn, dialogue turns, summarization, corrections, map updates).
    *   Processes AI responses: parses JSON, validates data, and constructs a new `FullGameState`.
        *   If the storyteller AI's response includes `mapUpdated: true` or if `localPlace` changes significantly, it triggers the `mapUpdateService`.
        *   Applies the `AIMapUpdatePayload` returned by `mapUpdateService` to `FullGameState.mapData`.
        *   If `mapUpdateService` indicates a new main map node was added without full details, `useGameLogic` calls `fetchFullPlaceDetailsForNewMapNode_Service` to complete its data.
    *   Manages the "Reality Shift" mechanic (via `useRealityShift`), theme selection, and dialogue mode.
    *   Provides undo functionality by swapping the two-element `GameStateStack`.
    *   Determines `currentMapNodeId` based on AI suggestions or by using `selectBestMatchingMapNode` (which now uses `MapNode[]`).
    *   Delegates to sub hooks: `usePlayerActions`, `useDialogueFlow`, `useMapUpdates`, and `useGameInitialization`.
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
    *   `services/gameAIService.ts`: Handles main game turn AI calls and theme summarization.
    *   `services/dialogueService.ts`: Manages AI calls for dialogue turns and summaries. Dialogue context now uses `MapNode[]` for place information and it can summarize conversations so NPCs remember past talks.
    *   `services/correctionService.ts`: Attempts to fix malformed data from AI responses. `fetchFullPlaceDetailsForNewMapNode_Service` is key for completing main map node data.
    *   `services/mapUpdateService.ts`:
        *   Receives narrative context and current `MapData`.
        *   Prompts an auxiliary AI (using `MAP_UPDATE_SYSTEM_INSTRUCTION`) to get an `AIMapUpdatePayload`.
        *   Parses, validates (using `mapUpdateValidationUtils.ts`), and applies this payload to the `MapData`, resolving place names to node IDs or creating new nodes/edges.
    *   `services/mapCorrectionService.ts`: Prunes and refines map connection chains using AI after updates.
    *   `services/mapRenameService.ts`: Assigns thematic names and descriptions to new map nodes and edges.
    *   `services/modelDispatcher.ts`: Provides AI model fallback when dispatching requests.
*   **Data Processing & Validation:**
    *   `services/aiResponseParser.ts`: Parses the storyteller AI's JSON, validates, and attempts corrections. It now ignores `placesAdded`/`placesUpdated` fields, relying on the `mapUpdated` flag.
    *   `services/validationUtils.ts`: General data structure validation.
    *   `utils/mapUpdateValidationUtils.ts`: Specific validation for `AIMapUpdatePayload`.
*   **Persistence Service:**
    *   `services/saveLoadService.ts`: Handles saving/loading. `FullGameState` now includes `mapData` and `currentMapNodeId`. The `allPlaces` list is removed from `SavedGameDataShape`. Conversion logic from older save versions updates them to use `mapData`.
*   **Utility Functions:**
    *   `utils/promptFormatters.ts`: Now formats `MapNode[]` instead of `Place[]` for AI prompts regarding locations.
    *   `utils/mapNodeMatcher.ts`: `selectBestMatchingMapNode` now operates on `MapNode[]`.
    *   `utils/mapPruningUtils.ts`: Introduces temporary feature nodes to restructure problematic main node connections before refinement.
    *   `utils/mapHierarchyUpgradeUtils.ts`: Upgrades feature nodes with children into regions and inserts connector nodes.
    *   `utils/mapLayoutUtils.ts`: Performs nested circle and force-directed layout for map visualization.

### 1.4. Data Layer

*   **Type Definitions:**
    *   `types.ts`: Defines `FullGameState` (with `mapData: MapData`, `currentMapNodeId: string | null`, `mapLayoutConfig: MapLayoutConfig`), `MapData`, `MapNode`, `MapEdge`, `AIMapUpdatePayload`, etc. The `Place` type is deprecated as a primary game state element for locations.
*   **Constants & Configuration:**
    *   `constants.ts`: Global constants, model names, and system prompts, including `MAP_UPDATE_SYSTEM_INSTRUCTION`.
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
    *   The storyteller AI response's `mapUpdated: true` flag or a significant change in `localPlace` triggers the `mapUpdateService`.
    *   `currentMapNodeId` is updated based on `mapUpdateService` suggestions, explicit AI storyteller suggestions, or `selectBestMatchingMapNode`.
4.  **`Gameplay_Dialogue`**: Player in conversation. Map context provided to dialogue AI is derived from `MapData`.
5.  **`ModalView_X`**: Full-screen modals (MapDisplay, Settings, etc.).
6.  **`ErrorState`**: Handles errors.

### 2.2. Location Data Flow

*   **Storyteller AI (`gameAIService`)**: Provides `sceneDescription`, `logMessage`, `localPlace`, and a `mapUpdated: boolean` flag. It no longer directly outputs `placesAdded` or `placesUpdated`.
*   **`useGameLogic`**:
    *   If `mapUpdated` is true or `localPlace` significantly changes, calls `mapUpdateService`.
    *   Receives `AIMapUpdatePayload` from `mapUpdateService`.
    *   Updates `FullGameState.mapData` based on this payload.
    *   Refines problematic connection chains via `mapCorrectionService` which prunes temporary leaves and applies AI suggestions.
    *   If a new *main* `MapNode` is added by `mapUpdateService` and lacks full description/aliases (as per `MAP_UPDATE_SYSTEM_INSTRUCTION`), `useGameLogic` calls `fetchFullPlaceDetailsForNewMapNode_Service` to populate them.
*   **`mapUpdateService`**:
    *   Takes narrative context, current `MapData`, and known main place names for the theme.
    *   Uses an auxiliary AI to generate `AIMapUpdatePayload` (node/edge changes).
    *   Applies these changes, creating/updating/deleting `MapNode`s and `MapEdge`s within `MapData`.
    *   If a node is renamed via `nodesToUpdate`, any `nodesToRemove` entry with that old or new name is ignored.
*   **Map Data (`FullGameState.mapData`)**: Becomes the single source of truth for all map-related information (nodes, their descriptions, aliases, statuses, connections).
*   **Knowledge Base**: No longer displays "Places". Character information remains. Location understanding comes from interacting with and viewing the `MapDisplay`.

This map-centric refactor centralizes location data management, making it more robust and scalable, with the `mapUpdateService` acting as a specialized agent for interpreting narrative cues into concrete map changes.

### 2.3. Hierarchical Map System

`MapNode` objects can represent locations at several hierarchical levels. Each node **must specify** a `nodeType` (`region`, `location`, `settlement`, `exterior`, `interior`, `room`, or `feature`) **and a `status`** (`undiscovered`, `discovered`, `rumored`, or `quest_target`). Every node also includes a `parentNodeId` (use `"Universe"` for the root node) indicating its place in the hierarchy. Nodes are laid out near their parent in the map view. The hierarchy is represented solely with `parentNodeId`, replacing the old containment-edge approach. This allows the map to contain nested areas such as rooms within buildings or features within rooms.

Edges represent traversable connections between *feature* nodes only. A valid edge connects sibling features (same parent), features whose parents share the same grandparent, **or a feature with the child of one of its sibling locations** (a child–grandchild connection). Edges with the type `shortcut` are exempt from these hierarchy rules and may link any two feature nodes directly. When the AI proposes a non-shortcut edge that violates the rules, `mapUpdateService` incrementally climbs each node's parent chain, inserting connector feature nodes at every level until a common ancestor is reached. The edge is then rerouted through this chain rather than being skipped. Newly inserted connector features inherit their parent node's status (for example, connectors under rumored nodes remain rumored), and any replacement edges reuse the status from the connection they replace.

### 2.4. Map Layout and Visualization

The `MapDisplay` component renders `MapData` using a hierarchical force‑directed algorithm defined in `mapLayoutUtils.ts`.

* A bottom‑up nested circle pass allocates enough space for each node's children before a force layout step.
* Layout parameters (`K_REPULSION`, `IDEAL_EDGE_LENGTH`, etc.) are persisted in `mapLayoutConfig` and can be tweaked through the `MapControls` UI.
* `useMapInteractions` enables panning and zooming the SVG view.
