# Repository Guidelines

## Tooling Notes
- You work under Bash, or Git Bash console. Do not use PowerShell.
- When piping Windows paths into POSIX tools, translate backslashes (e.g., `tr '\\' '/'`) or use fd's `--path-separator '//'` to avoid escape parsing.
- `fd` 10.3.0 is available;
- `fzf` 0.65.1 is available;
- `rg` 14.1.1 is available;

## Build, Test, and Development Commands
- `npm run typecheck` — strict TypeScript checks (no emit).
- `npm run lint` — lint code; fails on errors, warns on style issues.
- `npm run lint:fix` — auto-fixable lint issues.
- `npm run lint-strict` — strict lint code; fails on errors, warns on style issues.
- `npm run lint-strict:fix` — auto-fixable strict lint issues.
- `npm run build` — production build (TypeScript + bundling).
- `npm run test:unit` — run unit tests (Vitest).

## Project Structure & Module Organization
- App UI: `components/` (e.g., `components/app`, `components/modals`).
- Game logic: `hooks/` (e.g., `useGameLogic`, `useGameInitialization`, dialogue and turn helpers).
- Domain services: `services/` (storyteller, cartographer, dialogue, image, librarian, worldData, storage, thinkingConfig, modelDispatcher).
- Utilities: `utils/` (prompt formatters, entity and map helpers, JSON helpers).
- Types and constants: `types.ts`, `constants.ts`.
- Static resources: `resources/`.
- Tests: `tests/` (Vitest).

Tip: exclude `dist/`, `release/`, and `node_modules/` from searches.

## Coding Style & Naming Conventions
- TypeScript + React; 2‑space indentation; avoid deep JSX nesting (>4).
- Prefer read‑only component props; avoid binding in JSX.
- Arrays: use `Array<T>` notation; use `Record<K, V>` for index maps.
- Avoid non‑null assertions; prefer safe guards/nullish coalescing.
- Use dot notation; follow rules of hooks.
- IDs and entity keys: alphanumeric + hyphen (no underscores). Random suffix: 4 chars.
- Use shared helpers: `utils/jsonUtils` (e.g., `extractJsonFromFence`, `safeParseJson`).

## Testing Guidelines
- Framework: Vitest. Place unit tests under `tests/` as `*.test.ts`.
- Write focused tests near the logic (utils, services, hooks). Run with `npm run test:unit`.
- Keep tests deterministic; mock external APIs.

## Commit & Pull Request Guidelines
- Keep commits scoped and descriptive (e.g., `feat(dialogue): trim history before prompt`).
- PRs should include: purpose summary, key changes, testing notes, and screenshots when UI is affected.
- Link related issues; call out breaking changes and migration steps.

## Security & Configuration Tips
- Never hard‑code API keys. The app reads the Gemini key at runtime (see “API Key” modal).
- Treat external model responses as untrusted: always parse via `jsonUtils` and validate against schemas.

## Architecture Overview (Quick)
- Turn loop: Player input → prompt build → AI call → robust JSON parse/repair → services apply changes (map, inventory, dialogue) → next state.
- Keep services decoupled; share enums/constants from `constants.ts` and types from `types.ts`.
- See the deeper design notes in [ARCHITECTURE.md](ARCHITECTURE.md).

## Gameplay Flow (Domain‑Specific)
- Storyteller drives scenes and options via strict JSON schemas (`services/storyteller`).
 - Loremaster modes unify FSM stages and loading reasons:
   - `loremaster_collect`: pick 10 facts.
   - `loremaster_extract`: extract new facts.
   - `loremaster_integrate`: integrate/merge into lore.
   - `loremaster_distill`: periodic consolidation.
- Cartographer updates the map graph (nodes/edges) from hints; features belong to main areas.
- Dialogue Mode: AI returns NPC lines and options; memory summaries are written to NPCs.
- Images: Visualizer prompts Imagen 4; falls back to Gemini image streaming when needed.

## Common Pitfalls
- Skipping JSON helpers: always use `utils/jsonUtils` (e.g., `extractJsonFromFence`, `safeParseJson`) and validate against schemas before applying AI output.
- ID suffixes: all generated IDs use hyphens (e.g., `node-foo-1a2b`); do not introduce underscores.
- Prompt/code drift: when changing types or enums, update prompts and schemas in `services/*/systemPrompt.ts` and API wrappers.
- Dialogue naming: use `heroShortName` in dialogue logs and prompts; avoid hardcoding “Player”.
- Settings propagation: when adding settings, persist via `services/storage.ts` and include in hook dependency lists to avoid stale values.
- Search noise: exclude `dist/`, `release/`, and `node_modules/` when grepping for references.
- Act transitions: do NOT auto‑generate a new scene when switching acts; only show the New Act modal while background lore updates run.
- Map integrity: ensure edges connect existing 'feature' nodes; filter hidden/collapsed statuses in prompts.
- Performance: prefer `Set`/`Map` for membership checks in hot paths (e.g., NPC/name matching, node lookups).
- Image safety: sanitize visual prompts; never pass raw user text directly to image models.

## Unified visual style rules:
- Close modal frame button grey, hover: red.
- Other buttons colors different, but hover is always a step lighter.

## Teach the user:
- The user is learning programming. Take an opportunity to shortly teach the user about the logic behind the changes you make in the general chat (not in the code).
