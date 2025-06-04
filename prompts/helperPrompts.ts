
import { VALID_ITEM_TYPES_STRING } from '../constants'; // Import needed constant

export const ITEMS_GUIDE = `- "itemChange" is ALWAYS an array. If no item change, send an empty array: "itemChange": [].
 Structure for individual ItemChange objects within the array:
  - "action": "gain": "item" is an Item object: { "name": "item_name", "type": ${VALID_ITEM_TYPES_STRING}, "description": "item_description", "activeDescription"?: "description_when_active", "isActive"?: false, "isJunk"?: boolean, "knownUses"?: [{ "actionName": "Action Text", "promptEffect": "Meaningful phrase describing the effect sent to AI (MUST NOT BE EMPTY)", "description": "Hint to the player on item use", "appliesWhenActive"?: boolean, "appliesWhenInactive"?: boolean }] }. Ensure "name", "type", "promptEffect", "description" are always present and valid. "isJunk" is optional (defaults to false); set to true if the item is largely unimportant or has served its ONLY purpose (e.g., a used quest item, common debris). Important: "status effects" can never be marked as junk. The "newName" and "addKnownUse" fields of the Item object should NOT be used for "gain".
  - "action": "lose": "item" is the item's FULL name, including any notes in brackets (string).
    - Appropriately handle spending single-use items and state toggles ("isActive": true/false).
    - Using some "single-use" items (food, water, medicine, etc) MAY add or remove appropriate "status effects".
  - "action": "update": "item" is an Item object.
    - The "name" field of this Item object is the FULL *original name* of the item to update. This is REQUIRED.
    - Other fields ("type", "description", "activeDescription", "isActive", "isJunk", "knownUses") are OPTIONAL. If provided, they describe the item *after* the update. If not provided, the item's existing values for these fields are retained.
    - Use "newName" field in this Item object if transforming the item to a new name. If "newName" is provided, you SHOULD also provide "type" and "description" for the NEW item.
    - Use "knownUses" (an array) to replace all existing known uses. Send an empty array to clear all known uses. Each KnownUse object must have a non-empty "actionName" and non-empty "promptEffect".
    - Use "addKnownUse" to add a single new known use. It must have a non-empty "actionName" and non-empty "promptEffect".
    - "isJunk" (optional boolean): Set to true if the item becomes junk, false if it becomes important again. IMPORTANT: "status effects" can never be marked as junk.
    - Example for simple update (only changing "isActive", other properties like type/description are inherited from the existing "Old Torch"): 
      { "action": "update",
        "item": { "name": "Old Torch", "isActive": true }
      }
    - Example for transformation (providing all details for the new item): 
      { "action": "update",
        "item": {
          "name": "Scrap Metal",
          "newName": "Makeshift Shiv",
          "type": "weapon",
          "description": "A sharp piece of metal.",
          "isJunk": false
        }
      }
    - Example for adding a known use (type/description etc. inherited): 
      { "action": "update",
        "item": {
          "name": "Mystic Orb",
          "addKnownUse": {
            "actionName": "Peer into the Orb",
            "promptEffect": "Player peers into the Mystic Orb",
            "description": "Try to see the beyond",
            "AppliesWhenActive": true
          }
        }
      }
    - Use "update" to change the remaining number of uses for multi-use items in their name (in brackets) or in description.
  Each KnownUse object requires:
    - "actionName": string (User-facing text for the action button).
    - "promptEffect": string (CRITICAL: Non-empty text sent to the game AI when this action is chosen. This defines the game effect).
    - "description": string (A small hint or detail for the player, shown as a tooltip).
    - "appliesWhenActive?": boolean (Optional: If true, use shown when item.isActive is true).
    - "appliesWhenInactive?": boolean (Optional: If true, use shown when item.isActive is false/undefined).
  If neither "appliesWhenActive" nor "appliesWhenInactive" is provided, the use is always shown.
  If both are provided, it applies if (isActive AND appliesWhenActive) OR (!isActive AND appliesWhenInactive).
  IMPORTANT: For items that CLEARLY can be enabled or disabled (e.g., light sources, powered equipment, wielded or worn items) provide at least the two knownUses to enable and disable them with appropriate names:
    - The knownUse to turn on, light, or otherwise enable the item should ALWAYS have "appliesWhenInactive": true (and typically "appliesWhenActive": false or undefined).
    - The knownUse to turn off, extinguish, or disable the item should ALWAYS have "appliesWhenActive": true (and typically "appliesWhenInactive": false or undefined).
  IMPORTANT: NEVER add "Inspect" knownUse - there is a dedicated button for it in the game.

  If Player's Action is "Inspect: [item_name]": Provide details about the item in "logMessage". If new info/use is found, use "itemChange" "update" (e.g., with "addKnownUse").
  If Player's Action is "Attempt to use: [item_name]": Treat it as the most logical action. Describe the outcome in "logMessage". If specific function is revealed, consider "itemChange" "update" for "addKnownUse" in addition to main outcome.


Valid item "type" values are: ${VALID_ITEM_TYPES_STRING}.
- "single-use": Consumed after one use (e.g., potion, one-shot scroll, stimpak, medicine pill, spare part). Assumed to be stored in player's pockets/bag/backpack. Cannot be worn on a person directly.
- "multi-use": Can be used multiple times (e.g., lockpick set, toolkit, medkit). Can have limited number of uses, indicated in brackets after the name, or in the description. Assumed to be stored in player's pockets/bag/backpack. Cannot be worn on a person directly.
- "equipment": Can be worn on a person, or wielded (e.g., armor, shield, helmet, lantern, flashlight, crowbar). Can have active/inactive states.
- "container": Can hold things. Describe if empty/full, intended contents (solid, liquid, gas), e.g., "Empty Canteen", "Flask of Oil". Use 'update' to change its description/state (e.g., from empty to full). Full conainer can provide a number of uses until it is empty again (can drink from full bottle several times).
- "key": Unlocks specific doors, chests, portals, or similar. Description should hint at its purpose, e.g., "Ornate Silver Key (for a large chest)". Can be 'lost' or 'updated' (e.g., to "Bent Key") after use.
- "weapon": Melee and ranged weapons, distinct from "equipment" Items that can be explicitly used in a fight when wielded. Ranged weapon consume ammunition or charges.
- "ammunition": For reloading specific ranged weapons, e.g., Arrows for Longbow, Rounds for firearms, Charges for energy weapons. Using weapon consumes ammo (handled by log/update).
- "vehicle": Player's current transport (if isActive: true) or one they can enter if adjacent to it. Integral parts (mounted guns, cargo bays) are 'knownUses', NOT separate items unless detached. If player enters a vehicle, its 'isActive' state MUST be set to true using an 'itemChange' action 'update'. If player exits a vehicle, its 'isActive' state MUST be set to false using an 'itemChange' action 'update'.
- "knowledge": Immaterial. Represents learned info, skills, spells, passwords. 'knownUses' define how to apply it. Can be 'lost' if used up or no longer relevant. E.g., "Spell: Fireball", "Recipe: Health Potion", "Clue: Thief Name".
- "status effect": Temporary condition, positive or negative, generally gained and lost by eating, drinking, environmental exposure, impacts, and wounds. 'isActive: true' while affecting player. 'description' explains its effect, e.g., "Poisoned (move slower)", "Blessed (higher luck)", "Wounded (needs healing)". 'lost' when it expires.

IMPORTANT GAME FEATURE - Anachronistic Items: If some items are CLEARLY anachronistic for the current theme (e.g., a high-tech device in a medieval fantasy setting), you MAY transform them. Use "itemChange" with "action": "update", providing "newName", and the new "type" and "description" for the thematically appropriate item. Your "logMessage" must creatively explain this transformation. For example, a "Laser Pistol" (Sci-Fi item) in a "Classic Dungeon Delve" (Fantasy theme) might transform into a "Humming Metal Wand". The log message could be: "The strange metal device from another world shimmers and reshapes into a humming metal wand in your grasp!"
`;

export const LOCAL_CONDITIONS_GUIDE = `- You MUST provide "localTime", "localEnvironment", "localPlace" in the response.
- "localTime" should be a very short phrase (e.g., "Dawn", "Mid-morning", "Twilight", "Deep Night", "Temporal Flux").
- "localEnvironment" should be a concise sentence describing immediate ambient conditions (e.g., "A gentle breeze rustles leaves.", "The air is stale and smells of decay.", "Rain lashes against the windows.", "A low hum pervades the metallic corridor.").
- "localPlace" is a free-form string describing the player's current specific position.
  - It can use relational words with a known Map Node (which represent main locations or significant features, e.g., "inside the Old Mill", "in front of the Stone Altar").
  - It can describe positions between known Map Nodes (e.g., "on the path between the Whispering Woods and the Crystal Cave", "en-route from Port Blacksand to the Serpent's Isle").
  - The new "localPlace" must be a logical continuation from the previous "localPlace", considering the player's action and the scene's outcome. Update "localPlace" whenever the player moves, their immediate surroundings change significantly, or they transition between distinct areas.
- These details MUST be updated as the narrative progresses and be in agreement with the "sceneDescription".
`;
