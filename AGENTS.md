
## First of all
  - pull the commits to avoid working on outdated code.

## Testing
1. Run `npm run typecheck` to verify strict type safety. It can take a long time to complete, be patient.
2. Run `npm run lint` to check for any linting errors and warnings that must be fixed. It can take a long time to complete, be patient.
3. Run `npm run build` to verify TypeScript compilation and bundling succeeds.

## Specific terms:
  - "REALITY SHIFT" - process of switching between Themes.
  - "Theme" - for the sets of stylistic details of each reality.
  - "Player"
  - "Item"
  - "Place" - refers to Map Nodes in the AI prompts
  - "Character"
  - "Node" - for the map graph
  - "Edge" - for the map graph
  - "Alias" - alternative names, partial names, shorthands for various entities like Places and Characters.

CURRENT_SAVE_GAME_VERSION string should always be a single incremental number, for example "1", "2", "3", etc...

## Main Game Flow:
 - Wait for Player's Input.
 - Construct the request prompt to the AI storyteller using current Game State and Player's Input.
 - Wait for the response from AI storyteller API.
 - Validate the data structures in the JSON response from AI storyteller.
 - Attempt to fix the errors in the response (for example, wrong name identifiers for game entities, missing fields) using in-place heuristics or using special requests to an auxiliary AI.
 - Construct the next Game State and Turn Changes objects.
 - Repeat.

## Code and Prompts synchronization:
 - When making changes to the data structures and code, always make sure the AI prompts used by the game are in agreement with the changes you make.
 - Try to centralize common enums and constants in one place, and import them as necessary.
 - Use the defined common enums to define type properties that can take a limited set of values.

## Unified visual style rules:
 - Close modal frame button grey, hover: red.
 - Other buttons colors different, but hover is always a step lighter.
 - input[type="range"] have custom style with an orange thumb.

## Teach the user:
 - The user is learning programming. Take an opportunity to shortly teach the user about the logic behind the changes you make in the general chat (not in the code).

## Reference
 - Read `ARCHITECTURE.md` for a general overview of the code structure before making significant changes.
