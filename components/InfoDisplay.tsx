
/**
 * @file InfoDisplay.tsx
 * @description Modal summarizing version and build info.
 */
import React from 'react';
import { CURRENT_SAVE_GAME_VERSION, GEMINI_MODEL_NAME } from '../constants'; // For displaying versions

interface InfoDisplayProps {
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Shows build and version information in a modal window.
 */
const InfoDisplay: React.FC<InfoDisplayProps> = ({ isVisible, onClose }) => {
  const textModel = GEMINI_MODEL_NAME; // from constants.ts
  const imageModel = "imagen-3.0-generate-002"; // from ImageVisualizer.tsx

  return (
    <div className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="info-title">
      <div className="animated-frame-content">
        <button
          onClick={onClose}
          className="animated-frame-close-button"
          aria-label="Close game information"
        >
          &times;
        </button>
        <div className="info-content-area">
          <h1 id="info-title" className="text-3xl font-bold text-sky-300 mb-6 text-center">
            About Whispers in the Dark
          </h1>

          <section className="mb-6">
            <h2 className="text-2xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-700">
              About &quot;Whispers in the Dark&quot;
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Welcome to &quot;Whispers in the Dark,&quot; an AI-powered text adventure game where you navigate a constantly shifting reality.
              Your choices directly shape your fate as you uncover secrets, manage your inventory, and survive the challenges 
              presented by an enigmatic Dungeon Master, powered by Google&apos;s Gemini AI. Each reality shift brings a new theme,
              new quests, and new dangers. You can also choose to start a &quot;Custom Game&quot; in a specific theme with random reality shifts disabled.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-2xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-700">
              Game Mechanics
            </h2>
            <div className="space-y-3 text-slate-300 leading-relaxed">
              <p><strong>Core Gameplay Loop:</strong> Read the scene description, then choose one of the provided action options, or use any of your items. Your actions determine the story&apos;s progression.</p>
              <p><strong>Inventory:</strong> You&apos;ll acquire items throughout your adventure. Items can be gained, lost, or used. Some items have specific &quot;Known Uses&quot; that unlock as you interact with them or the environment. You can &quot;Inspect&quot; items for more details or &quot;Attempt to Use&quot; them in a generic way if no specific use is known or applicable. Item types include single-use, multi-use, equipment, containers, keys, weapons, ammunition, vehicles, knowledge, and status effects.</p>
              <p><strong>Quests & Objectives:</strong> Each theme typically has an &quot;Overarching Quest&quot; (a long-term goal) and a &quot;Current Objective&quot; (a short-term task). Completing objectives grants Score points and advances the story. The win/lose conditions are not implemented yet, and completing the main quest does not do much.</p>
              <p><strong>Local Context:</strong> The game tracks &quot;Local Time,&quot; &quot;Local Environment,&quot; and &quot;Local Place.&quot; These details are influenced by your actions and the AI&apos;s narrative, providing a more immersive experience. The AI uses this context to generate scenes and the Image Visualizer uses it to create more accurate pictures.</p>
              <p><strong>Score & Custom Actions:</strong> You earn Score points primarily by completing objectives. These points can be spent to perform &quot;Custom Actions&quot; by typing your desired action into the input field. Custom actions cost points and have a character limit.</p>
              <p><strong>Reality Shifts:</strong> The game world is unstable. 
                In a standard game, reality shifts can occur randomly based on settings, or you can trigger them manually. Each shift brings a new theme.
              </p>
              <p><strong>Custom Game Mode:</strong> From the main menu, you can select &quot;Custom Game&quot; to choose a specific theme to start in. In this mode, random reality shifts are disabled, allowing for a more focused single-theme experience. Manual shifts are still possible if you wish to change themes.</p>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-2xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-700">
              Notable Features
            </h2>
            <div className="space-y-3 text-slate-300 leading-relaxed">
              <p><strong>Image Visualizer:</strong> Click the &quot;eye&quot; icon to generate an AI-powered image representing the current scene. It uses Imagen 3, and the daily quota is not very big. Use sporadingly.</p>
              <p><strong>Knowledge Base:</strong> Click the &quot;book&quot; icon to view details about all Places and Characters you&apos;ve discovered across different themes.</p>
              <p><strong>Echoes of Past Realities:</strong> This panel (part of the main game screen) shows a summary of themes you&apos;ve previously experienced, helping you remember past adventures.</p>
              <p><strong>Map Display:</strong> Use the map icon to view a dynamic graph of locations within the current theme, showing connections and your current position.</p>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-2xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-700">
              Save Game Functionality & Game Updates
            </h2>
            <div className="space-y-3 text-slate-300 leading-relaxed">
              <p><strong>Autosave:</strong> The game automatically saves your progress to your browser&apos;s local storage periodically. However, this save can be lost if the current version of the game you play is updated. Please, do a manual save to a file before closing the game.</p>
              <p><strong>Manual Save/Load:</strong> You can manually save your game to a file (`.json`) and load it later using the dedicated toolbar buttons. This is useful for backups or transferring saves between devices.</p>
              <p><strong>Game Updates & Save Compatibility:</strong> &quot;Whispers in the Dark&quot; is an evolving game. While we strive for backward compatibility with save files, significant updates that change the game&apos;s data structure might affect older saves.
                 The game tracks a `saveGameVersion` (currently: {CURRENT_SAVE_GAME_VERSION}). If you load a save from an older version, the game will attempt to adapt it. For example, if a new field like &quot;Local Place&quot; is added, the game might infer its value or use a default for older saves. However, very old or structurally incompatible saves might not load correctly or could lead to unexpected behavior. It&apos;s always a good idea to manually save your game before major updates if you wish to preserve a specific state.
              </p>
            </div>
          </section>
          
          <section className="mb-6">
            <h2 className="text-2xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-700">
              AI Models & Disclaimers
            </h2>
            <div className="space-y-3 text-slate-300 leading-relaxed">
              <p>This game is powered by Google&apos;s Gemini large language models:</p>
              <ul className="list-disc list-inside ml-4">
                <li>Text Generation: <strong>{textModel}</strong></li>
                <li>Image Generation: <strong>{imageModel}</strong></li>
              </ul>
              <p><strong>AI Unpredictability:</strong> As with any generative AI, the responses can sometimes be unpredictable, creative in unexpected ways, or may not perfectly adhere to all instructions or context. This is part of the charm and challenge of an AI-driven adventure!</p>
              <p><strong>API Quotas:</strong> The use of these AI models is subject to API call limits and quotas. If you (or the environment this app is running in) exceed these daily quotas, the game&apos;s AI features (text generation, image visualization) may temporarily stop working until the quota resets.</p>
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-2xl font-semibold text-amber-400 mb-3 pb-1 border-b border-amber-700">
              Changelog
            </h2>
            <div className="space-y-4 text-slate-300 leading-relaxed">
              <div>
                <h3 className="text-xl font-medium text-sky-400 mb-2">Version 1.3 (Spatio-Temporal Update)</h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Biggest feature - Map.</li>
                  <li>Known Places moved from Knowledge Base to the new Map.</li>
                  <li>Characters now remember past conversations with the player.</li>
                  <li>Added &quot;Custom Game&quot; option to the Main Menu: You can now choose a specific theme to start in, and random reality shifts will be disabled for that playthrough.</li>
                  <li>Manual shifts in Custom Game give you full control over your destination.</li>
                  <li>Removed error-triggered reality shifts entirely.</li>
                  <li></li>
                </ul>
                <h3 className="text-xl font-medium text-sky-400 mb-2">Version 1.2.2 (bugfix)</h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Substantial refactoring of the core logic and removal of duplicate code. GenAI creates a lot of duplicate code.</li>
                  <li>Rewritten all the AI prompts to improve the robustness of the output.</li>
                  <li>Some auxiliary prompts now use a faster &quot;Gemini 2.0-Flash&quot; model. Storyteller still uses &quot;Gemini 2.5-flash&quot;.</li>
                  <li>Increased temperature of AI storyteller slightly to make it more creative.</li>
                  <li>The initial scenarios can now vary a little from game to game.</li>
                  <li>You are guaranteed to get theme-relevant items at the start of a new game.</li>
                  <li>Fixed some UI elements not updating with the game state.</li>
                  <li>Added an animated overlay for gaining, losing, and changing items. You can cancel it by clicking if too many items transform after shift. (it took me way too long to debug, the AI couldn&apos;t find the source of the visual bugs)</li>
                  <li>Implemented more triage procedures for malformed AI output when it tried to trigger an action with nonexistent item/place/character.</li>
                  <li>Operations with items are now more reliable, primarily as the rusult of the previous fix.</li>
                  <li>Items now track their specific functions better and don&apos;t inexplicably lose them as often.</li>
                  <li>Items now recieve their whenActive/whenInactive actions more reliably. Torches, flashlights, powered equipment, wielded weapons, worn clothing/armor.</li>
                  <li>The number of uses for limited-use items like food, water, ammo, etc. can go up and down.</li>
                  <li>Items should no longer get a duplicate &quot;Inspect&quot; function too often.</li>
                  <li>The majority of anachronistic items now transform right after shift, while the reality is still unstable.</li>
                  <li>Reality shifts can no longer happen when exiting from Dialogue Mode and no longer lead to lost outcome.</li>
                  <li>When returning to a previously visited reality, you have a good chance to restore your important quest items via anachronistic transformation.</li>
                  <li>Cosmetic changes to the Dialogue Mode.</li>
                  <li>Save File version conversion is now possible.</li>
                </ul>
                <h3 className="text-xl font-medium text-sky-400 mb-2">Version 1.2.1 (bugfix)</h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Fixed many bugs related to conversations and their effects.</li>
                  <li>Fixed a bug where Companions and Nearby NPCs were not cleared when starting new game.</li>
                  <li>Made Conversations UI easier to use on mobile.</li>
                  <li>Turns since last Shift is now saved correctly.</li>
                  <li>Added a Debug View for myself to see the game state and AI requests and responses.</li>
                </ul>
                <h3 className="text-xl font-medium text-sky-400 mb-2">Version 1.2 (Companions update)</h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Implemented tracking of Companions and nearby NPCs in the scene context for better cohesion.</li>
                  <li>Biggest feature - Conversations with characters.</li>
                  <li>Moved New Game, Save Game, Load Game, and Settings to the Main Menu.</li>
                  <li>Moved Echoes of Past Realities to a dedicated screen next to Knowledge Base.</li>
                  <li>Inventory Items can now be arranged in multiple columns on bigger screens.</li>
                  <li>Basic Inventory sorting.</li>
                  <li>Fixed the ability to exit and enter vehicles. (Try exiting an airship while it&apos;s flying)</li>
                  <li>Some code refactoring and simplification behind the scenes.</li>
                  <li>Less obtrusive attention to player&apos;s character gender in scene descriptions. Hopefully...</li>
                  <li>Less frequent garbled text in the Visualizer images.</li>
                </ul>
                <h3 className="text-xl font-medium text-sky-400 mb-2">Version 1.1</h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Enhanced item types and descriptions in AI prompt for better item management.</li>
                  <li>Refined save/load system with more robust handling of older save files, including inferring missing data where possible.</li>
                  <li>Improved AI payload validation and new correction services to attempt to fix malformed AI responses (e.g., for items, local place).</li>
                  <li>Added &quot;Score&quot; system: gain points for objectives, spend points on &quot;Custom Actions&quot;.</li>
                  <li>Introduced &quot;Custom Action&quot; input field for more player agency.</li>
                  <li>Added confirmation dialogs for &quot;Restart Game&quot; and &quot;Force Reality Shift&quot; actions.</li>
                  <li>Initial screen now offers &quot;Start a New Adventure&quot; or &quot;Load a Save File&quot; before gameplay begins.</li>
                  <li>Simplified &quot;Echoes of Past Realities&quot; display to show only theme name and summary for a cleaner look.</li>
                  <li>Standardized font sizes across various UI boxes (Quest, Objective, Last Action, Options) for consistency.</li>
                  <li>Added Knowledge Base where you can see all the Places and Characters encountered.</li>
                  <li>Added Visualizer that uses Imagen 3 to show the current scene.</li>
                  <li>Integrated &quot;Local Time&quot; and &quot;Local Environment&quot; as dynamic context for the AI, influencing scene generation and displayed in the UI.</li>
                  <li>Incorporated &quot;Local Time&quot; and &quot;Local Environment&quot; into the Image Visualizer prompt for more contextually accurate images.</li>
                  <li>Loading spinner is now non-obstructive; main UI elements remain visible during AI generation.</li>
                  <li>Fixed a bug where reality shift disorientation actions were incorrectly disabled.</li>
                  <li>Inventory display updated: newly acquired items appear at the top and feature a brief animation.</li>
                  <li>Centralized the definition of `VALID_ITEM_TYPES` for consistency across the application and AI prompts.</li>
                  <li>Refactored components responsible for main game state and AI response fixes.</li>
                  <li>Added &quot;Local Place&quot; tracking: AI now manages and updates the player&apos;s specific location within a scene. This is displayed in the UI, used as AI context, influences image generation, and includes correction logic for older save files.</li>
                  <li>Added the ability to discard Junk items. The AI storyteller decides which items may be treated as junk at every moment.</li>
                  <li>Added the ability to choose a set of Theme-packs in the settings to limit the genres of the adventure.</li>
                  <li>Added Player&apos;s Character gender to Settings that can slightly affect the story.</li>
                  <li>Settings are now accessible from the Title screen (when no saved game exist).</li>
                  <li>The additional tracking of time and space greatly improved the cohesion of the storytelling.</li>
                  <li>Added this &quot;Info&quot; panel for game guidance and changelog.</li>
                </ul>
                <h3 className="text-xl font-medium text-sky-400 mb-2">Version 1.0 (Initial Release Features)</h3>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Core gameplay loop: scene descriptions, action options, and AI-driven responses.</li>
                  <li>Basic inventory system: gain, lose, and use items.</li>
                  <li>Initial quest and objective system to guide players.</li>
                  <li>Multiple adventure themes with random reality shifts between them.</li>
                  <li>Game log to track player actions and key events.</li>
                  <li>Autosave functionality to browser&apos;s local storage.</li>
                  <li>Manual save and load game to/from a file.</li>
                  <li>Theme Memory (&quot;Echoes of Past Realities&quot;) to summarize experiences in past themes.</li>
                </ul>
              </div>
            </div>
          </section>

          <p className="text-center text-slate-500 mt-8 text-sm">
            Thank you for playing Whispers in the Dark!
          </p>

        </div>
      </div>
    </div>
  );
};

export default InfoDisplay;
