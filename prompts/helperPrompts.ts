/**
 * @file helperPrompts.ts
 * @description Utility prompt snippets used across multiple AI requests.
 */

import {
  REGULAR_ITEM_TYPES_STRING,
  WRITTEN_ITEM_TYPES_STRING,
  ROOT_MAP_NODE_ID,
} from '../constants';

export const REGULAR_ITEM_TYPES_GUIDE = `Valid item "type" values are: ${REGULAR_ITEM_TYPES_STRING}.
- "single-use": Consumed after one use (e.g., potion, one-shot scroll, stimpak, medicine pill, spare part). Assumed to be stored in player's pockets/bag/backpack. Excludes any written material. Cannot be worn on a person directly.
- "multi-use": Can be used multiple times (e.g., lockpick set, toolkit, medkit). Can have limited number of uses, indicated in brackets after the name, or in the description. Assumed to be stored in player's pockets/bag/backpack. Cannot be worn on a person directly.
- "equipment": Can be worn on a person, or wielded (e.g., armor, shield, helmet, lantern, flashlight, crowbar). Can have active/inactive states.
- "container": Can hold things. Describe if empty/full, intended contents (solid, liquid, gas), e.g., "Empty Canteen", "Flask of Oil". Use directives to note refills/empties.
- "key": Unlocks specific doors, chests, portals, or similar. Description should hint at its purpose, e.g., "Ornate Silver Key (for a large chest)". Can be 'lost' or 'updated' (e.g., to "Bent Key") after use.
- "weapon": Melee and ranged weapons, distinct from "equipment" items that can be explicitly used in a fight when wielded. Ranged weapon consume ammunition or charges.
- "ammunition": For reloading specific ranged weapons, e.g., Arrows for Longbow, Rounds for firearms, Charges for energy weapons. Using weapon consumes ammo (handled by updates).
- "vehicle": Player's current transport (if isActive: true) or one they can enter if adjacent to it. Integral parts (mounted guns, cargo bays) are 'knownUses', NOT separate items unless detached. Directives should mention activation/deactivation and who controls it.
- "immovable": Built-in or heavy feature at a location (e.g., control panel or machinery). Cannot be moved or stored. Interact using known uses or generic attempts.
- "status effect": Temporary condition, positive or negative, generally gained and lost by eating, drinking, environmental exposure, impacts, and wounds. 'isActive: true' while affecting player. 'description' explains its effect, e.g., "Poisoned (move slower)", "Blessed (higher luck)", "Wounded (needs healing)".`;

export const WRITTEN_ITEM_TYPES_GUIDE = `Written item types (${WRITTEN_ITEM_TYPES_STRING}):
  - "page": Single sheet, scroll, or a digital device that can display some static text. Treat it as a one-chapter entry; include content length hints.
  - "book": Multi-page text with "chapters", paper-based or digital. Each chapter needs {"heading", "description", "contentLength"}; prefer 3-5 chapters unless context demands otherwise.
  - "picture": Single image such as a photograph, drawing, or painting. Use ONE chapter to describe what the image portrays in detail.
  - "map": Hand-drawn or printed diagram showing terrain, directions, floor plan, or schematic. Use ONE chapter to describe the layout and any notable markings, labels, or legends.`;

export const ITEM_TYPES_GUIDE = `${REGULAR_ITEM_TYPES_GUIDE}\n${WRITTEN_ITEM_TYPES_GUIDE}`;

export const ITEMS_GUIDE = `Generate concise "itemDirectives". Each directive MUST include:
- "directiveId": short unique id per turn (e.g., "note-4ax2").
- "instruction": free-form description of the observed or required change.
- Optional "itemIds": reference known item ids when present.
- Optional "provisionalNames": labels for items not yet tracked.
- Optional "suggestedHandler": "inventory", "librarian", "either", or "unknown".
- Optional "metadata": for urgency/confidence if needed.

Directive content requirements:
- Always mention holder/location and active state when it changes (picked up, dropped, equipped, stashed).
- Include item type or purpose cues (Potion, Sword, Map, Statuette, Status Effect, etc.) so downstream services can build structured data without guessing.
- For written content, describe what the text conveys (chapters/topics, number of stanzas/pages, tone) and where it was found or stored.
- For creations, call out where the item ends up and why it matters; if transformed, include the original name/id when possible.
- For moves/updates/destroys, be explicit about before/after state and who owns or witnesses it.
- Use one directive per coherent change; split only when separate handlers need distinct actions.
- NEVER emit the legacy hint fields or "newItems".

Examples (concise text, not JSON payloads):
- {directiveId: "note-lantern-3fj2", itemIds: "item-old-lantern-7fr4", instruction: "Player snatches the Old Lantern from the workbench and tucks it into their satchel, keeping it unlit."}
- {directiveId: "note-etched-plate-9kdm", provisionalNames: ["Etched Plague Tablet"], suggestedHandler: "librarian", instruction: "Bronze tablet slides from the altar; script describes the rite of cleansing in three stanzas."}
- {directiveId: "note-tonic-1pqa", suggestedHandler: "inventory", instruction: "Raen mixes two vials and leaves the resulting Nightglass Tonic on the infirmary tray for anyone to take; treat as a fresh potion."}
- {directiveId: "note-status-8uhs", itemIds: "status-curse-1ax4", instruction: "A miasma clings to the player; they suffer a lingering curse until the shrine is cleansed."}

${ITEM_TYPES_GUIDE}

- ALWAYS note when a status effect starts or ends.
- Mention remaining uses for multi-use items when they change.
- NEVER add people, NPCs, or map locations as items.`;

export const MAP_NODE_TYPE_GUIDE = `Map Node Types:
- region: Broad area containing multiple locations.
- location: Significant named place within a region.
- settlement: Inhabited location such as a town or base.
- district: Subdivision of a settlement or complex, including streets or sectors.
- exterior: Outside of a single structure or vehicle.
- interior: Inside of a structure or vehicle.
- room: Individual enclosed space within an interior.
- feature: Notable sub-location or landmark within any other node.`;

export const MAP_EDGE_TYPE_GUIDE = `Map Edge Types:
- path: Narrow walking trail or hallway.
- road: Major route or street for ground travel.
- sea route: Travel across open water or space lanes.
- door: Physical entry like doors, gates, hatches, or airlocks.
- teleporter: Instant or rapid transit portals and lifts.
- secret_passage: Hidden or maintenance passageway.
- river_crossing: Means of crossing water or similar obstacles.
- temporary_bridge: Deployable link such as a boarding tube or rope bridge.
- boarding_hook: Grappling device to connect to a moving object.
- shortcut: Any special connection that bypasses hierarchy rules.`;

export const MAP_NODE_HIERARCHY_GUIDE = `Map Node Hierarchy:
- A "region" can contain "locations".
- A "location" can contain "settlements".
- A "settlement" can contain "districts".
- A "district" can contain "exteriors".
- An "exterior" can contain "interiors".
- An "interior" can contain "rooms".
- A "room" can contain "features".
- The "${ROOT_MAP_NODE_ID}" is the root node, it can contain any other nodes.
- A "feature" can be placed anywhere in the hierarchy, but can never be a parent to any other node.
- Only "feature" nodes can be connected to each other with edges.`;

export const LOCAL_CONDITIONS_GUIDE = `- You MUST provide "localTime", "localEnvironment", "localPlace" in the response.
- "localTime" should be a very short phrase (e.g., "Dawn", "Mid-morning", "Twilight", "Deep Night", "Temporal Flux").
- "localEnvironment" should be a concise sentence describing immediate ambient conditions (e.g., "A gentle breeze rustles leaves.", "The air is stale and smells of decay.", "Rain lashes against the windows.", "A low hum pervades the metallic corridor.").
- "localPlace" is a free-form string describing the player's current specific position.
  - It can use relational words with a known Map Node (which represent main locations or significant features, e.g., "inside the Old Mill", "in front of the Stone Altar").
  - It can describe positions between known Map Nodes (e.g., "on the path between the Whispering Woods and the Crystal Cave", "en-route from Port Blacksand to the Serpent's Isle").
  - The new "localPlace" must be a logical continuation from the previous "localPlace", considering the player's action and the scene's outcome. Update "localPlace" whenever the player moves, their immediate surroundings change significantly, or they transition between distinct areas.
- These details MUST be updated as the narrative progresses and be in agreement with the "sceneDescription".
`;
