import TextBox from './TextBox';
import ChangelogVersion from './ChangelogVersion';

const version131 = [
  'Fixed some bugs here and there.',
  'The toolbar is now usable on small mobile screens again.',
  'Fixed the tooltips alignment when they are close to the edges of the map.',
  'Fall back to Gemini 2.0 Image Generation Preview for players without paid account outside of AI Studio or when the quota is exceeded.',
  'Fixed Inventory AI being unable to place items on the map because it was unaware of any map nodes.',
  'Added pseudo-thinking to the Inventory AI model. Should help with disappearing items and other weirdness.',
] as const;

const version13 = [
  'Biggest feature - Map.',
  'Known Places moved from Knowledge Base to the new Map.',
  'Game Log moved to the History screen where Past Realities are.',
  'Characters now remember past conversations with the player.',
  'Added "Custom Game" option to the Main Menu: You can now choose a specific theme to start in, and random reality shifts will be disabled for that playthrough.',
  'Manual shifts in Custom Game give you full control over your destination.',
  'Removed error-triggered reality shifts entirely.',
  'Retry button now really performs a retry.',
  'A lot more heuristics to deal with slightly malformed AI responses.',
  'The number of main options increased to 6 to accomodate the additional variety of actions related to moving around.',
  'Cartographer AI now uses a pseudo-thinking hack to improve the output.',
] as const;

const version122 = [
  'Substantial refactoring of the core logic and removal of duplicate code. GenAI creates a lot of duplicate code.',
  'Rewritten all the AI prompts to improve the robustness of the output.',
  'Some auxiliary prompts now use a faster "Gemini 2.0-Flash" model. Storyteller still uses "Gemini 2.5-flash".',
  'Increased temperature of AI storyteller slightly to make it more creative.',
  'The initial scenarios can now vary a little from game to game.',
  'You are guaranteed to get theme-relevant items at the start of a new game.',
  'Fixed some UI elements not updating with the game state.',
  'Added an animated overlay for gaining, losing, and changing items. You can cancel it by clicking if too many items transform after shift. (it took me way too long to debug, the AI couldn\'t find the source of the visual bugs)',
  'Implemented more triage procedures for malformed AI output when it tried to trigger an action with nonexistent item/place/character.',
  'Operations with items are now more reliable, primarily as the rusult of the previous fix.',
  "Items now track their specific functions better and don't inexplicably lose them as often.",
  'Items now recieve their whenActive/whenInactive actions more reliably. Torches, flashlights, powered equipment, wielded weapons, worn clothing/armor.',
  'The number of uses for limited-use items like food, water, ammo, etc. can go up and down.',
  'Items should no longer get a duplicate "Inspect" function too often.',
  'The majority of anachronistic items now transform right after shift, while the reality is still unstable.',
  'Reality shifts can no longer happen when exiting from Dialogue Mode and no longer lead to lost outcome.',
  'When returning to a previously visited reality, you have a good chance to restore your important quest items via anachronistic transformation.',
  'Cosmetic changes to the Dialogue Mode.',
  'Save File version conversion is now possible.',
] as const;

const version121 = [
  'Fixed many bugs related to conversations and their effects.',
  'Fixed a bug where Companions and Nearby NPCs were not cleared when starting new game.',
  'Made Conversations UI easier to use on mobile.',
  'Turns since last Shift is now saved correctly.',
  'Added a Debug View for myself to see the game state and AI requests and responses.',
] as const;

const version12 = [
  'Implemented tracking of Companions and nearby NPCs in the scene context for better cohesion.',
  'Biggest feature - Conversations with characters.',
  'Moved New Game, Save Game, Load Game, and Settings to the Main Menu.',
  'Moved History to a dedicated screen next to Knowledge Base.',
  'Inventory Items can now be arranged in multiple columns on bigger screens.',
  'Basic Inventory sorting.',
  "Fixed the ability to exit and enter vehicles. (Try exiting an airship while it's flying)",
  'Some code refactoring and simplification behind the scenes.',
  "Less obtrusive attention to player's character gender in scene descriptions. Hopefully...",
  'Less frequent garbled text in the Visualizer images.',
] as const;

const version11 = [
  'Enhanced item types and descriptions in AI prompt for better item management.',
  'Refined save/load system with more robust handling of older save files, including inferring missing data where possible.',
  'Improved AI payload validation and new correction services to attempt to fix malformed AI responses (e.g., for items, local place).',
  'Added "Score" system: gain points for objectives, spend points on "Custom Actions".',
  'Introduced "Custom Action" input field for more player agency.',
  'Added confirmation dialogs for "Restart Game" and "Force Reality Shift" actions.',
  'Initial screen now offers "Start a New Adventure" or "Load a Save File" before gameplay begins.',
  'Simplified History display to show only theme name and summary for a cleaner look.',
  'Standardized font sizes across various UI boxes (Quest, Objective, Last Action, Options) for consistency.',
  'Added Knowledge Base where you can see all the Places and Characters encountered.',
  'Added Visualizer that uses Imagen 3 to show the current scene.',
  'Integrated "Local Time" and "Local Environment" as dynamic context for the AI, influencing scene generation and displayed in the UI.',
  'Incorporated "Local Time" and "Local Environment" into the Image Visualizer prompt for more contextually accurate images.',
  'Loading spinner is now non-obstructive; main UI elements remain visible during AI generation.',
  'Fixed a bug where reality shift disorientation actions were incorrectly disabled.',
  'Inventory display updated: newly acquired items appear at the top and feature a brief animation.',
  'Centralized the definition of `VALID_ITEM_TYPES` for consistency across the application and AI prompts.',
  'Refactored components responsible for main game state and AI response fixes.',
  'Added "Local Place" tracking: AI now manages and updates the player\'s specific location within a scene. This is displayed in the UI, used as AI context, influences image generation, and includes correction logic for older save files.',
  'Added the ability to discard Junk items. The AI storyteller decides which items may be treated as junk at every moment.',
  'Added the ability to choose a set of Theme-packs in the settings to limit the genres of the adventure.',
  "Added Player's Character gender to Settings that can slightly affect the story.",
  'Settings are now accessible from the Title screen (when no saved game exist).',
  'The additional tracking of time and space greatly improved the cohesion of the storytelling.',
  'Added this "Info" panel for game guidance and changelog.',
] as const;

const version10 = [
  'Core gameplay loop: scene descriptions, action options, and AI-driven responses.',
  'Basic inventory system: gain, lose, and use items.',
  'Initial quest and objective system to guide players.',
  'Multiple adventure themes with random reality shifts between them.',
  'Game log to track player actions and key events.',
  "Autosave functionality to browser's local storage.",
  'Manual save and load game to/from a file.',
  'History panel to summarize experiences in past themes.',
] as const;

function Changelog() {
  return (
    <TextBox
      contentFontClass="leading-relaxed space-y-4"
      header="Changelog"
    >
      <ChangelogVersion
        items={version131}
        title="Version 1.3.1 (bugfix)"
      />

      <ChangelogVersion
        items={version13}
        title="Version 1.3 (Spatio-Temporal Update)"
      />

      <ChangelogVersion
        items={version122}
        title="Version 1.2.2 (bugfix)"
      />

      <ChangelogVersion
        items={version121}
        title="Version 1.2.1 (bugfix)"
      />

      <ChangelogVersion
        items={version12}
        title="Version 1.2 (Companions update)"
      />

      <ChangelogVersion
        items={version11}
        title="Version 1.1"
      />

      <ChangelogVersion
        items={version10}
        title="Version 1.0 (Initial Release Features)"
      />
    </TextBox>
  );
}

export default Changelog;
