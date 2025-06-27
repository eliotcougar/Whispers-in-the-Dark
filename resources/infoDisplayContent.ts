const infoDisplayContent = {
  "title": "About Whispers in the Dark",
  "sections": [
    {
      "header": "About \"Whispers in the Dark\"",
      "text": [
        "Welcome to \"Whispers in the Dark,\" an AI-powered text adventure game where you navigate a constantly shifting reality. Your choices directly shape your fate as you uncover secrets, manage your inventory, and survive the challenges presented by an enigmatic Dungeon Master, powered by Google's Gemini AI. Each reality shift brings a new theme, new quests, and new dangers. You can also choose to start a \"Custom Game\" in a specific theme with random reality shifts disabled."
      ]
    },
    {
      "header": "Game Mechanics",
      "text": [
        "Core Gameplay Loop: Read the scene description, then choose one of the provided action options, or use any of your items. Your actions determine the story's progression.",
        "Inventory: You'll acquire items throughout your adventure. Items can be gained, lost, or used. Some items have specific \"Known Uses\" that unlock as you interact with them or the environment. You can \"Inspect\" items for more details or \"Attempt to Use\" them in a generic way if no specific use is known or applicable. Item types include single-use, multi-use, equipment, containers, keys, weapons, ammunition, vehicles, immovable features, and status effects.",
        "Quests & Objectives: Each theme typically has an \"Overarching Quest\" (a long-term goal) and a \"Current Objective\" (a short-term task). Completing objectives grants Score points and advances the story. The win/lose conditions are not implemented yet, and completing the main quest does not do much.",
        "Local Context: The game tracks \"Local Time,\" \"Local Environment,\" and \"Local Place.\" These details are influenced by your actions and the AI's narrative, providing a more immersive experience. The AI uses this context to generate scenes and the Image Visualizer uses it to create more accurate pictures.",
        "Score & Custom Actions: You earn Score points primarily by completing objectives. These points can be spent to perform \"Custom Actions\" by typing your desired action into the input field. Custom actions cost points and have a character limit.",
        "Reality Shifts: The game world is unstable. In a standard game, reality shifts can occur randomly based on settings, or you can trigger them manually. Each shift brings a new theme.",
        "Custom Game Mode: From the main menu, you can select \"Custom Game\" to choose a specific theme to start in. In this mode, random reality shifts are disabled, allowing for a more focused single-theme experience. Manual shifts are still possible if you wish to change themes."
      ]
    },
    {
      "header": "Notable Features",
      "text": [
        "Image Visualizer: Click the \"eye\" icon to generate an AI-powered image representing the current scene. It uses Imagen 3, and the daily quota is not very big. If you use it up, it will fall back to Gemini 2.0 Image Generation Preview",
        "Knowledge Base: Click the \"book\" icon to view details about all Places and NPCs you've discovered across different themes.",
        "History: This panel shows your Game Log and a summary of themes you've previously experienced.",
        "Map Display: Use the map icon to view a dynamic graph of locations within the current theme, showing connections and your current position."
      ]
    },
    {
      "header": "Save Game Functionality & Game Updates",
      "text": [
        "Autosave: The game automatically saves your progress to your browser's local storage periodically. However, this save can be lost if the current version of the game you play is updated. Please, do a manual save to a file before closing the game.",
        "Manual Save/Load: You can manually save your game to a file (`.json`) and load it later using the dedicated toolbar buttons. This is useful for backups or transferring saves between devices.",
        "Game Updates & Save Compatibility: \"Whispers in the Dark\" is an evolving game. While we strive for backward compatibility with save files, significant updates that change the game's data structure might affect older saves. The game tracks a `saveGameVersion` (currently: {{CURRENT_SAVE_GAME_VERSION}}). If you load a save from an older version, the game will attempt to adapt it. For example, if a new field like \"Local Place\" is added, the game might infer its value or use a default for older saves. However, very old or structurally incompatible saves might not load correctly or could lead to unexpected behavior. It's always a good idea to manually save your game before major updates if you wish to preserve a specific state."
      ]
    },
    {
      "header": "AI Models & Disclaimers",
      "text": [
        "This game is powered by Google's Gemini large language models:",
        "Text Generation: {{GEMINI_MODEL_NAME}}",
        "Image Generation: imagen-3.0-generate-002 (fallback gemini-2.0-flash-preview-image-generation)",
        "AI Unpredictability: As with any generative AI, the responses can sometimes be unpredictable, creative in unexpected ways, or may not perfectly adhere to all instructions or context. This is part of the charm and challenge of an AI-driven adventure!",
        "API Quotas: The use of these AI models is subject to API call limits and quotas. If you (or the environment this app is running in) exceed these daily quotas, the game's AI features (text generation, image visualization) may temporarily stop working until the quota resets."
      ]
    }
  ],
  "changelog": [
    {
      "title": "Version 1.4 (Ink and Quill Update)",
      "items": [
        "Major new features - Books and Notes. Player's Journal. Loremaster AI.",
        "Removed \"Knowledge\" items from the game. They are now replaced with Lore database managed by Loremaster AI.",
        "Updated the AI model to Gemini 2.5-flash.",
        "The auxiliary model now uses Gemini 2.5-flash-lite. Auxiliary requests now use Thinking.",
        "Updated Image Generation model to Imagen 4 preview.",
        "Updated Google GenAI API to the latest version, allowing the game to request strict JSON responses from the AI. That means less malformed responses and less need for Corrections."
      ]
    },
    {
      "title": "Version 1.3.2 (bugfix)",
      "items": [
        "Major refactor and cleanup of the codebase.",
        "Cleaned up the design a little bit.",
        "Added Gemini API use rate indicators. Wait if any of them are red.",
        "You can now pinch-zoom visualized images on mobile devices.",
        "You can now see the info about highlighted entities in the Scene description."
      ]
    },
    {
      "title": "Version 1.3.1 (bugfix)",
      "items": [
        "Fixed some bugs here and there.",
        "The toolbar is now usable on small mobile screens again.",
        "Fixed the tooltips alignment when they are close to the edges of the map.",
        "Fall back to Gemini 2.0 Image Generation Preview for players without paid account outside of AI Studio or when the quota is exceeded.",
        "Fixed Inventory AI being unable to place items on the map because it was unaware of any map nodes.",
        "Added pseudo-thinking to the Inventory AI model. Should help with disappearing items and other weirdness."
      ]
    },
    {
      "title": "Version 1.3 (Spatio-Temporal Update)",
      "items": [
        "Biggest feature - Map.",
        "Known Places moved from Knowledge Base to the new Map.",
        "Game Log moved to the History screen where Past Realities are.",
        "NPCs now remember past conversations with the player.",
        "Added \"Custom Game\" option to the Main Menu: You can now choose a specific theme to start in, and random reality shifts will be disabled for that playthrough.",
        "Manual shifts in Custom Game give you full control over your destination.",
        "Removed error-triggered reality shifts entirely.",
        "Retry button now really performs a retry.",
        "A lot more heuristics to deal with slightly malformed AI responses.",
        "The number of main options increased to 6 to accomodate the additional variety of actions related to moving around.",
        "Cartographer AI now uses a pseudo-thinking hack to improve the output."
      ]
    },
    {
      "title": "Version 1.2.2 (bugfix)",
      "items": [
        "Substantial refactoring of the core logic and removal of duplicate code. GenAI creates a lot of duplicate code.",
        "Rewritten all the AI prompts to improve the robustness of the output.",
        "Some auxiliary prompts now use a faster \"Gemini 2.0-Flash\" model. Storyteller still uses \"Gemini 2.5-flash\".",
        "Increased temperature of AI storyteller slightly to make it more creative.",
        "The initial scenarios can now vary a little from game to game.",
        "You are guaranteed to get theme-relevant items at the start of a new game.",
        "Fixed some UI elements not updating with the game state.",
        "Added an animated overlay for gaining, losing, and changing items. You can cancel it by clicking if too many items transform after shift. (it took me way too long to debug, the AI couldn't find the source of the visual bugs)",
        "Implemented more triage procedures for malformed AI output when it tried to trigger an action with nonexistent item/place/NPC.",
        "Operations with items are now more reliable, primarily as the rusult of the previous fix.",
        "Items now track their specific functions better and don't inexplicably lose them as often.",
        "Items now recieve their whenActive/whenInactive actions more reliably. Torches, flashlights, powered equipment, wielded weapons, worn clothing/armor.",
        "The number of uses for limited-use items like food, water, ammo, etc. can go up and down.",
        "Items should no longer get a duplicate \"Inspect\" function too often.",
        "The majority of anachronistic items now transform right after shift, while the reality is still unstable.",
        "Reality shifts can no longer happen when exiting from Dialogue Mode and no longer lead to lost outcome.",
        "When returning to a previously visited reality, you have a good chance to restore your important quest items via anachronistic transformation.",
        "Cosmetic changes to the Dialogue Mode.",
        "Save File version conversion is now possible."
      ]
    },
    {
      "title": "Version 1.2.1 (bugfix)",
      "items": [
        "Fixed many bugs related to conversations and their effects.",
        "Fixed a bug where Companions and Nearby NPCs were not cleared when starting new game.",
        "Made Conversations UI easier to use on mobile.",
        "Turns since last Shift is now saved correctly.",
        "Added a Debug View for myself to see the game state and AI requests and responses."
      ]
    },
    {
      "title": "Version 1.2 (Companions update)",
      "items": [
        "Implemented tracking of Companions and nearby NPCs in the scene context for better cohesion.",
        "Biggest feature - Conversations with NPCs.",
        "Moved New Game, Save Game, Load Game, and Settings to the Main Menu.",
        "Moved History to a dedicated screen next to Knowledge Base.",
        "Inventory Items can now be arranged in multiple columns on bigger screens.",
        "Basic Inventory sorting.",
        "Fixed the ability to exit and enter vehicles. (Try exiting an airship while it's flying)",
        "Some code refactoring and simplification behind the scenes.",
        "Less obtrusive attention to player's character gender in scene descriptions. Hopefully...",
        "Less frequent garbled text in the Visualizer images."
      ]
    },
    {
      "title": "Version 1.1",
      "items": [
        "Enhanced item types and descriptions in AI prompt for better item management.",
        "Refined save/load system with more robust handling of older save files, including inferring missing data where possible.",
        "Improved AI payload validation and new correction services to attempt to fix malformed AI responses (e.g., for items, local place).",
        "Added \"Score\" system: gain points for objectives, spend points on \"Custom Actions\".",
        "Introduced \"Custom Action\" input field for more player agency.",
        "Added confirmation dialogs for \"Restart Game\" and \"Force Reality Shift\" actions.",
        "Initial screen now offers \"Start a New Adventure\" or \"Load a Save File\" before gameplay begins.",
        "Simplified History display to show only theme name and summary for a cleaner look.",
        "Standardized font sizes across various UI boxes (Quest, Objective, Last Action, Options) for consistency.",
        "Added Knowledge Base where you can see all the Places and NPCs encountered.",
        "Added Visualizer that uses Imagen 3 to show the current scene.",
        "Integrated \"Local Time\" and \"Local Environment\" as dynamic context for the AI, influencing scene generation and displayed in the UI.",
        "Incorporated \"Local Time\" and \"Local Environment\" into the Image Visualizer prompt for more contextually accurate images.",
        "Loading spinner is now non-obstructive; main UI elements remain visible during AI generation.",
        "Fixed a bug where reality shift disorientation actions were incorrectly disabled.",
        "Inventory display updated: newly acquired items appear at the top and feature a brief animation.",
        "Centralized the definition of `VALID_ITEM_TYPES` for consistency across the application and AI prompts.",
        "Refactored components responsible for main game state and AI response fixes.",
        "Added \"Local Place\" tracking: AI now manages and updates the player's specific location within a scene. This is displayed in the UI, used as AI context, influences image generation, and includes correction logic for older save files.",
        "Added the ability to discard Junk items. The AI storyteller decides which items may be treated as junk at every moment.",
        "Added the ability to choose a set of Theme-packs in the settings to limit the genres of the adventure.",
        "Added Player's Character gender to Settings that can slightly affect the story.",
        "Settings are now accessible from the Title screen (when no saved game exist).",
        "The additional tracking of time and space greatly improved the cohesion of the storytelling.",
        "Added this \"Info\" panel for game guidance and changelog."
      ]
    },
    {
      "title": "Version 1.0 (Initial Release Features)",
      "items": [
        "Core gameplay loop: scene descriptions, action options, and AI-driven responses.",
        "Basic inventory system: gain, lose, and use items.",
        "Initial quest and objective system to guide players.",
        "Multiple adventure themes with random reality shifts between them.",
        "Game log to track player actions and key events.",
        "Autosave functionality to browser's local storage.",
        "Manual save and load game to/from a file.",
        "History panel to summarize experiences in past themes."
      ]
    }
  ],
  "footer": "Thank you for playing Whispers in the Dark!"
};

export default infoDisplayContent;
