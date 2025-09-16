# Repository Guidelines

## Project Structure & Module Organization
- App UI: `components/` (e.g., `components/app`, `components/modals`).
- Game logic: `hooks/` (e.g., `useGameLogic`, `useGameInitialization`, dialogue and turn helpers).
- Domain services: `services/` (storyteller, cartographer, dialogue, image, librarian, worldData, storage, thinkingConfig, modelDispatcher).
- Utilities: `utils/` (prompt formatters, entity and map helpers, JSON helpers).
- Types and constants: `types.ts`, `constants.ts`.
- Static resources: `resources/`.
- Tests: `tests/` (Vitest).

Tip: exclude `dist/`, `release/`, and `node_modules/` from searches.

## Build, Test, and Development Commands
- `npm run typecheck` — strict TypeScript checks (no emit).
- `npm run lint` — lint code; fails on errors, warns on style issues.
- `npm run lint:fix` — auto-fixable lint issues.
- `npm run lint-strict` — strict lint code; fails on errors, warns on style issues.
- `npm run lint-strict:fix` — auto-fixable strict lint issues.
- `npm run build` — production build (TypeScript + bundling).
- `npm run test:unit` — run unit tests (Vitest).

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
   - `loremaster_collect`: pick 10 facts (reason: `loremaster_collect`).
   - `loremaster_extract`: extract new facts (stage after storyteller; reason: `loremaster_extract`).
   - `loremaster_integrate`: integrate/merge into lore (reason: `loremaster_integrate`).
   - `loremaster_distill`: periodic consolidation (reason: `loremaster_distill`).
- Cartographer updates the map graph (nodes/edges) from hints; features belong to main areas.
- Dialogue Mode: AI returns NPC lines and options; memory summaries are written to NPCs.
- Images: Visualizer prompts Imagen 4; falls back to Gemini image streaming when needed.

## Common Pitfalls
- Skipping JSON helpers: always use `utils/jsonUtils` (e.g., `extractJsonFromFence`, `safeParseJson`) and validate against schemas before applying AI output.
- Underscore IDs: all generated IDs use hyphens (e.g., `node-foo-1a2b`); do not introduce underscores.
- Prompt/code drift: when changing types or enums, update prompts and schemas in `services/*/systemPrompt.ts` and API wrappers.
- Dialogue naming: use `heroShortName` in dialogue logs and prompts; avoid hardcoding “Player”.
- Settings propagation: when adding settings, persist via `services/storage.ts` and include in hook dependency lists to avoid stale values.
- Search noise: exclude `dist/`, `release/`, and `node_modules/` when grepping for references.
- Act transitions: do NOT auto‑generate a new scene when switching acts; only show the New Act modal while background lore updates run.
- Map integrity: ensure edges connect existing nodes within the theme; filter hidden/collapsed statuses in prompts.
- Performance: prefer `Set`/`Map` for membership checks in hot paths (e.g., NPC/name matching, node lookups).
- Image safety: sanitize visual prompts; never pass raw user text directly to image models.

## Unified visual style rules:
- Close modal frame button grey, hover: red.
- Other buttons colors different, but hover is always a step lighter.

## Teach the user:
- The user is learning programming. Take an opportunity to shortly teach the user about the logic behind the changes you make in the general chat (not in the code).

## Codex CLI Command Playbook for using Windows PowerShell
- **Current directory**: `Get-Location`
- **List directory contents**: `Get-ChildItem -Path <dir>`; run it inside the target folder to avoid `node_modules` noise.
- **Read an entire file**: `type <path>` for quick paging-safe output.
- **Read the first lines**: `Get-Content -Path <path> -Head <n>` keeps control of large files.
- **Inspect a line range**: `pwsh -Command "(Get-Content -Path <path>)[start..end]"` to verify targeted edits.
- **Literal token search**: `findstr /N <token> <path>` for fast, line-numbered matches.
- **Regex or glob search**: `Select-String -Pattern <regex> -Path "<glob>"` for multi-file scans.
- **Create or overwrite multiline files**: `pwsh -Command "@'...content...'@ | Set-Content -Path <path>"` guarantees proper newlines.
- **Append a line**: `Add-Content -Path <path> -Value "text"` for safe additions.
- **Create an empty file**: `New-Item -Path <path> -ItemType File -Force` when placeholders are needed.
- **Delete a file**: `Remove-Item <path>` run separately per file to avoid binding errors.
- **Check git status**: `git status -sb` before and after edits.
- **Apply a handcrafted diff**: `pwsh -Command "@'diff...'@ | git apply -"` to stream the patch via stdin without temporary files.
