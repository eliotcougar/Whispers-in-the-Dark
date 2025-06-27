
/**
 * @file helperPrompts.ts
 * @description Utility prompt snippets used across multiple AI requests.
 */

import {
  VALID_ITEM_TYPES_STRING,
  VALID_TAGS_STRING,
  WRITING_TAGS_STRING,
  MIN_BOOK_CHAPTERS,
  MAX_BOOK_CHAPTERS,
} from '../constants';

export const ITEM_TYPES_GUIDE = `Valid item "type" values are: ${VALID_ITEM_TYPES_STRING}.
- "single-use": Consumed after one use (e.g., potion, one-shot scroll, stimpak, medicine pill, spare part). Assumed to be stored in player's pockets/bag/backpack. Excludes any written material. Cannot be worn on a person directly.
- "multi-use": Can be used multiple times (e.g., lockpick set, toolkit, medkit). Can have limited number of uses, indicated in brackets after the name, or in the description. Assumed to be stored in player's pockets/bag/backpack. Cannot be worn on a person directly.
- "equipment": Can be worn on a person, or wielded (e.g., armor, shield, helmet, lantern, flashlight, crowbar). Can have active/inactive states.
- "container": Can hold things. Describe if empty/full, intended contents (solid, liquid, gas), e.g., "Empty Canteen", "Flask of Oil". Use 'update' to change its description/state (e.g., from empty to full). Full conainer can provide a number of uses until it is empty again (can drink from full bottle several times).
- "key": Unlocks specific doors, chests, portals, or similar. Description should hint at its purpose, e.g., "Ornate Silver Key (for a large chest)". Can be 'lost' or 'updated' (e.g., to "Bent Key") after use.
- "weapon": Melee and ranged weapons, distinct from "equipment" Items that can be explicitly used in a fight when wielded. Ranged weapon consume ammunition or charges.
- "ammunition": For reloading specific ranged weapons, e.g., Arrows for Longbow, Rounds for firearms, Charges for energy weapons. Using weapon consumes ammo (handled by log/update).
- "vehicle": Player's current transport (if isActive: true) or one they can enter if adjacent to it. Integral parts (mounted guns, cargo bays) are 'knownUses', NOT separate items unless detached. If player enters a vehicle, note in "playerItemsHint" that it becomes active. If they exit, note that it becomes inactive. Include the vehicle in "newItems" only when first introduced.
  - "page": Single sheet or scroll. Follows the same structure as a one-chapter "book". Always provide a numeric "contentLength" for the page text.
  - "book": Multi-page text with "chapters". Journals are blank books that start with no chapters and gain new entries when the player writes. Each chapter MUST have {"heading", "description", "contentLength"}.
- "status effect": Temporary condition, positive or negative, generally gained and lost by eating, drinking, environmental exposure, impacts, and wounds. 'isActive: true' while affecting player. 'description' explains its effect, e.g., "Poisoned (move slower)", "Blessed (higher luck)", "Wounded (needs healing)". 'lost' when it expires.
`;

export const ITEMS_GUIDE = `Generate inventory hints using these fields:
- "playerItemsHint": short summary of gains, losses or state changes for the Player.
- "worldItemsHint": short summary of items dropped or discovered in the environment.
- "npcItemsHint": short summary of items held or used by NPCs.
- "newItems": array of brand new items introduced this turn, or [] if none.

Each object in "newItems" should include:
  {
    "name": "Item Name",
    "type": "one of ${VALID_ITEM_TYPES_STRING}",
    "description": "Short description",
    "activeDescription"?: "When active",
    "isActive"?: false,
    "tags"?: ["junk"], /* Valid tags: ${VALID_TAGS_STRING}. */
    "knownUses"?: [
      {
        "actionName": "Action text",
        "promptEffect": "Prompt sent to the AI",
        "description": "Player hint",
        "appliesWhenActive"?: false,
        "appliesWhenInactive"?: false
      }
    ]
  }

Examples illustrating the hint style:
- Example for gaining a new item:
  playerItemsHint: "Picked up Old Lantern."
  newItems: [{
    "name": "Old Lantern",
    "type": "equipment",
    "description": "A dusty old lantern that still flickers faintly.",
    "activeDescription": "The lantern is lit and casts a warm glow.",
    "isActive": false,
    "tags": [],
    "knownUses": [
      {
        "actionName": "Light the Lantern",
        "promptEffect": "Light the lantern to illuminate the area.",
        "description": "Use this to light your way in dark places.",
        "appliesWhenActive": true,
        "appliesWhenInactive": false
      }
    ]
  }]

- Example for putting a new item into another inventory or location:
  npcItemsHint: "Guard now carries Rusty Key."
  newItems: [{
    "name": "Rusty Key",
    "type": "key",
    "description": "Opens an old door.",
    "tags": [],
    "holderId": "npc_guard_4f3a"
  }]

- Example for a short page item:
  playerItemsHint: "Found Smudged Note."
  newItems: [{
    "name": "Smudged Note",
    "type": "page",
    "description": "A hastily scribbled message with a big smudge over it.", /* REQUIRED. Moderatly detailed description of the note and its contents. Should NEVER include direct quotes of the contents. */
    "tags": ["typed", "smudged"], /* Tags describing the page. Use one or two from: ${WRITING_TAGS_STRING}. */
    "chapters": [ /* REQUIRED. Always a single chapter. */
      { "heading": "string", /* REQUIRED. Can be anything*/
        "description": "A hastily scribbled message about the dangers of the sunken tunnel.", /* REQUIRED. Moderately detailed abstract of the contents. */
        "contentLength": 50 /* REQUIRED. Length of the content in words. */
      }
    "holderId": "player"
  }]

- Example for a simple book:
  playerItemsHint: "Obtained the Explorer's Adventures."
  newItems: [{
    "name": "Explorer's Adventures",
    "type": "book",
    "description": "Weathered log of travels.", /* Should NEVER include any direct quotes from the book contents. */
    "tags": ["handwritten", "faded"], /* Tags describing the page. Use one or two from: ${WRITING_TAGS_STRING}. */
    "chapters": [ /* Anywhere from ${String(MIN_BOOK_CHAPTERS)} to ${String(MAX_BOOK_CHAPTERS)} chapters. */
      { "heading": "Preface", /* REQUIRED. Short Title of the chapter*/
        "description": "Introduction. Written by the author, explaining his decisions to start his travels.", /* REQUIRED. Short, but detailed abstract of the contents of the chapter. */
        "contentLength": 50 /* REQUIRED. Length of the content in words. Range: 50-500 */
      },
      { "heading": "Journey One",
        "description": "First trip. The author travelled to Vibrant Isles in the search of the Endless Waterfall",
        "contentLength": 250 
      },
      { "heading": "Journey Two",
        "description": "Second Trip. The author's adventure in Desolate Steppes in the search of Magnificent Oasis", 
        "contentLength": 300 
      },
      { "heading": "Final Thoughts",
        "description": "The author's contemplation about whether the journeys were worth it", 
        "contentLength": 100 
      }
    ],
    "holderId": "player"
  }]

- Example for losing, destroying, completely removing the item:
  playerItemsHint: "Lost Old Lantern (flickering)."

- Example for giving an existing item from one holder to another:
  npcItemsHint: "Gave Iron Sword to Guard."

- "take" is an alias for "give". Example:
  playerItemsHint: "Took Coin Pouch from Bandit."

- Example for simple update (only changing "isActive"):
  playerItemsHint: "Plasma Torch is now active."

- Example for transformation or crafting:
  playerItemsHint: "Scrap Metal transformed into Makeshift Shiv."

- Example for adding a known use (type/description etc. inherited):
  playerItemsHint: "Mystic Orb can now 'Peer into the Orb'."

  - ALWAYS appropriately handle spending single-use items and state toggles ("isActive": true/false).
  - Using some "single-use" items (food, water, medicine, etc) MUST add or remove appropriate "status effects".
  - Mention remaining uses for multi-use items when they change.
IMPORTANT: For items that CLEARLY can be enabled or disabled (e.g., light sources, powered equipment, wielded or worn items) provide at least the two knownUses to enable and disable them with appropriate names:
  - The knownUse to turn on, light, or otherwise enable the item should ALWAYS have "appliesWhenInactive": true (and typically "appliesWhenActive": false or undefined).
  - The knownUse to turn off, extinguish, or disable the item should ALWAYS have "appliesWhenActive": true (and typically "appliesWhenInactive": false or undefined).
IMPORTANT: NEVER add "Inspect", "Use", "Drop", "Discard", "Enter", "Park", "Read", "Write" known uses - there are dedicated buttons for those in the game.

If Player's Action is "Inspect: [item_name]": Provide details about the item in "logMessage". If new info/use is found, mention it in "playerItemsHint".
If Player's Action is "Attempt to use: [item_name]": Treat it as the most logical action. Describe the outcome in "logMessage". If specific function is revealed, mention it in "playerItemsHint".

${ITEM_TYPES_GUIDE}

IMPORTANT GAME FEATURE - Anachronistic Items: If some items are CLEARLY anachronistic for the current theme (e.g., a high-tech device in a medieval fantasy setting), you MAY transform them. Mention the transformation in "playerItemsHint" and include the resulting item in "newItems" with its new "name", "type" and "description". Your "logMessage" must creatively explain this transformation. For example, a "Laser Pistol" (Sci-Fi item) in a "Classic Dungeon Delve" (Fantasy theme) might transform into a "Humming Metal Wand". The log message could be: "The strange metal device from another world shimmers and reshapes into a humming metal wand in your grasp!"
`;

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
- The "Universe" is the root node, it can contain any other nodes.
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
