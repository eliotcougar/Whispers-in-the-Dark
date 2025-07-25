
## First of all
  - CRITICALLY IMPORTANT: ALWAYS exclude /dist/* and /node_modules/* from grep and other lookup and search commands.

## Testing
  1. Run `npm run typecheck` to verify strict type safety. It can take a long time to complete, be patient.
  2. Run `npm run lint` to check for any linting errors and warnings that must be fixed. It can take a long time to complete, be patient.
  3. Run `npm run build` to verify TypeScript compilation and bundling succeeds.
  4. If asked by the user, run `npm run test:unit` to run unit tests.
  5. If asked by the user to run strict linting, run `npm run lint-strict` and address any errors and warnings that must be fixed. It can take a long time to complete, be patient.
  6. If there are auto-fixable warnings, you can easily auto-fix them using `npm run lint:fix` or `npm run lint-strict:fix`.

## Specific terms:
  - "REALITY SHIFT" - process of switching between Themes;
  - "Theme" - for the sets of stylistic details of each reality;
  - "Player";
  - "Item";
  - "Place" - refers to Map Nodes in the AI prompts;
  - "NPC" - the word 'character' is reserved for "Player's Character" and "printable characters" (chars);
  - "Node" - for the map graph;
  - "Edge" - for the map graph;
  - "Alias" - alternative names, partial names, shorthands for various entities like Places and NPCs.

  CURRENT_SAVE_GAME_VERSION string should always be a single incremental number, for example "1", "2", "3", etc...
  ID suffix is 4 character alphanumeric: ${Math.random().toString(36).substring(2,6)}

## Main Game Flow:
  - Wait for Player's Input.
  - Construct the request prompt to the AI storyteller using current Game State and Player's Input.
  - Wait for the response from AI storyteller API.
  - Validate the data structures in the JSON response from AI storyteller. Attempt to fix the errors in the response (for example, wrong name identifiers for game entities, missing fields) using in-place heuristics or using special requests to correction AIs.
  - Pass the results to the additional AIs that operate the map structure, inventory, dialogue, and everything else. Attempt to fix the errors in their responses (for example, wrong name identifiers for game entities, missing fields) using in-place heuristics or using special requests to correction AIs.
  - Construct the next Game State and Turn Changes objects.
  - Repeat.

## Code and Prompts synchronization:
  - When making changes to the data structures and code, always make sure the AI prompts used by the game are in agreement with the changes you make.
  - Try to centralize common enums and constants in one place, and import them as necessary.
  - Use the defined common enums to define type properties that can take a limited set of values.
  - Reuse JSON helpers from `utils/jsonUtils.ts` (`extractJsonFromFence`, `safeParseJson`, `coerceNullToUndefined`) instead of hand-written parsing logic.

## Unified visual style rules:
  - Close modal frame button grey, hover: red.
  - Other buttons colors different, but hover is always a step lighter.

## Teach the user:
  - The user is learning programming. Take an opportunity to shortly teach the user about the logic behind the changes you make in the general chat (not in the code).

## Code Style Guide (ESLint)
  - Documentation of JSX eslint rules: https://github.com/jsx-eslint/eslint-plugin-react/tree/master/docs/rules
  - Avoid binding in JSX. (`react/function-component-definition`, `react/jsx-no-bind`)
  - Do not use array indices as keys. (`react/no-array-index-key`)
  - Keep JSX indentation at 2 spaces and limit nesting depth to 4. (`react/jsx-indent`, `react/jsx-indent-props`, `react/jsx-max-depth`)
  - Alphabetically sort JSX props and default props. (`react/jsx-sort-props`, `react/sort-default-props`)
  - Provide default props for optional values. (`react/require-default-props`)
  - Component props should be read-only. (`react/prefer-read-only-props`)
  - Use `Array<T>` syntax instead of `T[]`. (`@typescript-eslint/array-type`)
  - Use `Record<K, V>` for indexed objects. (`@typescript-eslint/consistent-indexed-object-style`)
  - Avoid non-null assertions and prefer nullish coalescing. (`@typescript-eslint/no-non-null-assertion`, `@typescript-eslint/prefer-nullish-coalescing`)
  - Use `unknown` in catch clauses. (`@typescript-eslint/use-unknown-in-catch-callback-variable`)
  - Limit template and arithmetic expressions to compatible types. (`@typescript-eslint/restrict-template-expressions`, `@typescript-eslint/restrict-plus-operands`)
  - Use dot notation whenever possible. (`@typescript-eslint/dot-notation`)
  - Hooks must follow the rules of hooks. (`react-hooks/rules-of-hooks`)
  - Using console.log() for debug logging is okay at this stage of development.

## Reference
  - Read `ARCHITECTURE.md` for a general overview of the codebase structure.
