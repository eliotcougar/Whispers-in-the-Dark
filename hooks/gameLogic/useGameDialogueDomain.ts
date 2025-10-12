import type { DialogueData } from '../../types';

interface UseGameDialogueDomainParams {
  readonly dialogueState: DialogueData | null;
  readonly isDialogueExiting: boolean;
  readonly handleDialogueOptionSelect: (option: string) => Promise<void>;
  readonly handleForceExitDialogue: () => void;
}

export interface GameDialogueDomain {
  readonly state: DialogueData | null;
  readonly isExiting: boolean;
  readonly handlers: {
    readonly selectOption: UseGameDialogueDomainParams['handleDialogueOptionSelect'];
    readonly forceExit: UseGameDialogueDomainParams['handleForceExitDialogue'];
  };
}

export const useGameDialogueDomain = ({
  dialogueState,
  isDialogueExiting,
  handleDialogueOptionSelect,
  handleForceExitDialogue,
}: UseGameDialogueDomainParams): GameDialogueDomain => ({
  state: dialogueState,
  isExiting: isDialogueExiting,
  handlers: {
    selectOption: handleDialogueOptionSelect,
    forceExit: handleForceExitDialogue,
  },
});
