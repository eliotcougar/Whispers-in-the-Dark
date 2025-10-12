import { useMemo } from 'react';
import type {
  FullGameState,
  ItemChapter,
  LoremasterModeDebugInfo,
} from '../../types';

interface UseGameJournalDomainParams {
  readonly fullState: FullGameState;
  readonly addJournalEntry: (id: string, chapter: ItemChapter) => void;
  readonly addPlayerJournalEntry: (
    chapter: ItemChapter,
    debugInfo?: LoremasterModeDebugInfo | null,
  ) => void;
  readonly updatePlayerJournalContent: (actual: string, chapterIndex?: number) => void;
  readonly recordPlayerJournalInspect: () => FullGameState;
  readonly handleDistillFacts: () => Promise<void>;
}

interface JournalHandlers {
  readonly addEntryToItem: UseGameJournalDomainParams['addJournalEntry'];
  readonly addPlayerEntry: UseGameJournalDomainParams['addPlayerJournalEntry'];
  readonly updatePlayerEntryContent: UseGameJournalDomainParams['updatePlayerJournalContent'];
  readonly recordInspect: UseGameJournalDomainParams['recordPlayerJournalInspect'];
  readonly distillLore: UseGameJournalDomainParams['handleDistillFacts'];
}

export interface GameJournalDomain {
  readonly playerJournal: Array<ItemChapter>;
  readonly lastWriteTurn: number;
  readonly lastInspectTurn: number;
  readonly lastLoreDistillTurn: number;
  readonly handlers: JournalHandlers;
}

export const useGameJournalDomain = ({
  fullState,
  addJournalEntry,
  addPlayerJournalEntry,
  updatePlayerJournalContent,
  recordPlayerJournalInspect,
  handleDistillFacts,
}: UseGameJournalDomainParams): GameJournalDomain => {
  const playerJournal = useMemo(
    () => fullState.playerJournal,
    [fullState.playerJournal],
  );

  return {
    playerJournal,
    lastWriteTurn: fullState.lastJournalWriteTurn,
    lastInspectTurn: fullState.lastJournalInspectTurn,
    lastLoreDistillTurn: fullState.lastLoreDistillTurn,
    handlers: {
      addEntryToItem: addJournalEntry,
      addPlayerEntry: addPlayerJournalEntry,
      updatePlayerEntryContent: updatePlayerJournalContent,
      recordInspect: recordPlayerJournalInspect,
      distillLore: handleDistillFacts,
    },
  };
};

