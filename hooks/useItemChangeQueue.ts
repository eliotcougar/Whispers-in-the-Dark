/**
 * @file useItemChangeQueue.ts
 * @description Manages the queue and timing of item change animations.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as React from 'react';
import { Item, TurnChanges, KnownUse } from '../types';

export type AnimationType = 'acquire' | 'loss' | 'change';
export interface AnimationQueueItem {
  type: AnimationType;
  item?: Item;
  oldItem?: Item;
  newItem?: Item;
}

export type AnimationStep = 'idle' | 'appearing' | 'visible' | 'disappearing';
export type ActiveGlowType = 'acquire' | 'loss' | 'change-new' | null;

export interface DisplayableItems {
  item?: Item;
  oldItem?: Item;
  newItem?: Item;
}

export interface UseItemChangeQueueProps {
  readonly lastTurnChanges: TurnChanges | null;
  readonly isGameBusy: boolean;
  readonly currentTurnNumber: number;
}

const ANIMATION_TRANSITION_DURATION_MS = 600;
const HOLD_DURATION_MS = 2000;
const SKIP_ANIMATION_KEYS = new Set(['Enter', ' ']);

const areKnownUsesEffectivelyIdentical = (
  ku1Array?: Array<KnownUse>,
  ku2Array?: Array<KnownUse>
): boolean => {
  const kus1 = ku1Array ?? [];
  const kus2 = ku2Array ?? [];
  if (kus1.length !== kus2.length) return false;
  if (kus1.length === 0) return true;

  const stringifyKnownUse = (ku: KnownUse) => {
    const orderedKu: Record<keyof KnownUse, KnownUse[keyof KnownUse]> = {} as Record<keyof KnownUse, KnownUse[keyof KnownUse]>;
    (Object.keys(ku) as Array<keyof KnownUse>).sort().forEach(key => {
      orderedKu[key] = ku[key];
    });
    return JSON.stringify(orderedKu);
  };

  const sortedKu1Strings = kus1.map(stringifyKnownUse).sort();
  const sortedKu2Strings = kus2.map(stringifyKnownUse).sort();

  for (let i = 0; i < sortedKu1Strings.length; i++) {
    if (sortedKu1Strings[i] !== sortedKu2Strings[i]) return false;
  }
  return true;
};

const areItemsEffectivelyIdentical = (
  item1?: Item,
  item2?: Item
): boolean => {
  if (!item1 || !item2) return item1 === item2;
  if (
    item1.name !== item2.name ||
    item1.type !== item2.type ||
    item1.description !== item2.description ||
    item1.holderId !== item2.holderId ||
    (item1.activeDescription ?? '') !== (item2.activeDescription ?? '') ||
    (item1.isActive ?? false) !== (item2.isActive ?? false) ||
    JSON.stringify(item1.tags ?? []) !== JSON.stringify(item2.tags ?? [])
  ) {
    return false;
  }
  return areKnownUsesEffectivelyIdentical(item1.knownUses, item2.knownUses);
};

export const useItemChangeQueue = ({ lastTurnChanges, isGameBusy, currentTurnNumber }: UseItemChangeQueueProps) => {
  const [animationQueue, setAnimationQueue] = useState<Array<AnimationQueueItem>>([]);
  const [currentAnimatingItem, setCurrentAnimatingItem] = useState<AnimationQueueItem | null>(null);
  const [animationStep, setAnimationStep] = useState<AnimationStep>('idle');
  const [itemForCardDisplay, setItemForCardDisplay] = useState<DisplayableItems | null>(null);

  const [isCardVisibleClass, setIsCardVisibleClass] = useState(false);
  const [explicitDisappearClass, setExplicitDisappearClass] = useState<'disappear-to-small' | 'disappear-to-large' | null>(null);
  const [activeGlowType, setActiveGlowType] = useState<ActiveGlowType>(null);

  const [isVisibleOverlay, setIsVisibleOverlay] = useState(false);

  const [animatedTurnChangesRef, setAnimatedTurnChangesRef] = useState<TurnChanges | null>(null);
  const [currentProcessingChanges, setCurrentProcessingChanges] = useState<TurnChanges | null>(null);
  const activeTimeoutRef = useRef<number | null>(null);
  const deferredTurnChangesRef = useRef<{ changes: TurnChanges; turn: number } | null>(null);
  const lastAnimatedTurnRef = useRef<number | null>(null);
  // Note: we intentionally avoid hashing/"signatures" of changes now.
  // We rely on reference + queue boundaries to avoid duplicates.

  const clearActiveTimeout = useCallback(() => {
    if (activeTimeoutRef.current) {
      clearTimeout(activeTimeoutRef.current);
      activeTimeoutRef.current = null;
    }
  }, []);

  const resetAnimationState = useCallback(() => {
    clearActiveTimeout();
    setAnimationQueue([]);
    setCurrentAnimatingItem(null);
    setAnimationStep('idle');
    setIsVisibleOverlay(false);
    setIsCardVisibleClass(false);
    setExplicitDisappearClass(null);
    setActiveGlowType(null);
    setItemForCardDisplay(null);
  }, [clearActiveTimeout]);

  useEffect(() => {
    if (isGameBusy) {
      // While busy, remember the latest unanimated changes so we can animate after unpause (for this turn only).
      if (lastTurnChanges && lastTurnChanges !== animatedTurnChangesRef) {
        deferredTurnChangesRef.current = { changes: lastTurnChanges, turn: currentTurnNumber };
      }
      // Clear any in-flight animation state so we can replay once unpaused.
      if (currentProcessingChanges) {
        setCurrentProcessingChanges(null);
      }
      resetAnimationState();
    }
  }, [
    isGameBusy,
    resetAnimationState,
    currentProcessingChanges,
    lastTurnChanges,
    animatedTurnChangesRef,
    currentTurnNumber,
  ]);

  // On turn advance: if no item changes this turn, explicitly mark as processed
  // and clear any deferred changes from a previous turn to avoid replays.
  useEffect(() => {
    if (!isGameBusy && lastTurnChanges && lastTurnChanges.itemChanges.length === 0) {
      // New turn with no animations: clear leftovers and mark this turn as handled
      deferredTurnChangesRef.current = null;
      setAnimationQueue([]);
      setCurrentProcessingChanges(null);
      setIsVisibleOverlay(false);
      setAnimatedTurnChangesRef(lastTurnChanges);
      lastAnimatedTurnRef.current = currentTurnNumber;
    }
  }, [currentTurnNumber, isGameBusy, lastTurnChanges]);

  useEffect(() => {
    if (isGameBusy) {
      if (animationQueue.length > 0) setAnimationQueue([]);
      return;
    }
    // Prefer deferred only if it belongs to the current turn; otherwise drop it
    let candidate: TurnChanges | null = null;
    if (deferredTurnChangesRef.current) {
      if (deferredTurnChangesRef.current.turn === currentTurnNumber) {
        candidate = deferredTurnChangesRef.current.changes;
      } else {
        // Stale deferred from previous turn; drop it
        deferredTurnChangesRef.current = null;
      }
    }
    candidate = candidate ?? lastTurnChanges;
    if (!candidate) return;
    // If we've already animated for this turn, ignore busy/idle cycles until turn advances
    if (lastAnimatedTurnRef.current !== null && currentTurnNumber === lastAnimatedTurnRef.current) {
      deferredTurnChangesRef.current = null;
      return;
    }
    if (candidate === animatedTurnChangesRef || candidate === currentProcessingChanges) return;
    if (currentProcessingChanges && currentAnimatingItem) return;

    setCurrentProcessingChanges(candidate);
    // Mark this turn's changes as being processed/animated immediately to prevent replays
    setAnimatedTurnChangesRef(candidate);
    lastAnimatedTurnRef.current = currentTurnNumber;

    const newAnimationQueue: Array<AnimationQueueItem> = [];
    for (const change of candidate.itemChanges) {
      if (change.type === 'acquire' && change.acquiredItem) {
        newAnimationQueue.push({ type: 'acquire', item: change.acquiredItem });
      } else if (change.type === 'loss' && change.lostItem) {
        newAnimationQueue.push({ type: 'loss', item: change.lostItem });
      } else if (change.type === 'update' && change.oldItem && change.newItem) {
        if (!areItemsEffectivelyIdentical(change.oldItem, change.newItem)) {
          newAnimationQueue.push({ type: 'change', oldItem: change.oldItem, newItem: change.newItem });
        }
      }
    }
    newAnimationQueue.sort((a, b) => {
      const priority = { loss: 0, acquire: 1, change: 2 } as const;
      return priority[a.type] - priority[b.type];
    });

    if (newAnimationQueue.length > 0) {
      setAnimationQueue(newAnimationQueue);
    } else {
      setAnimationQueue([]);
      setAnimatedTurnChangesRef(candidate);
      setCurrentProcessingChanges(null);
      setIsVisibleOverlay(false);
      if (deferredTurnChangesRef.current && deferredTurnChangesRef.current.changes === candidate) {
        deferredTurnChangesRef.current = null;
      }
    }
  }, [lastTurnChanges, isGameBusy, animatedTurnChangesRef, currentProcessingChanges, currentAnimatingItem, animationQueue, currentTurnNumber]);

  const processNextAnimation = useCallback(() => {
    clearActiveTimeout();
    if (animationQueue.length > 0 && !isGameBusy) {
      const nextItem = animationQueue[0];
      setCurrentAnimatingItem(nextItem);
      setAnimationQueue(prev => prev.slice(1));
      setIsVisibleOverlay(true);

      if (nextItem.type === 'change' && nextItem.oldItem && nextItem.newItem) {
        setItemForCardDisplay({ oldItem: nextItem.oldItem, newItem: nextItem.newItem });
      } else if (nextItem.item) {
        setItemForCardDisplay({ item: nextItem.item });
      } else {
        setItemForCardDisplay(null);
      }
      setAnimationStep('appearing');
    } else {
      setCurrentAnimatingItem(null);
      setAnimationStep('idle');
      setItemForCardDisplay(null);
    }
  }, [animationQueue, isGameBusy, clearActiveTimeout]);

  useEffect(() => {
    if (animationStep === 'idle' && !currentAnimatingItem && !isGameBusy) {
      if (animationQueue.length > 0) {
        processNextAnimation();
      } else {
        setIsVisibleOverlay(false);
        if (currentProcessingChanges && currentProcessingChanges !== animatedTurnChangesRef) {
          setAnimatedTurnChangesRef(currentProcessingChanges);
        }
        setCurrentProcessingChanges(null);
        if (deferredTurnChangesRef.current && deferredTurnChangesRef.current.changes === currentProcessingChanges) {
          deferredTurnChangesRef.current = null;
        }
      }
    }
  }, [animationStep, animationQueue, currentAnimatingItem, processNextAnimation, isGameBusy, currentProcessingChanges, animatedTurnChangesRef]);

  useEffect(() => {
    if (isGameBusy || !currentAnimatingItem || animationStep === 'idle') {
      return;
    }
    clearActiveTimeout();

    switch (animationStep) {
      case 'appearing': {
        setExplicitDisappearClass(null);
        setActiveGlowType(null);
        setIsCardVisibleClass(true);
        const item = currentAnimatingItem;
        activeTimeoutRef.current = window.setTimeout(() => {
          if (currentAnimatingItem === item) {
            setAnimationStep('visible');
          }
        }, ANIMATION_TRANSITION_DURATION_MS);
        break;
      }

      case 'visible': {
        if (currentAnimatingItem.type === 'acquire') setActiveGlowType('acquire');
        else if (currentAnimatingItem.type === 'loss') setActiveGlowType('loss');
        else setActiveGlowType('change-new');

        const itemAfterVisible = currentAnimatingItem;
        activeTimeoutRef.current = window.setTimeout(() => {
          if (currentAnimatingItem === itemAfterVisible) {
            setAnimationStep('disappearing');
          }
        }, HOLD_DURATION_MS);
        break;
      }

      case 'disappearing':
        setActiveGlowType(null);
        if (currentAnimatingItem.type === 'loss') {
          setExplicitDisappearClass('disappear-to-large');
        } else {
          setExplicitDisappearClass('disappear-to-small');
        }
        setIsCardVisibleClass(false);

        activeTimeoutRef.current = window.setTimeout(() => {
          setCurrentAnimatingItem(null);
          setAnimationStep('idle');
          setExplicitDisappearClass(null);
        }, ANIMATION_TRANSITION_DURATION_MS);
        break;
    }
    return () => { clearActiveTimeout(); };
  }, [currentAnimatingItem, animationStep, isGameBusy, clearActiveTimeout]);

  const handleSkipAnimations = useCallback(() => {
    if (isGameBusy) return;
    resetAnimationState();
    if (currentProcessingChanges) {
      setAnimatedTurnChangesRef(currentProcessingChanges);
      setCurrentProcessingChanges(null);
      lastAnimatedTurnRef.current = currentTurnNumber;
    } else if (lastTurnChanges && lastTurnChanges !== animatedTurnChangesRef) {
      setAnimatedTurnChangesRef(lastTurnChanges);
      lastAnimatedTurnRef.current = currentTurnNumber;
    }
  }, [isGameBusy, resetAnimationState, lastTurnChanges, animatedTurnChangesRef, currentProcessingChanges, currentTurnNumber]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (SKIP_ANIMATION_KEYS.has(event.key)) {
        handleSkipAnimations();
      }
    },
    [handleSkipAnimations]
  );

  return {
    itemForCardDisplay,
    currentAnimatingItem,
    isVisibleOverlay,
    isCardVisibleClass,
    explicitDisappearClass,
    activeGlowType,
    handleSkipAnimations,
    handleKeyDown,
  } as const;
};

