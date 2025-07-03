import{n as u,a as D,e as C,s as M,D as m,f as w}from"./utils-B7yNI6lz.js";import"./gemini-OHsDkYxx.js";const q="gemini-2.5-flash",J="gemini-2.5-flash-lite-preview-06-17",Q="gemma-3-27b-it",Z=10,ee=15,te=30,P=["Fantasy & Myth","Science Fiction & Future","Horror & Dark Mystery","Action & Wasteland","Testing"],ne=50,ie="Eliot the Cougar",ae="1.4.0 (Ink and Quill)",se="7",re="whispersInTheDark_gameState",oe="whispersInTheDark_debugPacket",le="whispersInTheDark_debugLore",ce=30,de=5,pe=P.filter(n=>n!=="Testing"),ue="Male",k="player",fe="player_journal",me=6,ge=70,he=5,ye=5,ve=10,we=10,O=4,R=10,f=["single-use","multi-use","equipment","container","key","weapon","ammunition","vehicle","immovable","status effect","page","book","picture","map"],U=f.map(n=>n).join(", "),p=["default","junk"],x=["stashed"],g=["printed","handwritten","typed","digital"],V=["faded","smudged","torn","glitching","encrypted","foreign","gothic","runic","recovered"],h=[...g,...V],G=[...p,...x,...h],H=g.map(n=>n).join(", "),F=["inspect","use","drop","discard","enter","park","read","write"],W=F.map(n=>n).join(", "),S=["distant","nearby","companion","unknown"],Ie={storyteller:{text:"Dungeon Master thinks...",icon:"░░"},map:{text:"Cartographer draws the map...",icon:"░░"},correction:{text:"Dungeon Master is fixing mistakes...",icon:"▓"},inventory:{text:"Dungeon Master handles items...",icon:"░░"},dialogue_turn:{text:"Conversation continues...",icon:"░░"},dialogue_summary:{text:"Dialogue concludes...",icon:"░░"},dialogue_memory_creation:{text:"Memories form...",icon:"░░"},dialogue_conclusion_summary:{text:"Returning to the world...",icon:"░░"},initial_load:{text:"Loading...",icon:"░░"},reality_shift_load:{text:"Reality shifts...",icon:"░░"},visualize:{text:"Visualizing the scene...",icon:"░░"},page:{text:"Reading...",icon:"░░"},journal:{text:"Writing...",icon:"░░"},loremaster_collect:{text:"Loremaster picks facts...",icon:"░"},loremaster_extract:{text:"Loremaster extracts new lore...",icon:"░"},loremaster_write:{text:"Loremaster writes down lore...",icon:"░"},loremaster_refine:{text:"Loremaster refines lore...",icon:"░"},book:{text:"Reading...",icon:"░░"}},K=["region","location","settlement","district","exterior","interior","room","feature"];K.reduce((n,t,e)=>(n[t]=e,n),{});const Ae=["collapsed","hidden","removed"],_e=20,I=1e3,A=750,Ee=`${String(-I/2)} ${String(-A/2)} ${String(I)} ${String(A)}`,be=8,Te=4,Le=10,Se=1.1,Ne=2,De=.3,Ce=5,Me=10,Y=`Valid item "type" values are: ${U}.
- "single-use": Consumed after one use (e.g., potion, one-shot scroll, stimpak, medicine pill, spare part). Assumed to be stored in player's pockets/bag/backpack. Excludes any written material. Cannot be worn on a person directly.
- "multi-use": Can be used multiple times (e.g., lockpick set, toolkit, medkit). Can have limited number of uses, indicated in brackets after the name, or in the description. Assumed to be stored in player's pockets/bag/backpack. Cannot be worn on a person directly.
- "equipment": Can be worn on a person, or wielded (e.g., armor, shield, helmet, lantern, flashlight, crowbar). Can have active/inactive states.
- "container": Can hold things. Describe if empty/full, intended contents (solid, liquid, gas), e.g., "Empty Canteen", "Flask of Oil". Use 'update' to change its description/state (e.g., from empty to full). Full conainer can provide a number of uses until it is empty again (can drink from full bottle several times).
- "key": Unlocks specific doors, chests, portals, or similar. Description should hint at its purpose, e.g., "Ornate Silver Key (for a large chest)". Can be 'lost' or 'updated' (e.g., to "Bent Key") after use.
- "weapon": Melee and ranged weapons, distinct from "equipment" Items that can be explicitly used in a fight when wielded. Ranged weapon consume ammunition or charges.
- "ammunition": For reloading specific ranged weapons, e.g., Arrows for Longbow, Rounds for firearms, Charges for energy weapons. Using weapon consumes ammo (handled by log/update).
- "vehicle": Player's current transport (if isActive: true) or one they can enter if adjacent to it. Integral parts (mounted guns, cargo bays) are 'knownUses', NOT separate items unless detached. If player enters a vehicle, note in "playerItemsHint" that it becomes active. If they exit, note that it becomes inactive. Include the vehicle in "newItems" only when first introduced.
- "immovable": Built-in or heavy feature at a location (e.g., control panel or machinery). Cannot be moved or stored. Interact using known uses or generic attempts.
- "status effect": Temporary condition, positive or negative, generally gained and lost by eating, drinking, environmental exposure, impacts, and wounds. 'isActive: true' while affecting player. 'description' explains its effect, e.g., "Poisoned (move slower)", "Blessed (higher luck)", "Wounded (needs healing)". 'lost' when it expires.
Written items:
- "page": Single sheet or scroll. Follows the same structure as a one-chapter "book". Always provide a numeric "contentLength" for the page text.
- "book": Multi-page text with "chapters". Journals are blank books that start with no chapters and gain new entries when the player writes. Each chapter MUST have {"heading", "description", "contentLength"}.
- "picture": Single image such as a photograph, drawing, or painting. Use one chapter to describe what the image portrays in detail.
- "map": Hand-drawn or printed diagram showing terrain, directions, floor plan, or schematic. Use one chapter to describe the layout and any notable markings.
`,Pe=`Generate inventory hints using these fields:
- "playerItemsHint": short summary of gains, losses or state changes for the Player.
- "worldItemsHint": short summary of items dropped or discovered in the environment.
- "npcItemsHint": short summary of items held or used by NPCs.
- "newItems": array of brand new items introduced this turn, or [] if none.

Examples illustrating the hint style:
- Example of creating a *new* item "Old Lantern" and placing it in player's inventory. Because "Old Lantern" is included in newItems, it means the item is not already present in the scene:
playerItemsHint: "Picked up Old Lantern."
newItems:
[
  {
    "name": "Old Lantern",
    "type": "equipment",
    "description": "A dusty old lantern that still flickers faintly.",
    "activeDescription": "The lantern is lit and casts a warm glow.",
    "isActive": false,
    "knownUses":
    [
      {
        "actionName": "Light the Lantern",
        "promptEffect": "Light the lantern to illuminate the area.",
        "description": "Use this to light your way in dark places.",
        "appliesWhenInactive": true
      },
      {
        "actionName": "Extinguish the Lantern",
        "promptEffect": "Extinguish the lantern.",
        "description": "Extinguish the lantern and conserve fuel.",
        "appliesWhenActive": true
      }
    ]
  }
]

- Example for creating a *new* item "Rusty Key" inside npc_guard_4f3a inventory:
npcItemsHint: "Guard now carries a Rusty Key."
newItems:
[
  {
    "name": "Rusty Key",
    "type": "key",
    "description": "A key for the armory door.",
    "holderId": "npc_guard_4f3a"
  }
]

- Example of creating a *new* 'page' written item and placing it in player's inventory (same structure for the 'map' and 'picture' types):
playerItemsHint: "Found Smudged Note."
newItems:
[
  {
    "name": "Smudged Note",
    "type": "page",
    "description": "A hastily scribbled message with a big smudge over it.",
    "tags": ["typed", "smudged"],
    "holderId": "player",
    "chapters": /* REQUIRED, because the type is 'page' */
    [ /* Only one chapter, because the type is 'page' */
      {
        "heading": "string",
        "description": "A hastily scribbled message about the dangers of the sunken tunnel.",
        "contentLength": 50
      }
    ]
  }
]

- Example of creating a *new* 'book' written item and placing it in player's inventory:
playerItemsHint: "Obtained the Explorer's Adventures."
newItems:
[
  {
    "name": "Explorer's Adventures",
    "type": "book",
    "description": "Weathered log of travels.",
    "holderId": "player",
    "tags": ["handwritten", "faded"],
    "chapters": /* REQUIRED, because the type is 'book' */
    [ /* Multiple chapters because the type it 'book' */
      {
        "heading": "Preface",
        "description": "Introduction. Written by the author, explaining his decisions to start his travels.",
        "contentLength": 53
      },
      {
        "heading": "Journey One",
        "description": "First trip. The author travelled to Vibrant Isles in the search of the Endless Waterfall",
        "contentLength": 246 
      },
      {
        "heading": "Journey Two",
        "description": "Second Trip. The author's adventure in Desolate Steppes in the search of Magnificent Oasis", 
        "contentLength": 312 
      },
      {
        "heading": "Final Thoughts",
        "description": "The author's contemplation about whether the journeys were worth it", 
        "contentLength": 98 
      }
    ]
  }]

- Example for losing, destroying, completely removing the item:
playerItemsHint: "Lost Old Lantern (flickering)."

- Example for giving an *existing* item from one holder to another:
npcItemsHint: "Gave Iron Sword to Guard."

- "take" is an alias for "give". Example:
playerItemsHint: "Took Coin Pouch from Bandit."

- Example for simple update of *existing* item (only changing "isActive"):
playerItemsHint: "Plasma Torch is now active."

- Example for transformation or crafting:
playerItemsHint: "Scrap Metal transformed into Makeshift Shiv."

- Example for adding a known use to an item without changing anything else:
playerItemsHint: "Mystic Orb can now 'Peer into the Orb'."

- ALWAYS appropriately handle spending single-use items and state toggles ("isActive": true/false).
- Make sure that 'page', 'map' and 'picture' type items have exactly ONE chapter.
- Make sure that 'book' type items have between ${String(O)} and ${String(R)} chapters.
- Make sure 'page', 'book', 'map' and 'picture' type items have one of the required tags: ${H}.
- Using some "single-use" items (food, water, medicine, etc) MUST add or remove appropriate "status effects".
- Mention remaining uses for multi-use items when they change.
IMPORTANT: For items that CLEARLY can be enabled or disabled (e.g., light sources, powered equipment, wielded or worn items) provide at least the two knownUses to enable and disable them with appropriate names:
  - The knownUse to turn on, light, or otherwise enable the item should ALWAYS have "appliesWhenInactive": true (and typically "appliesWhenActive": false or undefined).
  - The knownUse to turn off, extinguish, or disable the item should ALWAYS have "appliesWhenActive": true (and typically "appliesWhenInactive": false or undefined).
  - ALWAYS provide these actions in pairs, e.g. turn on/turn off, wield/put away, wear/take off, light/extinguish, activate/deactivate, start/stop, etc.
IMPORTANT: NEVER add ${W} known uses - there are dedicated buttons for those in the game.

${Y}

IMPORTANT GAME FEATURE - Anachronistic Items: If some items are CLEARLY anachronistic for the current theme (e.g., a high-tech device in a medieval fantasy setting), you MAY transform them. Mention the transformation in "playerItemsHint" and include the resulting item in "newItems" with its new "name", "type" and "description". Your "logMessage" must creatively explain this transformation. For example, a "Laser Pistol" (Sci-Fi item) in a "Classic Dungeon Delve" (Fantasy theme) might transform into a "Humming Metal Wand". The log message could be: "The strange metal device from another world shimmers and reshapes into a humming metal wand in your grasp!"
`,ke=`- You MUST provide "localTime", "localEnvironment", "localPlace" in the response.
- "localTime" should be a very short phrase (e.g., "Dawn", "Mid-morning", "Twilight", "Deep Night", "Temporal Flux").
- "localEnvironment" should be a concise sentence describing immediate ambient conditions (e.g., "A gentle breeze rustles leaves.", "The air is stale and smells of decay.", "Rain lashes against the windows.", "A low hum pervades the metallic corridor.").
- "localPlace" is a free-form string describing the player's current specific position.
  - It can use relational words with a known Map Node (which represent main locations or significant features, e.g., "inside the Old Mill", "in front of the Stone Altar").
  - It can describe positions between known Map Nodes (e.g., "on the path between the Whispering Woods and the Crystal Cave", "en-route from Port Blacksand to the Serpent's Isle").
  - The new "localPlace" must be a logical continuation from the previous "localPlace", considering the player's action and the scene's outcome. Update "localPlace" whenever the player moves, their immediate surroundings change significantly, or they transition between distinct areas.
- These details MUST be updated as the narrative progresses and be in agreement with the "sceneDescription".
`;console.error("GEMINI_API_KEY environment variable is not set. Gemini services will be unavailable.");console.error("GEMINI_API_KEY environment variable is not set. The application will not be able to connect to the Gemini API.");const Oe=async(n,t,e,i,s)=>(console.error(`fetchCorrectedNPCDetails_Service: API Key not configured. Cannot fetch details for "${n}".`),null),_=new Set(g),B=["page","book","map","picture"],E=new Set(B);function j(n,t){const e=`${n} ${t}`.toLowerCase();return/(handwritten|scribbled|ink|pen|quill)/.test(e)?"handwritten":/(typewriter|typed)/.test(e)?"typed":/(digital|screen|display|tablet|monitor|terminal)/.test(e)?"digital":"printed"}function N(n){if(!n||typeof n!="object")return!1;const t=n;return!(typeof t.actionName!="string"||t.actionName.trim()===""||typeof t.promptEffect!="string"||t.promptEffect.trim()===""||t.appliesWhenActive!==void 0&&typeof t.appliesWhenActive!="boolean"||t.appliesWhenInactive!==void 0&&typeof t.appliesWhenInactive!="boolean"||typeof t.description!="string"||t.description.trim()==="")}function b(n,t){if(!n||typeof n!="object")return!1;const e=n;if(typeof e.type=="string"){const s=u(e.type);s&&(e.type=s)}if(typeof e.name!="string"||e.name.trim()==="")return console.warn("isValidItem: 'name' is missing or invalid.",n),!1;if(t==="create"||!t){if(typeof e.type!="string"||!f.includes(e.type))return console.warn(`isValidItem (context: ${t??"default"}): 'type' is missing or invalid.`,n),!1;if(typeof e.description!="string"||e.description.trim()==="")return console.warn(`isValidItem (context: ${t??"default"}): 'description' is missing or invalid.`,n),!1;if(typeof e.holderId!="string"||e.holderId.trim()==="")return console.warn(`isValidItem (context: ${t??"default"}): 'holderId' is missing or invalid.`,n),!1}if(t==="change"&&e.newName!=null&&(typeof e.newName!="string"||e.newName.trim()===""))return console.warn("isValidItem (context: change, with newName): 'newName' is invalid.",n),!1;if(e.type!==void 0){const s=u(e.type);if(!s)return console.warn("isValidItem: 'type' is present but invalid.",n),!1;e.type=s}if(e.description!==void 0&&(typeof e.description!="string"||e.description.trim()==="")&&(t==="create"||t==="change"&&e.newName)&&e.description.trim()==="")return console.warn("isValidItem: 'description' is present but empty, which is invalid for a create or transformation.",n),!1;if(e.activeDescription!==void 0&&typeof e.activeDescription!="string")return console.warn("isValidItem: 'activeDescription' is present but invalid.",n),!1;if(e.isActive!==void 0&&typeof e.isActive!="boolean")return console.warn("isValidItem: 'isActive' is present but invalid.",n),!1;if(e.stashed!==void 0&&typeof e.stashed!="boolean")return console.warn("isValidItem: 'stashed' is present but invalid.",n),!1;if(e.tags!==void 0){if(!Array.isArray(e.tags)||!e.tags.every(a=>typeof a=="string"))return console.warn("isValidItem: 'tags' is present but invalid.",n),!1;const s=D(e.tags);s?e.tags=s:e.tags=e.tags.filter(a=>G.includes(a));const r=E.has(e.type??"")?[...p,...h]:p;e.tags=e.tags.filter(a=>r.includes(a))}if(E.has(e.type??"")){e.tags=e.tags??[];const s=e.tags.filter(r=>_.has(r));if(s.length===0){const r=j(e.name,e.description??"");e.tags.unshift(r)}else if(s.length>1){const[r]=s;e.tags=[r,...e.tags.filter(a=>!_.has(a))]}}if(e.holderId!==void 0&&(typeof e.holderId!="string"||e.holderId.trim()===""))return console.warn("isValidItem: 'holderId' is present but invalid.",n),!1;const i=s=>Array.isArray(s)&&s.every(r=>r&&typeof r=="object"&&typeof r.heading=="string"&&typeof r.description=="string"&&typeof r.contentLength=="number"&&(r.imageData===void 0||typeof r.imageData=="string"));if(e.type==="page"||e.type==="book"||e.type==="map"||e.type==="picture"){if(e.chapters!==void 0){if(!i(e.chapters))return console.warn("isValidItem: 'chapters' is present but invalid.",n),!1;(e.type==="page"||e.type==="map"||e.type==="picture")&&e.chapters.length>1&&(e.chapters=[e.chapters[0]])}else{const s=typeof e.contentLength=="number"?e.contentLength:30;e.chapters=[{heading:e.name,description:e.description??"",contentLength:s,actualContent:typeof e.actualContent=="string"?e.actualContent:void 0,visibleContent:typeof e.visibleContent=="string"?e.visibleContent:void 0}]}delete e.contentLength,delete e.actualContent,delete e.visibleContent}else if(e.chapters!==void 0&&!i(e.chapters))return console.warn("isValidItem: 'chapters' is present but invalid for non-book/page item.",n),!1;return e.contentLength!==void 0&&typeof e.contentLength!="number"?(console.warn("isValidItem: 'contentLength' is present but invalid.",n),!1):e.actualContent!==void 0&&typeof e.actualContent!="string"?(console.warn("isValidItem: 'actualContent' is present but invalid.",n),!1):e.visibleContent!==void 0&&typeof e.visibleContent!="string"?(console.warn("isValidItem: 'visibleContent' is present but invalid.",n),!1):e.knownUses!==void 0&&!(Array.isArray(e.knownUses)&&e.knownUses.every(N))?(console.warn("isValidItem: 'knownUses' is present but invalid.",n),!1):!0}function T(n){if(!n||typeof n!="object")return!1;const t=n;return typeof t.id=="string"&&t.id.trim()!==""&&typeof t.name=="string"&&t.name.trim()!==""}function $(n){if(!n||typeof n!="object")return!1;const t=n;if(typeof t.id!="string"||t.id.trim()===""||typeof t.name!="string"||t.name.trim()===""||typeof t.type!="string"||!f.includes(t.type))return!1;const e=["page","book","map","picture"].includes(t.type);if(t.knownUses===void 0&&t.tags===void 0&&t.chapters===void 0||t.knownUses!==void 0&&!(Array.isArray(t.knownUses)&&t.knownUses.every(N)))return!1;const i=e?[...p,...h]:p,s=Array.isArray(t.tags)&&t.tags.every(a=>i.includes(a)),r=Array.isArray(t.chapters)&&t.chapters.every(a=>{const o=a;return typeof o.heading=="string"&&typeof o.description=="string"&&typeof o.contentLength=="number"});if(e){if(!s||!r)return!1}else if(t.tags!==void 0&&!s||t.chapters!==void 0&&!r)return!1;return!0}function Re(n){if(!n||typeof n!="object")return!1;const t=n;if(typeof t.type=="string"){const e=u(t.type);e&&(t.type=e)}return typeof t.name=="string"&&t.name.trim()!==""&&typeof t.description=="string"&&t.description.trim()!==""&&typeof t.type=="string"&&f.includes(t.type)}function Ue(n){if(!n||typeof n!="object")return!1;const t=n;return typeof t.name!="string"||t.name.trim()===""||t.newDescription!==void 0&&typeof t.newDescription!="string"||t.newAliases!==void 0&&!(Array.isArray(t.newAliases)&&t.newAliases.every(e=>typeof e=="string"))||t.addAlias!==void 0&&typeof t.addAlias!="string"||t.newPresenceStatus!==void 0&&!S.includes(t.newPresenceStatus)||t.newLastKnownLocation!==void 0&&t.newLastKnownLocation!=null&&typeof t.newLastKnownLocation!="string"||t.newPreciseLocation!==void 0&&t.newPreciseLocation!=null&&typeof t.newPreciseLocation!="string"?!1:((t.newPresenceStatus==="nearby"||t.newPresenceStatus==="companion")&&t.newPreciseLocation,(t.newPresenceStatus==="distant"||t.newPresenceStatus==="unknown")&&t.newPreciseLocation!=null,!0)}function xe(n){if(!n||typeof n!="object")return!1;const t=n;return typeof t.name!="string"||t.name.trim()===""||typeof t.description!="string"||t.description.trim()===""||t.aliases!==void 0&&!(Array.isArray(t.aliases)&&t.aliases.every(e=>typeof e=="string"))||t.presenceStatus!==void 0&&!S.includes(t.presenceStatus)||t.lastKnownLocation!==void 0&&t.lastKnownLocation!=null&&typeof t.lastKnownLocation!="string"||t.preciseLocation!==void 0&&t.preciseLocation!=null&&typeof t.preciseLocation!="string"?!1:((t.presenceStatus==="nearby"||t.presenceStatus==="companion")&&t.preciseLocation,(t.presenceStatus==="distant"||t.presenceStatus==="unknown")&&t.preciseLocation!=null,!0)}function Ve(n){if(!n||typeof n!="object")return console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup is missing or not an object."),!1;const t=n;if(!Array.isArray(t.participants)||t.participants.length===0||!t.participants.every(i=>typeof i=="string"&&i.trim()!==""))return console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.participants is invalid.",t.participants),!1;const e=t.participants;return!Array.isArray(t.initialNpcResponses)||t.initialNpcResponses.length===0||!t.initialNpcResponses.every(i=>i&&typeof i.speaker=="string"&&i.speaker.trim()!==""&&e.includes(i.speaker)&&typeof i.line=="string"&&i.line.trim()!=="")?(console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.initialNpcResponses is invalid.",t.initialNpcResponses),!1):!Array.isArray(t.initialPlayerOptions)||t.initialPlayerOptions.length<4||!t.initialPlayerOptions.every(i=>typeof i=="string"&&i.trim()!=="")?(console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.initialPlayerOptions is invalid.",t.initialPlayerOptions),!1):!0}const Ge=async(n,t,e,i)=>(console.error("fetchAdditionalBookChapters_Service: API Key not configured."),null),He=async(n,t,e,i)=>(console.error("fetchCorrectedAddDetailsPayload_Service: API Key not configured."),null),Fe=async(n,t,e,i)=>(console.error("fetchFullPlaceDetailsForNewMapNode_Service: API Key not configured."),null),We=async(n,t,e,i)=>(console.error("decideFeatureHierarchyUpgrade_Service: API Key not configured."),null),Ke=async(n,t,e,i,s,r)=>(console.error(`fetchCorrectedName_Service: API Key not configured. Cannot correct ${n} name.`),null),Ye=async(n,t,e)=>(console.error("assignSpecificNamesToDuplicateNodes_Service: API Key not configured."),[]),Be=async(n,t,e,i,s,r,a,o)=>(console.error("fetchCorrectedDialogueSetup_Service: API Key not configured."),null),L=(n,t)=>{switch(t){case"create":{const e=n;if((typeof e.holderId!="string"||e.holderId.trim()==="")&&(e.holderId=k),b(e,"create")){const i=e;return i.knownUses=w(i.knownUses),{action:t,item:e}}return null}case"change":{const e=n,i=typeof e.type=="string"?e.type:void 0,s=typeof e.status=="string"?e.status:void 0,r=i?u(i):null,a=s?s.toLowerCase():null,o=i?i.toLowerCase():null;if(r&&m.has(r)||o&&m.has(o)||a&&m.has(a)){const l={id:typeof e.id=="string"?e.id:void 0,name:typeof e.name=="string"?e.name:void 0};return T(l)?{action:"destroy",item:l}:null}if(b(n,"change")){const l=n;return l.knownUses=w(l.knownUses),{action:"change",item:n}}return null}case"addDetails":return $(n)?{action:"addDetails",item:n}:{action:"addDetails",item:n,invalidPayload:n};case"destroy":return T(n)?{action:"destroy",item:n}:null;case"move":{const e=n;if(typeof e.id=="string"&&typeof e.newHolderId=="string"){const i={id:e.id,name:e.name,newHolderId:e.newHolderId};return{action:t,item:i}}return null}default:return null}},je=n=>{const t=C(n),e=M(t);if(!e)return null;let i=null;const s=(a,o)=>{const l=[];for(const c of a){if(!c||typeof c!="object")continue;const d=L(c,o);d&&l.push(d)}return l},r=a=>{const o=[];for(const l of a){if(!l||typeof l!="object")continue;const c=l,d=typeof c.action=="string"?c.action:void 0,y=c.item&&typeof c.item=="object"?c.item:void 0;if(d&&y){const v=L(y,d);v&&o.push(v)}}return o};if(Array.isArray(e))i={itemChanges:s(e,"create")};else if(typeof e=="object"){const a=e,o=[];Array.isArray(a.create)&&o.push(...s(a.create,"create")),Array.isArray(a.change)&&o.push(...s(a.change,"change")),Array.isArray(a.move)&&o.push(...s(a.move,"move")),Array.isArray(a.destroy)&&o.push(...s(a.destroy,"destroy")),Array.isArray(a.addDetails)&&o.push(...s(a.addDetails,"addDetails")),Array.isArray(a.itemChanges)&&o.push(...r(a.itemChanges)),i={itemChanges:o,observations:typeof a.observations=="string"?a.observations:void 0,rationale:typeof a.rationale=="string"?a.rationale:void 0}}return i},$e=async(n,t,e,i,s,r,a,o,l,c)=>(console.error("fetchCorrectedItemChangeArray_Service: API Key not configured."),null);export{I as $,He as A,O as B,se as C,de as D,Ge as E,ne as F,J as G,we as H,Pe as I,he as J,fe as K,ke as L,Q as M,_e as N,ve as O,k as P,Ie as Q,Me as R,te as S,g as T,ee as U,f as V,h as W,Z as X,ae as Y,P as Z,ie as _,ce as a,A as a0,be as a1,ge as a2,S as a3,le as a4,oe as a5,re as a6,ye as a7,pe as b,ue as c,Ee as d,De as e,Ne as f,Se as g,Le as h,q as i,Ae as j,G as k,Re as l,We as m,Fe as n,Ye as o,Te as p,Ke as q,me as r,Ve as s,xe as t,Ue as u,Be as v,Oe as w,Ce as x,je as y,$e as z};
