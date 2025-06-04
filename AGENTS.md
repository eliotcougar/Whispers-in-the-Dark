
## Code style:
  - Add function-level comments, briefly explaining the purpose of the function.
  - Add module-level comments at the begginning of each file.
  - Maintain strict flow of Game State between the main game mode and separate modules.

## Testing

1. Ensure Node.js (version >=18) is installed.
2. Run `npm install` once to install dependencies.
3. Run `npm run build` to verify TypeScript compilation and bundling succeeds.

## Specific terms:
  - "REALITY SHIFT" - process of switching between Themes.
  - "Theme" - for the sets of stylistic details of each reality.
  - "Player"
  - "Item"
  - "Place"
  - "Character"

CURRENT_SAVE_GAME_VERSION string should always be a single incremental number, for example "1", "2", "3", etc...

## Main Game Flow:
 - Wait for Player's Input.
 - Construct the request prompt to the AI storyteller, using current Game State and Player's Input.
 - Wait for the response from AI storyteller.
 - Validate the data structures in the JSON response from AI storyteller.
 - Attempt to fix the errors in the response (for example, wrong name identifiers for game entities, missing fields) using special requests to a specialized auxiliary AI.
 - Construct the next Game State and Turn Changes objects.
 - Repeat.

## Unified visual style rules:
 - Close modal frame button grey, hover: red.
 - Other buttons colors different, but hover is always a step lighter.
 - input[type="range"] have custom style with an orange thumb.

## React Asynchronous State:
  - **BEWARE OF STALE STATE WITH ASYNC OPERATIONS!** When updating state based on previous state after an async operation (e.g., `await somePromise(); setState(prevState => ...)`), always use the functional update form of `setState(prevState => newState)` or ensure you are re-fetching/re-evaluating the `currentState` *after* the `await` and *before* the `setState` call if the state might have changed during the `await`. Directly using a variable that held `currentState` from before the `await` can lead to using stale data.
  - For complex state transitions involving multiple async steps, consider if a state machine or a more robust state management pattern is needed to ensure consistency.
  - Specifically within `useGameLogic` or similar hooks managing `FullGameState` (or any complex state object like `dialogueState`), if an async operation modifies parts of this state, the subsequent `commitGameState` (or equivalent state update function) must be based on the *most up-to-date version* of the `FullGameState` right before the commit. If multiple async operations could modify the state concurrently or in sequence, ensure a consistent draft state is passed through and updated, or re-fetch the latest global state before applying new changes and committing.
  - When dealing with state updates inside `useEffect` hooks that have dependencies, especially if those dependencies include stateful values that might be captured at the time the effect is set up:
    - If the effect performs an async operation and then updates state based on values that were present when the effect *ran*, those values might be stale if other state updates occurred during the async operation.
    - **Solution**: Use functional updates `setState(prevState => ...)`, or include all relevant stateful values in the `useEffect` dependency array and ensure the logic inside the effect correctly handles potentially changed values upon re-running. If an effect should only run once but needs to interact with evolving state, consider using `useRef` to hold a mutable reference to the latest state or state update functions, or refactor to pass latest state through callbacks.
    - **Example Problem**: `useEffect(() => { async function fetchData() { const data = await apiCall(); setState(currentValue + data); } fetchData(); }, [apiCall]);` If `currentValue` changes while `apiCall` is running, `setState` will use a stale `currentValue`.
    - **Example Fix**: `useEffect(() => { async function fetchData() { const data = await apiCall(); setState(prevValue => prevValue + data); } fetchData(); }, [apiCall]);`
