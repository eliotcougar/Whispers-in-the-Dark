import TextBox from './TextBox';

function GameMechanics() {
  return (
    <TextBox
      contentFontClass="leading-relaxed space-y-3"
      header="Game Mechanics"
    >
      <p>
        <strong>
          Core Gameplay Loop:
        </strong>

        {' '}
        Read the scene description, then choose one of the provided action options, or use any of your items. Your actions determine the story&apos;s progression.
      </p>

      <p>
        <strong>
          Inventory:
        </strong>

        {' '}
        You&apos;ll acquire items throughout your adventure. Items can be gained, lost, or used. Some items have specific &quot;Known Uses&quot; that unlock as you interact with them or the environment. You can &quot;Inspect&quot; items for more details or &quot;Attempt to Use&quot; them in a generic way if no specific use is known or applicable. Item types include single-use, multi-use, equipment, containers, keys, weapons, ammunition, vehicles, knowledge, and status effects.
      </p>

      <p>
        <strong>
          Quests & Objectives:
        </strong>

        {' '}
        Each theme typically has an &quot;Overarching Quest&quot; (a long-term goal) and a &quot;Current Objective&quot; (a short-term task). Completing objectives grants Score points and advances the story. The win/lose conditions are not implemented yet, and completing the main quest does not do much.
      </p>

      <p>
        <strong>
          Local Context:
        </strong>

        {' '}
        The game tracks &quot;Local Time,&quot; &quot;Local Environment,&quot; and &quot;Local Place.&quot; These details are influenced by your actions and the AI&apos;s narrative, providing a more immersive experience. The AI uses this context to generate scenes and the Image Visualizer uses it to create more accurate pictures.
      </p>

      <p>
        <strong>
          Score & Custom Actions:
        </strong>

        {' '}
        You earn Score points primarily by completing objectives. These points can be spent to perform &quot;Custom Actions&quot; by typing your desired action into the input field. Custom actions cost points and have a character limit.
      </p>

      <p>
        <strong>
          Reality Shifts:
        </strong>

        {' '}
        The game world is unstable. In a standard game, reality shifts can occur randomly based on settings, or you can trigger them manually. Each shift brings a new theme.
      </p>

      <p>
        <strong>
          Custom Game Mode:
        </strong>

        {' '}
        From the main menu, you can select &quot;Custom Game&quot; to choose a specific theme to start in. In this mode, random reality shifts are disabled, allowing for a more focused single-theme experience. Manual shifts are still possible if you wish to change themes.
      </p>
    </TextBox>
  );
}

export default GameMechanics;
