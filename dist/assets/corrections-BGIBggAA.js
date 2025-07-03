import{j as ce,g as le,r as de,i as pe,a as ue,e as me,f as Q,b as A,c as I,s as $,d as C,n as M,h as he,k as ge,D as k,l as Y}from"./utils-Dvsk76ya.js";import{G as fe}from"./gemini-C7Dr6FyN.js";const w="gemini-2.5-flash",N="gemini-2.5-flash-lite-preview-06-17",L="gemma-3-27b-it",Z="gemma-3n-e4b-it",T=.8,ye=10,Se=15,ve=30,we=30,Ne=["Fantasy & Myth","Science Fiction & Future","Horror & Dark Mystery","Action & Wasteland","Testing"],S=3,qe=3,Xe=50,ze="Eliot the Cougar",Qe="1.4.0 (Ink and Quill)",Ze="7",et="whispersInTheDark_gameState",tt="whispersInTheDark_debugPacket",nt="whispersInTheDark_debugLore",rt=30,at=5,ot=Ne.filter(t=>t!=="Testing"),it="Male",ee="player",st="player_journal",ct=6,lt=70,dt=5,pt=5,ut=10,mt=10,Ae=4,Ie=10,P=["single-use","multi-use","equipment","container","key","weapon","ammunition","vehicle","immovable","status effect","page","book","picture","map"],j=P.map(t=>t).join(", "),Te=["create","change","move","destroy","addDetails"],Ee=Te.map(t=>t).join(", "),D=["default","junk"],_e=["stashed"],G=["printed","handwritten","typed","digital"],te=["faded","smudged","torn","glitching","encrypted","foreign","gothic","runic","recovered"],V=[...G,...te],be=[...D,..._e,...V],ht=D.map(t=>t).join(", "),Le=G.map(t=>t).join(", "),gt=te.map(t=>t).join(", "),$e=["inspect","use","drop","discard","enter","park","read","write"],Ce=$e.map(t=>t).join(", "),R=["distant","nearby","companion","unknown"],Oe=R.map(t=>t).join(", "),E={storyteller:{text:"Dungeon Master thinks...",icon:"░░"},map:{text:"Cartographer draws the map...",icon:"░░"},correction:{text:"Dungeon Master is fixing mistakes...",icon:"▓"},inventory:{text:"Dungeon Master handles items...",icon:"░░"},dialogue_turn:{text:"Conversation continues...",icon:"░░"},dialogue_summary:{text:"Dialogue concludes...",icon:"░░"},dialogue_memory_creation:{text:"Memories form...",icon:"░░"},dialogue_conclusion_summary:{text:"Returning to the world...",icon:"░░"},initial_load:{text:"Loading...",icon:"░░"},reality_shift_load:{text:"Reality shifts...",icon:"░░"},visualize:{text:"Visualizing the scene...",icon:"░░"},page:{text:"Reading...",icon:"░░"},journal:{text:"Writing...",icon:"░░"},loremaster_collect:{text:"Loremaster picks facts...",icon:"░"},loremaster_extract:{text:"Loremaster extracts new lore...",icon:"░"},loremaster_write:{text:"Loremaster writes down lore...",icon:"░"},loremaster_refine:{text:"Loremaster refines lore...",icon:"░"},book:{text:"Reading...",icon:"░░"}},ne=["undiscovered","discovered","rumored","quest_target","blocked"],ft=ne.map(t=>t).join(", "),re=["region","location","settlement","district","exterior","interior","room","feature"],yt=re.map(t=>t).join(", "),F=re.reduce((t,e,n)=>(t[e]=n,t),{}),ae=["path","road","sea route","door","teleporter","secret_passage","river_crossing","temporary_bridge","boarding_hook","shortcut"],St=ae.map(t=>t).join(", "),oe=["open","accessible","closed","locked","blocked","hidden","rumored","one_way","collapsed","removed","active","inactive"],vt=oe.map(t=>t).join(", "),wt=["collapsed","hidden","removed"],Nt=20,H=1e3,J=750,At=`${String(-H/2)} ${String(-J/2)} ${String(H)} ${String(J)}`,It=8,Tt=4,Et=10,_t=1.1,bt=2,Lt=.3,$t=5,Ct=4,Ot=8,Dt=10,U="a short creative description of the location, <300 chars",De="a short creative description, focusing of travel conditions of the path",x="alternative names, partial names, shorthands. Avoid generic common terms.",Me=`Valid item "type" values are: ${j}.
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
`,Mt=`Generate inventory hints using these fields:
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
- Make sure that 'book' type items have between ${String(Ae)} and ${String(Ie)} chapters.
- Make sure 'page', 'book', 'map' and 'picture' type items have one of the required tags: ${Le}.
- Using some "single-use" items (food, water, medicine, etc) MUST add or remove appropriate "status effects".
- Mention remaining uses for multi-use items when they change.
IMPORTANT: For items that CLEARLY can be enabled or disabled (e.g., light sources, powered equipment, wielded or worn items) provide at least the two knownUses to enable and disable them with appropriate names:
  - The knownUse to turn on, light, or otherwise enable the item should ALWAYS have "appliesWhenInactive": true (and typically "appliesWhenActive": false or undefined).
  - The knownUse to turn off, extinguish, or disable the item should ALWAYS have "appliesWhenActive": true (and typically "appliesWhenInactive": false or undefined).
  - ALWAYS provide these actions in pairs, e.g. turn on/turn off, wield/put away, wear/take off, light/extinguish, activate/deactivate, start/stop, etc.
IMPORTANT: NEVER add ${Ce} known uses - there are dedicated buttons for those in the game.

${Me}

IMPORTANT GAME FEATURE - Anachronistic Items: If some items are CLEARLY anachronistic for the current theme (e.g., a high-tech device in a medieval fantasy setting), you MAY transform them. Mention the transformation in "playerItemsHint" and include the resulting item in "newItems" with its new "name", "type" and "description". Your "logMessage" must creatively explain this transformation. For example, a "Laser Pistol" (Sci-Fi item) in a "Classic Dungeon Delve" (Fantasy theme) might transform into a "Humming Metal Wand". The log message could be: "The strange metal device from another world shimmers and reshapes into a humming metal wand in your grasp!"
`,Pe=`Map Node Types:
- region: Broad area containing multiple locations.
- location: Significant named place within a region.
- settlement: Inhabited location such as a town or base.
- district: Subdivision of a settlement or complex, including streets or sectors.
- exterior: Outside of a single structure or vehicle.
- interior: Inside of a structure or vehicle.
- room: Individual enclosed space within an interior.
- feature: Notable sub-location or landmark within any other node.`,Re=`Map Edge Types:
- path: Narrow walking trail or hallway.
- road: Major route or street for ground travel.
- sea route: Travel across open water or space lanes.
- door: Physical entry like doors, gates, hatches, or airlocks.
- teleporter: Instant or rapid transit portals and lifts.
- secret_passage: Hidden or maintenance passageway.
- river_crossing: Means of crossing water or similar obstacles.
- temporary_bridge: Deployable link such as a boarding tube or rope bridge.
- boarding_hook: Grappling device to connect to a moving object.
- shortcut: Any special connection that bypasses hierarchy rules.`,ke=`Map Node Hierarchy:
- A "region" can contain "locations".
- A "location" can contain "settlements".
- A "settlement" can contain "districts".
- A "district" can contain "exteriors".
- An "exterior" can contain "interiors".
- An "interior" can contain "rooms".
- A "room" can contain "features".
- The "Universe" is the root node, it can contain any other nodes.
- A "feature" can be placed anywhere in the hierarchy, but can never be a parent to any other node.
- Only "feature" nodes can be connected to each other with edges.`,Pt=`- You MUST provide "localTime", "localEnvironment", "localPlace" in the response.
- "localTime" should be a very short phrase (e.g., "Dawn", "Mid-morning", "Twilight", "Deep Night", "Temporal Flux").
- "localEnvironment" should be a concise sentence describing immediate ambient conditions (e.g., "A gentle breeze rustles leaves.", "The air is stale and smells of decay.", "Rain lashes against the windows.", "A low hum pervades the metallic corridor.").
- "localPlace" is a free-form string describing the player's current specific position.
  - It can use relational words with a known Map Node (which represent main locations or significant features, e.g., "inside the Old Mill", "in front of the Stone Altar").
  - It can describe positions between known Map Nodes (e.g., "on the path between the Whispering Woods and the Crystal Cave", "en-route from Port Blacksand to the Serpent's Isle").
  - The new "localPlace" must be a logical continuation from the previous "localPlace", considering the player's action and the scene's outcome. Update "localPlace" whenever the player moves, their immediate surroundings change significantly, or they transition between distinct areas.
- These details MUST be updated as the narrative progresses and be in agreement with the "sceneDescription".
`,Ue="AIzaSyCOhiBHF10IXm9EjKGKThk_nhpo6x7OQTo",xe=new fe({apiKey:Ue}),B=xe,je={[w]:["thinking","system","schema"],[N]:["thinking","system","schema"],[L]:[],[Z]:[]},_=async t=>{var o,c,s;if(!B)return Promise.reject(new Error("API Key not configured."));const e={[w]:ye,[N]:Se,[L]:ve,[Z]:we};let n=null;for(const a of t.modelNames){const[r,l]=Array.isArray(a)?a:[a,je[a]??[]],d=l.includes("system"),p=l.includes("thinking"),g=l.includes("schema");let i=t.systemInstruction??"";if(!g&&t.jsonSchema){const m=ce(t.jsonSchema);i=i?`${i}

${m}`:m}const h=d?t.prompt:`${i?i+`

`:""}${t.prompt}`,u={};if(t.temperature!==void 0&&(u.temperature=t.temperature),t.responseMimeType&&g&&(u.responseMimeType=t.responseMimeType),p&&(t.thinkingBudget!==void 0||t.includeThoughts)){const m={};t.thinkingBudget!==void 0&&(m.thinkingBudget=t.thinkingBudget),t.includeThoughts&&(m.includeThoughts=!0),u.thinkingConfig=m}d&&i&&(u.systemInstruction=i),g&&t.jsonSchema&&(u.responseJsonSchema=t.jsonSchema);for(let m=1;m<=S;){const y=le(r,e[r]??1);if(y>0||m>1){const f=5e3+y;await new Promise(v=>setTimeout(v,f))}try{const f=await B.models.generateContent({model:r,contents:h,config:u});return de(r),t.label&&console.log(`[${t.label}] ${r} tokens: total ${String(((o=f.usageMetadata)==null?void 0:o.totalTokenCount)??"N/A")}, prompt ${String(((c=f.usageMetadata)==null?void 0:c.promptTokenCount)??"N/A")}, thoughts ${String(((s=f.usageMetadata)==null?void 0:s.thoughtsTokenCount)??"N/A")}`),t.debugLog&&t.debugLog.push({prompt:t.prompt,systemInstruction:i,jsonSchema:t.jsonSchema,modelUsed:r,responseText:f.text??"",promptUsed:h}),{response:f,modelUsed:r,systemInstructionUsed:i,jsonSchemaUsed:g?t.jsonSchema:void 0,promptUsed:h}}catch(f){if(t.debugLog&&t.debugLog.push({prompt:t.prompt,systemInstruction:i,jsonSchema:t.jsonSchema,modelUsed:r,responseText:`ERROR: ${f instanceof Error?f.message:String(f)}`,promptUsed:h}),n=f,!pe(f)&&!ue(f))throw f;const v=me(f),O=f instanceof Error?f.message:String(f),b=v!==null?String(v):O;console.warn(`dispatchAIRequest: Model ${r} failed with ${b}. Retry ${String(m)}/${String(S)}`),m+=1}}console.warn(`dispatchAIRequest: Model ${r} exhausted retries. Falling back if another model is available.`)}throw n instanceof Error?n:new Error(String(n))},Rt=async(t,e,n,o,c)=>{const s=c.length>0?"Known map locations in this theme: "+Q(c,!0):"No specific map locations are currently known for this theme.",a=`
You are an AI assistant generating detailed JSON objects for new NPCs.
Provide a suitable description, aliases, presenceStatus, lastKnownLocation, and preciseLocation for a character. Information MUST be derived *strictly* from the provided context.

NPC Name: "${t}"

Context:
- Log Message (how they appeared/what they're doing): "${e??"Not specified, infer from scene."}"
- Scene Description (where they appeared/are relevant): "${n??"Not specified, infer from log."}"
- ${s}
- Theme Guidance (influences NPC style/role): "${o.systemInstructionModifier}"

Respond ONLY in JSON format with the following structure:
{
  "description": "string (A detailed, engaging description fitting the scene and theme. MUST be non-empty.)",
  "aliases": ["string"],
  "presenceStatus": ${Oe},
  "lastKnownLocation": "string | null",
  "preciseLocation": "string | null"
}

Constraints:
- 'description' and 'presenceStatus' are REQUIRED and must be non-empty.
- If 'presenceStatus' is 'nearby' or 'companion', 'preciseLocation' MUST be a descriptive string derived from context; 'lastKnownLocation' can be null or a broader area.
- If 'presenceStatus' is 'distant' or 'unknown', 'preciseLocation' MUST be null; 'lastKnownLocation' should describe general whereabouts or be 'Unknown' if context doesn't specify.
`,r="You generate detailed JSON objects for new NPCs based on narrative context. Provide description, aliases, presenceStatus, lastKnownLocation, and preciseLocation. Adhere strictly to the JSON format and field requirements. Derive all information strictly from the provided context.";return A(async l=>{try{I(E.correction.icon);const{response:d}=await _({modelNames:[N,w],prompt:a,systemInstruction:r,responseMimeType:"application/json",temperature:T,label:"Corrections"}),p=$(C(d.text??""));if(p&&typeof p.description=="string"&&p.description.trim()!==""&&Array.isArray(p.aliases)&&p.aliases.every(g=>typeof g=="string")&&typeof p.presenceStatus=="string"&&R.includes(p.presenceStatus)&&(p.lastKnownLocation===null||typeof p.lastKnownLocation=="string")&&(p.preciseLocation===null||typeof p.preciseLocation=="string")&&!((p.presenceStatus==="nearby"||p.presenceStatus==="companion")&&(p.preciseLocation===null||p.preciseLocation===""))&&!((p.presenceStatus==="distant"||p.presenceStatus==="unknown")&&p.preciseLocation!==null))return{result:p};console.warn(`fetchCorrectedNPCDetails_Service (Attempt ${String(l+1)}/${String(S+1)}): Corrected details for "${t}" invalid or incomplete. Response:`,p)}catch(d){throw console.error(`fetchCorrectedNPCDetails_Service error (Attempt ${String(l+1)}/${String(S+1)}):`,d),d}return{result:null}})},W=new Set(G),Ge=["page","book","map","picture"],K=new Set(Ge);function Ve(t,e){const n=`${t} ${e}`.toLowerCase();return/(handwritten|scribbled|ink|pen|quill)/.test(n)?"handwritten":/(typewriter|typed)/.test(n)?"typed":/(digital|screen|display|tablet|monitor|terminal)/.test(n)?"digital":"printed"}function ie(t){if(!t||typeof t!="object")return!1;const e=t;return!(typeof e.actionName!="string"||e.actionName.trim()===""||typeof e.promptEffect!="string"||e.promptEffect.trim()===""||e.appliesWhenActive!==void 0&&typeof e.appliesWhenActive!="boolean"||e.appliesWhenInactive!==void 0&&typeof e.appliesWhenInactive!="boolean"||typeof e.description!="string"||e.description.trim()==="")}function q(t,e){if(!t||typeof t!="object")return!1;const n=t;if(typeof n.type=="string"){const c=M(n.type);c&&(n.type=c)}if(typeof n.name!="string"||n.name.trim()==="")return console.warn("isValidItem: 'name' is missing or invalid.",t),!1;if(e==="create"||!e){if(typeof n.type!="string"||!P.includes(n.type))return console.warn(`isValidItem (context: ${e??"default"}): 'type' is missing or invalid.`,t),!1;if(typeof n.description!="string"||n.description.trim()==="")return console.warn(`isValidItem (context: ${e??"default"}): 'description' is missing or invalid.`,t),!1;if(typeof n.holderId!="string"||n.holderId.trim()==="")return console.warn(`isValidItem (context: ${e??"default"}): 'holderId' is missing or invalid.`,t),!1}if(e==="change"&&n.newName!=null&&(typeof n.newName!="string"||n.newName.trim()===""))return console.warn("isValidItem (context: change, with newName): 'newName' is invalid.",t),!1;if(n.type!==void 0){const c=M(n.type);if(!c)return console.warn("isValidItem: 'type' is present but invalid.",t),!1;n.type=c}if(n.description!==void 0&&(typeof n.description!="string"||n.description.trim()==="")&&(e==="create"||e==="change"&&n.newName)&&n.description.trim()==="")return console.warn("isValidItem: 'description' is present but empty, which is invalid for a create or transformation.",t),!1;if(n.activeDescription!==void 0&&typeof n.activeDescription!="string")return console.warn("isValidItem: 'activeDescription' is present but invalid.",t),!1;if(n.isActive!==void 0&&typeof n.isActive!="boolean")return console.warn("isValidItem: 'isActive' is present but invalid.",t),!1;if(n.stashed!==void 0&&typeof n.stashed!="boolean")return console.warn("isValidItem: 'stashed' is present but invalid.",t),!1;if(n.tags!==void 0){if(!Array.isArray(n.tags)||!n.tags.every(a=>typeof a=="string"))return console.warn("isValidItem: 'tags' is present but invalid.",t),!1;const c=he(n.tags);c?n.tags=c:n.tags=n.tags.filter(a=>be.includes(a));const s=K.has(n.type??"")?[...D,...V]:D;n.tags=n.tags.filter(a=>s.includes(a))}if(K.has(n.type??"")){n.tags=n.tags??[];const c=n.tags.filter(s=>W.has(s));if(c.length===0){const s=Ve(n.name,n.description??"");n.tags.unshift(s)}else if(c.length>1){const[s]=c;n.tags=[s,...n.tags.filter(a=>!W.has(a))]}}if(n.holderId!==void 0&&(typeof n.holderId!="string"||n.holderId.trim()===""))return console.warn("isValidItem: 'holderId' is present but invalid.",t),!1;const o=c=>Array.isArray(c)&&c.every(s=>s&&typeof s=="object"&&typeof s.heading=="string"&&typeof s.description=="string"&&typeof s.contentLength=="number"&&(s.imageData===void 0||typeof s.imageData=="string"));if(n.type==="page"||n.type==="book"||n.type==="map"||n.type==="picture"){if(n.chapters!==void 0){if(!o(n.chapters))return console.warn("isValidItem: 'chapters' is present but invalid.",t),!1;(n.type==="page"||n.type==="map"||n.type==="picture")&&n.chapters.length>1&&(n.chapters=[n.chapters[0]])}else{const c=typeof n.contentLength=="number"?n.contentLength:30;n.chapters=[{heading:n.name,description:n.description??"",contentLength:c,actualContent:typeof n.actualContent=="string"?n.actualContent:void 0,visibleContent:typeof n.visibleContent=="string"?n.visibleContent:void 0}]}delete n.contentLength,delete n.actualContent,delete n.visibleContent}else if(n.chapters!==void 0&&!o(n.chapters))return console.warn("isValidItem: 'chapters' is present but invalid for non-book/page item.",t),!1;return n.contentLength!==void 0&&typeof n.contentLength!="number"?(console.warn("isValidItem: 'contentLength' is present but invalid.",t),!1):n.actualContent!==void 0&&typeof n.actualContent!="string"?(console.warn("isValidItem: 'actualContent' is present but invalid.",t),!1):n.visibleContent!==void 0&&typeof n.visibleContent!="string"?(console.warn("isValidItem: 'visibleContent' is present but invalid.",t),!1):n.knownUses!==void 0&&!(Array.isArray(n.knownUses)&&n.knownUses.every(ie))?(console.warn("isValidItem: 'knownUses' is present but invalid.",t),!1):!0}function X(t){if(!t||typeof t!="object")return!1;const e=t;return typeof e.id=="string"&&e.id.trim()!==""&&typeof e.name=="string"&&e.name.trim()!==""}function se(t){if(!t||typeof t!="object")return!1;const e=t;if(typeof e.id!="string"||e.id.trim()===""||typeof e.name!="string"||e.name.trim()===""||typeof e.type!="string"||!P.includes(e.type))return!1;const n=["page","book","map","picture"].includes(e.type);if(e.knownUses===void 0&&e.tags===void 0&&e.chapters===void 0||e.knownUses!==void 0&&!(Array.isArray(e.knownUses)&&e.knownUses.every(ie)))return!1;const o=n?[...D,...V]:D,c=Array.isArray(e.tags)&&e.tags.every(a=>o.includes(a)),s=Array.isArray(e.chapters)&&e.chapters.every(a=>{const r=a;return typeof r.heading=="string"&&typeof r.description=="string"&&typeof r.contentLength=="number"});if(n){if(!c||!s)return!1}else if(e.tags!==void 0&&!c||e.chapters!==void 0&&!s)return!1;return!0}function kt(t){if(!t||typeof t!="object")return!1;const e=t;if(typeof e.type=="string"){const n=M(e.type);n&&(e.type=n)}return typeof e.name=="string"&&e.name.trim()!==""&&typeof e.description=="string"&&e.description.trim()!==""&&typeof e.type=="string"&&P.includes(e.type)}function Ut(t){if(!t||typeof t!="object")return!1;const e=t;return typeof e.name!="string"||e.name.trim()===""||e.newDescription!==void 0&&typeof e.newDescription!="string"||e.newAliases!==void 0&&!(Array.isArray(e.newAliases)&&e.newAliases.every(n=>typeof n=="string"))||e.addAlias!==void 0&&typeof e.addAlias!="string"||e.newPresenceStatus!==void 0&&!R.includes(e.newPresenceStatus)||e.newLastKnownLocation!==void 0&&e.newLastKnownLocation!=null&&typeof e.newLastKnownLocation!="string"||e.newPreciseLocation!==void 0&&e.newPreciseLocation!=null&&typeof e.newPreciseLocation!="string"?!1:((e.newPresenceStatus==="nearby"||e.newPresenceStatus==="companion")&&e.newPreciseLocation,(e.newPresenceStatus==="distant"||e.newPresenceStatus==="unknown")&&e.newPreciseLocation!=null,!0)}function xt(t){if(!t||typeof t!="object")return!1;const e=t;return typeof e.name!="string"||e.name.trim()===""||typeof e.description!="string"||e.description.trim()===""||e.aliases!==void 0&&!(Array.isArray(e.aliases)&&e.aliases.every(n=>typeof n=="string"))||e.presenceStatus!==void 0&&!R.includes(e.presenceStatus)||e.lastKnownLocation!==void 0&&e.lastKnownLocation!=null&&typeof e.lastKnownLocation!="string"||e.preciseLocation!==void 0&&e.preciseLocation!=null&&typeof e.preciseLocation!="string"?!1:((e.presenceStatus==="nearby"||e.presenceStatus==="companion")&&e.preciseLocation,(e.presenceStatus==="distant"||e.presenceStatus==="unknown")&&e.preciseLocation!=null,!0)}function Ye(t){if(!t||typeof t!="object")return console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup is missing or not an object."),!1;const e=t;if(!Array.isArray(e.participants)||e.participants.length===0||!e.participants.every(o=>typeof o=="string"&&o.trim()!==""))return console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.participants is invalid.",e.participants),!1;const n=e.participants;return!Array.isArray(e.initialNpcResponses)||e.initialNpcResponses.length===0||!e.initialNpcResponses.every(o=>o&&typeof o.speaker=="string"&&o.speaker.trim()!==""&&n.includes(o.speaker)&&typeof o.line=="string"&&o.line.trim()!=="")?(console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.initialNpcResponses is invalid.",e.initialNpcResponses),!1):!Array.isArray(e.initialPlayerOptions)||e.initialPlayerOptions.length<4||!e.initialPlayerOptions.every(o=>typeof o=="string"&&o.trim()!=="")?(console.warn("isDialogueSetupPayloadStructurallyValid: dialogueSetup.initialPlayerOptions is invalid.",e.initialPlayerOptions),!1):!0}const jt=async(t,e,n,o)=>{if(o<=0)return[];const c=n.map(r=>`- ${r}`).join(`
`),s=`You are an AI assistant adding missing chapters to a book.
Book Title: "${t}"
Description: "${e}"
Existing Chapter Headings:
${c}

Task: Provide ${String(o)} additional chapter objects as JSON array. Each object must have "heading", "description", and "contentLength" (50-200).`,a=`Return ONLY the JSON array of ${String(o)} chapter objects.`;return A(async r=>{try{I(E.correction.icon);const{response:l}=await _({modelNames:[L],prompt:s,systemInstruction:a,responseMimeType:"application/json",temperature:T,label:"Corrections"}),d=l.text??"",p=$(C(d));if(Array.isArray(p)&&p.every(g=>typeof g.heading=="string"))return{result:p};console.warn(`fetchAdditionalBookChapters_Service (Attempt ${String(r+1)}/${String(S+1)}): invalid response`,p)}catch(l){throw console.error(`fetchAdditionalBookChapters_Service error (Attempt ${String(r+1)}/${String(S+1)}):`,l),l}return{result:null}})},Gt=async(t,e,n,o)=>{const c=`You are an AI assistant fixing a malformed addDetails JSON object for a text adventure game.

Malformed Payload:
\`\`\`json
${t}
\`\`\`

Log Message: "${e??"Not specified"}"
Scene Description: "${n??"Not specified"}"
Theme Guidance: "${o.systemInstructionModifier}"

Task: Provide ONLY the corrected JSON object with fields { "id": string, "name": string, "type": (${j}), "knownUses"?, "tags"?, "chapters"? }.`,s="Return only the corrected addDetails JSON object.";return A(async a=>{try{I(E.correction.icon);const{response:r}=await _({modelNames:[N,w],prompt:c,systemInstruction:s,responseMimeType:"application/json",temperature:T,label:"Corrections"}),l=r.text??"",d=$(C(l));if(d&&se(d))return{result:d};console.warn(`fetchCorrectedAddDetailsPayload_Service (Attempt ${String(a+1)}/${String(S+1)}): invalid response`,d)}catch(r){throw console.error(`fetchCorrectedAddDetailsPayload_Service error (Attempt ${String(a+1)}/${String(S+1)}):`,r),r}return{result:null}})},Vt=async(t,e,n,o)=>{const c=`You are an AI assistant that generates detailed information for a new game map location (a main MapNode) that has just been added to the game map. The Map AI should have provided these details, but this is a fallback.
Given the name of this new map location and the current narrative context, provide a suitable description and aliases for it. The provided 'Map Location Name to Detail' is fixed and MUST be used as the 'name' in your JSON response.

Map Location Name to Detail: "${t}"

## Narrative Context:
- Log Message: "${e??"Not specified"}"
- Scene Description: "${n??"Not specified"}"
- Theme Guidance: "${o.systemInstructionModifier}"

Required JSON Structure:
{
  "name": "${t}",
  "description": "string", // ${U}
  "aliases": ["string"] // ${x}
}

Respond ONLY with the single, complete JSON object.`,s=`Generate detailed JSON for a new game map location. The 'name' field in the output is predetermined and MUST match the input. Focus on creating ${U} and aliases (${x}, array, can be empty). Adhere strictly to the JSON format.`;return A(async a=>{try{I(E.correction.icon);const{response:r}=await _({modelNames:[N,w],prompt:c,systemInstruction:s,responseMimeType:"application/json",temperature:T,label:"Corrections"}),l=$(C(r.text??""));if(l&&typeof l.name=="string"&&l.name===t&&typeof l.description=="string"&&l.description.trim()!==""&&Array.isArray(l.aliases)&&l.aliases.every(d=>typeof d=="string"))return{result:l};console.warn(`fetchFullPlaceDetailsForNewMapNode_Service (Attempt ${String(a+1)}/$${String(S+1)}): Corrected map location payload invalid or name mismatch for "${t}". Response:`,l)}catch(r){throw console.error(`fetchFullPlaceDetailsForNewMapNode_Service error (Attempt ${String(a+1)}/$${String(S+1)}):`,r),r}return{result:null}})},Yt=async(t,e,n)=>{const o=e.currentMapNodeId&&e.themeNodes.find(i=>i.id===e.currentMapNodeId),c=new Map;e.themeNodes.forEach(i=>c.set(i.id,i));const s=new Map;e.themeNodes.forEach(i=>s.set(i.id,new Set)),e.themeEdges.forEach(i=>{s.has(i.sourceNodeId)||s.set(i.sourceNodeId,new Set),s.has(i.targetNodeId)||s.set(i.targetNodeId,new Set);const h=s.get(i.sourceNodeId);h&&h.add(i.targetNodeId);const u=s.get(i.targetNodeId);u&&u.add(i.sourceNodeId)});const a=t.nodeType??"feature",r=F[a],l=e.themeNodes.filter(i=>F[i.data.nodeType]<r).map(i=>`- ${i.id} ("${i.placeName}")`).join(`
`),d=e.themeEdges.map(i=>`${i.id} ${i.sourceNodeId}->${i.targetNodeId}`).join(`
`),p=`Map Node: "${t.placeName}" (${t.nodeType??"feature"})
Scene: "${e.sceneDescription}"
Current location: ${e.localPlace}
Current Map Node: ${o?o.placeName:"Unknown"}

## Possible Nodes:
${l}

## Edges:
${d}

Respond ONLY with the name or id of the best parent node, or "Universe" if none.`,g='Choose the most logical parent node name or id for the provided Map Node. If none is suitable use "Universe".';return A(async i=>{var h;try{I(E.correction.icon);const{response:u}=await _({modelNames:[L,N,w],prompt:p,systemInstruction:g,temperature:T,label:"Corrections",debugLog:n}),m=(h=u.text)==null?void 0:h.trim();if(m)return{result:m.trim()}}catch(u){throw console.error(`fetchLikelyParentNode_Service error (Attempt ${String(i+1)}/$${String(S+1)}):`,u),u}return{result:null}})},Ft=async(t,e,n)=>{const o=e.themeNodes.map(a=>`- ${a.id} ("${a.placeName}")`).join(`
`),c=`A different AI referred to a map location using an incorrect identifier: "${t}".
Known map nodes in the current theme:
${o}
Choose the most likely intended node ID from the list above. Respond with an empty string if none match.`,s="Respond ONLY with a single node ID from the list or an empty string.";return A(async a=>{var r;try{I(E.correction.icon);const{response:l}=await _({modelNames:[L,N,w],prompt:c,systemInstruction:s,temperature:T,label:"Corrections",debugLog:n}),d=(r=l.text)==null?void 0:r.trim();if(d){const p=d.trim(),g=e.themeNodes.find(h=>h.id===p);if(g)return{result:g.id};const i=e.themeNodes.find(h=>h.placeName===p);if(i)return{result:i.id}}}catch(l){throw console.error(`fetchCorrectedNodeIdentifier_Service error (Attempt ${String(a+1)}/$${String(S+1)}):`,l),l}return{result:null}})},Fe={type:"object",properties:{observations:{type:"string",minLength:1500,description:"Contextually relevant observations about the chains and map graph."},rationale:{type:"string",minLength:1e3,description:"Explain the reasoning behind your chain fixes and refinement suggestions."},nodesToAdd:{type:"array",description:"List of nodes to add to the map.",minItems:1,items:{type:"object",properties:{placeName:{type:"string",description:"A contextually relevant location name, based on Theme and Scene Description"},data:{type:"object",properties:{description:{type:"string",minLength:30,description:U},aliases:{type:"array",description:x,minItems:2,items:{type:"string"}},status:{enum:ne},nodeType:{enum:["feature"]},parentNodeId:{type:"string",description:"Name of the Parent Node this feature belongs to, or 'Universe' (keyword for root node) if it has no parent"}},required:["description","aliases","status","nodeType","parentNodeId"],additionalProperties:!1}},required:["placeName","data"],additionalProperties:!1}},edgesToAdd:{type:"array",items:{type:"object",properties:{sourcePlaceName:{type:"string",description:"Name of the source feature node. MUST be a feature type node."},targetPlaceName:{type:"string",description:"Name of the target feature node. MUST be a feature type node."},data:{type:"object",properties:{type:{enum:ae},status:{enum:oe},description:{type:"string",minLength:30,description:De}},required:["type","status","description"],additionalProperties:!1}},required:["sourcePlaceName","targetPlaceName","data"],additionalProperties:!1}}},required:["observations","rationale","nodesToAdd","edgesToAdd"],additionalProperties:!1},Ht=async(t,e)=>{if(t.length===0)return{payload:null,debugInfo:null};const o=(()=>{const r=new Map,l=new Map,d=[];t.forEach((i,h)=>{const u=new Set,m=[];[...i.sourceChain,...i.targetChain.slice().reverse()].forEach(y=>{y.data.nodeType!=="feature"&&!u.has(y.id)&&(m.push(y),u.add(y.id),r.set(y.id,y))}),m.length===0&&(u.has(i.originalSource.id)||(m.push(i.originalSource),u.add(i.originalSource.id),r.set(i.originalSource.id,i.originalSource)),u.has(i.originalTarget.id)||(m.push(i.originalTarget),u.add(i.originalTarget.id),r.set(i.originalTarget.id,i.originalTarget)));for(let y=0;y<m.length-1;y++){const f=m[y],v=m[y+1],O=f.id<v.id?`${f.id}|${v.id}`:`${v.id}|${f.id}`;l.has(O)||l.set(O,{source:f,target:v,data:i.edgeData})}d.push(`Chain ${String(h+1)}: ${m.map(y=>`"${y.placeName}"`).join(" -> ")}`)});const p=Array.from(r.values()).map((i,h)=>{const u=e.themeNodes.filter(m=>m.data.parentNodeId===i.id&&m.data.nodeType==="feature").map(m=>` - "${m.placeName}" (${m.data.nodeType}, ${m.data.status}, ${m.data.description})`).join(`
`)||" - None";return`Node ${String(h+1)}: "${i.placeName}" (Type: ${i.data.nodeType}, Status: ${i.data.status}, Description: ${i.data.description})
${u}`}).join(`
`),g=Array.from(l.values()).map((i,h)=>`Edge ${String(h+1)}: "${i.source.placeName}" -> "${i.target.placeName}" (Type: ${i.data.type??"path"}, Status: ${i.data.status??"open"}, Desc: ${i.data.description??"None"})`).join(`
`);return`Parent Nodes:
${p}

Edges:
${g}

Chains:
${d.join(`
`)}`})(),c=`Suggest chains of locations (feature nodes) to connect distant map nodes in a text adventure.
** Context: **
Scene Description: "${e.sceneDescription}"
Theme: "${e.currentTheme.name}" (${e.currentTheme.systemInstructionModifier})

---

## Graph:
${o}`,s=`Imagine a Player travelling along the provided chains. For each Parent Node in the graph imagine locations within them that may connect them to their neighbours.
CHOOSE ONE for each Parent Node:
- IF there is a contextually appropriate feature node already present under that Parent Node, use it directly in edgesToAdd.
- IF there is 'None', or no appropriate candidate feature node exists under that Parent Node, you MUST use nodesToAdd to add a contextually appropriate feature node with full information, based on Context.

ALWAYS choose between selecting an existing feature node OR adding a new one. NEVER leave a Parent Node without a feature node connected to neighbour Parent Nodes' feature nodes.
You can add edges ONLY between feature nodes. NEVER try to connect feature nodes to Parent Nodes directly. NEVER try to connect Parent Nodes to each other.
New edges MUST inherit the original chain edge type and status.
Every new node MUST have a unique placeName. Use only the valid node/edge status and type values.
Edges MUST connect ALL feature nodes along each chain path using the shared feature nodes for common Parent Nodes.

${Pe}
${Re}
${ke}
`;return await A(async r=>{var l,d,p;try{console.log(`fetchConnectorChains_Service (Attempt ${String(r+1)}/${String(S+1)})`),I(E.correction.icon);const{response:g}=await _({modelNames:[N,w],prompt:c,systemInstruction:s,thinkingBudget:2048,includeThoughts:!0,responseMimeType:"application/json",jsonSchema:Fe,temperature:T,label:"Corrections"}),h=(((p=(d=(l=g.candidates)==null?void 0:l[0])==null?void 0:d.content)==null?void 0:p.parts)??[]).filter(v=>v.thought===!0&&typeof v.text=="string").map(v=>v.text),u={prompt:c,rawResponse:g.text??"",parsedPayload:void 0,validationError:void 0,observations:void 0,rationale:void 0,thoughts:h.length>0?h:void 0},m=C(g.text??""),y=$(m);if(!y)return u.validationError="Failed to parse JSON",{result:{payload:null,debugInfo:u}};let f=null;return Array.isArray(y)?f=y.reduce((v,O)=>{if(O&&typeof O=="object"){const b=O;Array.isArray(b.nodesToAdd)&&(v.nodesToAdd=[...v.nodesToAdd??[],...b.nodesToAdd]),Array.isArray(b.edgesToAdd)&&(v.edgesToAdd=[...v.edgesToAdd??[],...b.edgesToAdd]),b.observations&&!v.observations&&(v.observations=b.observations),b.rationale&&!v.rationale&&(v.rationale=b.rationale)}return v},{}):typeof y=="object"&&(f=y),u.parsedPayload=f??void 0,f&&(f.observations&&!u.observations&&(u.observations=f.observations),f.rationale&&!u.rationale&&(u.rationale=f.rationale)),f&&(f.nodesToAdd||f.edgesToAdd)?{result:{payload:f,debugInfo:u}}:(u.validationError="Parsed JSON missing nodesToAdd or edgesToAdd",{result:{payload:null,debugInfo:u}})}catch(g){throw console.error(`fetchConnectorChains_Service error (Attempt ${String(r+1)}/${String(S+1)}):`,g),g}})??{payload:null,debugInfo:null}},Jt=async(t,e,n,o)=>{const c=`A feature node has acquired a child which violates the map hierarchy rules.
Parent Feature: "${t.placeName}" (Desc: "${t.data.description}")
Child Node: "${e.placeName}" (Type: ${e.data.nodeType})
Choose the best fix: "convert_child" to make the child a sibling, or "upgrade_parent" to upgrade the parent to a higher-level node.`,s="Respond only with convert_child or upgrade_parent.";return A(async a=>{var r;try{I(E.correction.icon);const{response:l}=await _({modelNames:[L,N,w],prompt:c,systemInstruction:s,temperature:T,label:"Corrections",debugLog:o}),d=((r=l.text)==null?void 0:r.trim())??null;if(d){const p=d.trim().toLowerCase();if(p.includes("upgrade"))return{result:"upgrade_parent"};if(p.includes("convert")||p.includes("sibling"))return{result:"convert_child"}}}catch(l){throw console.error(`decideFeatureHierarchyUpgrade_Service error (Attempt ${String(a+1)}/$${String(S+1)}):`,l),l}return{result:null}})},Bt=async(t,e)=>{const n=t.options.map((s,a)=>`${String(a+1)}. ${s}`).join(`
`),o=`Scene: ${t.sceneDescription}
Parent: "${t.parent.placeName}" (${t.parent.data.nodeType}) - ${t.parent.data.description}
Child: "${t.child.placeName}" (${t.child.data.nodeType}) - ${t.child.data.description}
Choose the most sensible resolution for their hierarchy conflict:
${n}
Respond ONLY with the option number.`,c="Answer with the single number of the best option.";return A(async s=>{var a;try{I(E.correction.icon);const{response:r}=await _({modelNames:[L,N,w],prompt:o,systemInstruction:c,temperature:T,label:"Corrections",debugLog:e}),l=(a=r.text)==null?void 0:a.trim();if(l){const d=parseInt(l.trim(),10);if(Number.isInteger(d)&&d>=1&&d<=t.options.length)return{result:d}}}catch(r){throw console.error(`chooseHierarchyResolution_Service error (Attempt ${String(s+1)}/$${String(S+1)}):`,r),r}return{result:null}})},Wt=async(t,e,n,o,c,s)=>{if(c.length===0)return console.warn(`fetchCorrectedName_Service: No valid names provided for ${t} to match against. Returning original: "${e}".`),e;const a=`The corrected ${t} name MUST be one of these exact, case-sensitive full names: [${c.map(d=>`"${d}"`).join(", ")}].`,r=`
You are an AI assistant specialized in matching a potentially incorrect or partial entity name against a predefined list of valid names, using narrative context.
Entity Type: ${t}
Malformed/Partial Name Provided by another AI: "${e}"

Narrative Context (use this to understand which entity was likely intended):
- Log Message: "${n??"Not specified, infer from scene."}"
- Scene Description: "${o??"Not specified, infer from log."}"

List of Valid Names:
${a}

Task: Based on the context and the list of valid names, determine the correct full string name.
Respond ONLY with the single, corrected ${t} name as a string.
If no suitable match can be confidently made, respond with an empty string.`,l=`Your task is to match a malformed ${t} name against a provided list of valid names, using narrative context. Respond ONLY with the best-matched string from the valid list, or an empty string if no confident match is found. Adhere to the theme context: ${s.systemInstructionModifier}`;return A(async d=>{var p;try{I(E.correction.icon);const{response:g}=await _({modelNames:[L,N,w],prompt:r,systemInstruction:l,temperature:T,label:"Corrections"}),i=((p=g.text)==null?void 0:p.trim())??null;if(i!==null){let h=i.trim();if(h=h.replace(/^['"]+|['"]+$/g,"").trim(),h==="")return console.warn(`fetchCorrectedName_Service (Attempt ${String(d+1)}/${String(S+1)}): AI indicated no match for ${t} "${e}" from the valid list.`),{result:null,retry:!1};if(c.includes(h))return console.warn("fetchCorrectedName_Service: Returned corrected Name ",h,"."),{result:h};console.warn(`fetchCorrectedName_Service (Attempt ${String(d+1)}/${String(S+1)}): AI returned name "${h}" for ${t} which is NOT in the validNamesList. Discarding result.`)}else console.warn(`fetchCorrectedName_Service (Attempt ${String(d+1)}/${String(S+1)}): AI call failed for ${t}. Received: null`)}catch(g){throw console.error(`fetchCorrectedName_Service error (Attempt ${String(d+1)}/${String(S+1)}):`,g),g}return{result:null}})},Kt=async(t,e,n)=>{const o=new Map;t.forEach(s=>{const a=s.placeName.toLowerCase(),r=o.get(a)??[];r.push(s),o.set(a,r)});const c=[];for(const s of Array.from(o.values()))if(!(s.length<=1))for(let a=1;a<s.length;a+=1){const r=s[a],l=`You are an AI assistant disambiguating map location names in a text adventure game.
Theme: "${e.name}"
Another map node shares the name "${s[0].placeName}". Provide a short, unique new name for the following node.
Node Type: ${r.data.nodeType}
Aliases: ${(r.data.aliases??[]).join(", ")||"None"}
Description: ${r.data.description}`,d="Respond ONLY with a short Title Case name that distinguishes this location.",p=await A(async g=>{var i;try{I(E.correction.icon);const{response:h}=await _({modelNames:[L,N,w],prompt:l,systemInstruction:d,temperature:T,label:"Corrections",debugLog:n}),u=(i=h.text)==null?void 0:i.trim();if(u){const m=u.replace(/^['"]+|['"]+$/g,"").trim();if(m)return{result:m}}}catch(h){throw console.error(`assignSpecificNamesToDuplicateNodes_Service error (Attempt ${String(g+1)}/${String(S+1)}):`,h),h}return{result:null}});p&&c.push({nodeId:r.id,newName:p})}return c},He=(t,e)=>{const n=C(t),o=$(n);try{if(!o)throw new Error("JSON parse failed");if(!Array.isArray(o.npcResponses)||!o.npcResponses.every(s=>typeof s.speaker=="string"&&typeof s.line=="string")||!Array.isArray(o.playerOptions)||!o.playerOptions.every(s=>typeof s=="string")||o.dialogueEnds!==void 0&&typeof o.dialogueEnds!="boolean"||o.updatedParticipants!==void 0&&(!Array.isArray(o.updatedParticipants)||!o.updatedParticipants.every(s=>typeof s=="string")))return console.warn("Parsed dialogue JSON does not match DialogueAIResponse structure:",o),null;o.playerOptions.length===0&&(o.playerOptions=["End Conversation."]);const c=o;return e&&e.length>0&&c.npcResponses.forEach((s,a)=>{e[a]&&(s.thought=e[a])}),c}catch(c){return console.warn("Failed to parse dialogue JSON response from AI:",c),console.debug("Original dialogue response text:",t),null}},Je=(t,e)=>He(t,e),qt=async(t,e,n,o,c,s,a,r)=>{const l=o.length>0?ge(o," - "):"None specifically known in this theme yet.",d=Q(c,!0),p=s.map(u=>u.name).join(", ")||"Empty",i=`
Role: You are an AI assistant correcting a malformed 'dialogueSetup' JSON payload for a text adventure game.
Task: Reconstruct the 'dialogueSetup' object based on narrative context and the malformed data.

Malformed 'dialogueSetup' Payload:
\`\`\`json
${JSON.stringify(r)}
\`\`\`

Narrative Context:
- Log Message: "${t??"Not specified"}"
- Scene Description: "${e??"Not specified"}"
- Theme Guidance: "${n.systemInstructionModifier}"
- Known/Available NPCs for Dialogue: ${l}
- Known Map Locations: ${d}
- Player Inventory: ${p}
- Player Gender: "${a}"

Required JSON Structure for corrected 'dialogueSetup':
{
  "participants": ["NPC Name 1", "NPC Name 2"?],
  "initialNpcResponses": [{ "speaker": "NPCr Name 1", "line": "Their first line." }],
  "initialPlayerOptions": []
}

Respond ONLY with the single, complete, corrected JSON object for 'dialogueSetup'.`,h="Correct a malformed 'dialogueSetup' JSON payload. Ensure 'participants' are valid NPCs, 'initialNpcResponses' are logical, and 'initialPlayerOptions' are varied with an exit option. Adhere strictly to the JSON format.";return A(async u=>{try{I(E.correction.icon);const{response:m}=await _({modelNames:[N,w],prompt:i,systemInstruction:h,responseMimeType:"application/json",temperature:T,label:"Corrections"}),y=$(C(m.text??""));if(y&&Ye(y))return{result:y};console.warn(`fetchCorrectedDialogueSetup_Service (Attempt ${String(u+1)}/${String(S+1)}): Corrected dialogueSetup payload invalid. Response:`,y)}catch(m){throw console.error(`fetchCorrectedDialogueSetup_Service error (Attempt ${String(u+1)}/${String(S+1)}):`,m),m}return{result:null}})},Xt=async(t,e,n,o)=>{const c=e.map(r=>`"${r}"`).join(", ")||"None",s=`Role: You fix malformed JSON for a dialogue turn in a text adventure game.

Theme Guidance: "${n.systemInstructionModifier}"

Malformed Dialogue Response:
\`\`\`
${t}
\`\`\`

Valid Participant Names: [${c}]

Required JSON Structure:
{
  "npcResponses": [{ "speaker": "Name", "line": "text" }],
  "playerOptions": ["text"],
  "dialogueEnds": boolean?,
  "updatedParticipants": ["Name"]?
}

Do NOT change the text of any npcResponses.line or playerOptions.
Ensure each "speaker" value is one of the valid participant names.
Respond ONLY with the corrected JSON object.`,a=`Correct a malformed dialogue turn JSON object without altering the dialogue text. Speaker names must be among: ${c}. Adhere strictly to JSON format.`;return A(async r=>{var l;try{I(E.correction.icon);const{response:d}=await _({modelNames:[L,N,w],prompt:s,systemInstruction:a,temperature:T,label:"Corrections"}),p=((l=d.text)==null?void 0:l.trim())??null;if(p){const g=Je(p,o);if(g!=null&&g.npcResponses.every(i=>e.includes(i.speaker)))return{result:g};console.warn(`fetchCorrectedDialogueTurn_Service (Attempt ${String(r+1)}/${String(S+1)}): corrected response invalid or speakers not in list.`,p)}else console.warn(`fetchCorrectedDialogueTurn_Service (Attempt ${String(r+1)}/${String(S+1)}): AI returned empty response.`)}catch(d){throw console.error(`fetchCorrectedDialogueTurn_Service error (Attempt ${String(r+1)}/${String(S+1)}):`,d),d}return{result:null}})},z=(t,e)=>{switch(e){case"create":{const n=t;if((typeof n.holderId!="string"||n.holderId.trim()==="")&&(n.holderId=ee),q(n,"create")){const o=n;return o.knownUses=Y(o.knownUses),{action:e,item:n}}return null}case"change":{const n=t,o=typeof n.type=="string"?n.type:void 0,c=typeof n.status=="string"?n.status:void 0,s=o?M(o):null,a=c?c.toLowerCase():null,r=o?o.toLowerCase():null;if(s&&k.has(s)||r&&k.has(r)||a&&k.has(a)){const l={id:typeof n.id=="string"?n.id:void 0,name:typeof n.name=="string"?n.name:void 0};return X(l)?{action:"destroy",item:l}:null}if(q(t,"change")){const l=t;return l.knownUses=Y(l.knownUses),{action:"change",item:t}}return null}case"addDetails":return se(t)?{action:"addDetails",item:t}:{action:"addDetails",item:t,invalidPayload:t};case"destroy":return X(t)?{action:"destroy",item:t}:null;case"move":{const n=t;if(typeof n.id=="string"&&typeof n.newHolderId=="string"){const o={id:n.id,name:n.name,newHolderId:n.newHolderId};return{action:e,item:o}}return null}default:return null}},Be=t=>{const e=C(t),n=$(e);if(!n)return null;let o=null;const c=(a,r)=>{const l=[];for(const d of a){if(!d||typeof d!="object")continue;const p=z(d,r);p&&l.push(p)}return l},s=a=>{const r=[];for(const l of a){if(!l||typeof l!="object")continue;const d=l,p=typeof d.action=="string"?d.action:void 0,g=d.item&&typeof d.item=="object"?d.item:void 0;if(p&&g){const i=z(g,p);i&&r.push(i)}}return r};if(Array.isArray(n))o={itemChanges:c(n,"create")};else if(typeof n=="object"){const a=n,r=[];Array.isArray(a.create)&&r.push(...c(a.create,"create")),Array.isArray(a.change)&&r.push(...c(a.change,"change")),Array.isArray(a.move)&&r.push(...c(a.move,"move")),Array.isArray(a.destroy)&&r.push(...c(a.destroy,"destroy")),Array.isArray(a.addDetails)&&r.push(...c(a.addDetails,"addDetails")),Array.isArray(a.itemChanges)&&r.push(...s(a.itemChanges)),o={itemChanges:r,observations:typeof a.observations=="string"?a.observations:void 0,rationale:typeof a.rationale=="string"?a.rationale:void 0}}return o},zt=async(t,e,n,o,c,s,a,r,l,d)=>{const p=`You are an AI assistant fixing a malformed inventory update JSON payload for a text adventure game.

## Malformed Payload:
\`\`\`json
${t}
\`\`\`

## Narrative Context:
- Log Message: "${e??"Not specified"}"
- Scene Description: "${n??"Not specified"}"
- Player Items Hint: "${o}"
- World Items Hint: "${c}"
- NPC Items Hint: "${s}"
- Current Place ID: "${a??"unknown"}"
- Companions: ${r}
- Nearby NPCs: ${l}
- Theme Guidance: "${d.systemInstructionModifier||"General adventure theme."}"

Task: Provide ONLY the corrected JSON array of ItemChange objects.`,g=`Correct a JSON array of ItemChange objects for the inventory system. Each element must follow this structure:
{ "action": (${Ee}), "item": { ... } }
Valid item types: ${j}. Holder IDs can be "${ee}", "${a??"unknown"}", companion IDs, or nearby NPC IDs from the context. Respond ONLY with the corrected JSON array.`;return A(async i=>{try{I(E.correction.icon);const{response:h}=await _({modelNames:[N,w],prompt:p,systemInstruction:g,responseMimeType:"application/json",temperature:T,label:"Corrections"}),u=$(C(h.text??"")),m=u?Be(JSON.stringify(u)):null,y=m?m.itemChanges:null;if(y)return{result:y};console.warn(`fetchCorrectedItemChangeArray_Service (Attempt ${String(i+1)}/${String(S+1)}): corrected payload invalid.`,u)}catch(h){throw console.error(`fetchCorrectedItemChangeArray_Service error (Attempt ${String(i+1)}/${String(S+1)}):`,h),h}return{result:null}})};export{R as $,x as A,F as B,Ze as C,at as D,De as E,Jt as F,N as G,Yt as H,qe as I,Ht as J,Bt as K,E as L,L as M,Nt as N,Ft as O,Vt as P,Kt as Q,Tt as R,Pt as S,G as T,Mt as U,P as V,V as W,Ce as X,Le as Y,ee as Z,j as _,rt as a,ct as a0,Ae as a1,Ie as a2,Wt as a3,Ye as a4,xt as a5,Ut as a6,qt as a7,Rt as a8,T as a9,H as aA,J as aB,It as aC,xe as aD,lt as aE,nt as aF,tt as aG,et as aH,pt as aI,Ot as aa,Ct as ab,Je as ac,Xt as ad,Dt as ae,$t as af,Ee as ag,Me as ah,Be as ai,zt as aj,Gt as ak,jt as al,D as am,ht as an,gt as ao,Xe as ap,mt as aq,dt as ar,st as as,ut as at,ve as au,Se as av,ye as aw,Qe as ax,Ne as ay,ze as az,ot as b,it as c,At as d,Lt as e,bt as f,_t as g,Et as h,w as i,S as j,wt as k,be as l,kt as m,Pe as n,Re as o,ke as p,ne as q,re as r,ae as s,oe as t,_ as u,vt as v,St as w,yt as x,ft as y,U as z};
