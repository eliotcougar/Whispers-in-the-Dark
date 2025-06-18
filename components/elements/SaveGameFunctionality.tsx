import TextBox from './TextBox';
import { CURRENT_SAVE_GAME_VERSION } from '../../constants';

function SaveGameFunctionality() {
  return (
    <TextBox
      contentFontClass="leading-relaxed space-y-3"
      header="Save Game Functionality & Game Updates"
    >
      <p>
        <strong>
          Autosave:
        </strong>

        {' '}
        The game automatically saves your progress to your browser&apos;s local storage periodically. However, this save can be lost if the current version of the game you play is updated. Please, do a manual save to a file before closing the game.
      </p>

      <p>
        <strong>
          Manual Save/Load:
        </strong>

        {' '}
        You can manually save your game to a file (`.json`) and load it later using the dedicated toolbar buttons. This is useful for backups or transferring saves between devices.
      </p>

      <p>
        <strong>
          Game Updates & Save Compatibility:
        </strong>

        {' '}
        &quot;Whispers in the Dark&quot; is an evolving game. While we strive for backward compatibility with save files, significant updates that change the game&apos;s data structure might affect older saves.
        The game tracks a `saveGameVersion` (currently: 

        {' '}

        {CURRENT_SAVE_GAME_VERSION}
        ). If you load a save from an older version, the game will attempt to adapt it. For example, if a new field like &quot;Local Place&quot; is added, the game might infer its value or use a default for older saves. However, very old or structurally incompatible saves might not load correctly or could lead to unexpected behavior. It&apos;s always a good idea to manually save your game before major updates if you wish to preserve a specific state.
      </p>
    </TextBox>
  );
}

export default SaveGameFunctionality;
