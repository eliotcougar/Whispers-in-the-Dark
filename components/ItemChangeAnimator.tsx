
/**
 * @file ItemChangeAnimator.tsx
 * @description Animates item gain, loss, and changes.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

import * as React from 'react';
import { Item, TurnChanges, KnownUse } from '../types';
import { ItemTypeDisplay } from './InventoryDisplay';

type AnimationType = 'gain' | 'loss' | 'change';
interface AnimationQueueItem {
  type: AnimationType;
  item?: Item; // For gain/loss
  oldItem?: Item; // For change
  newItem?: Item; // For change
}

type AnimationStep = 'idle' | 'appearing' | 'visible' | 'disappearing';
type ActiveGlowType = 'gain' | 'loss' | 'change-new' | null;

interface DisplayableItems {
  item?: Item;
  oldItem?: Item;
  newItem?: Item;
}

interface ItemChangeAnimatorProps {
  readonly lastTurnChanges: TurnChanges | null;
  readonly isGameBusy: boolean;
}

const ANIMATION_TRANSITION_DURATION_MS = 600;
const HOLD_DURATION_MS = 2000;


/**
 * Determines whether two arrays of KnownUse objects represent the same
 * effective set of uses, ignoring property order.
 */
const areKnownUsesEffectivelyIdentical = (
  ku1Array?: KnownUse[],
  ku2Array?: KnownUse[]
): boolean => {
  const kus1 = ku1Array || [];
  const kus2 = ku2Array || [];
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

/**
 * Checks whether two items are effectively the same to avoid animating
 * trivial updates that do not change visible properties.
 */
const areItemsEffectivelyIdentical = (
  item1?: Item,
  item2?: Item
): boolean => {
  if (!item1 || !item2) return item1 === item2;
  if (item1.name !== item2.name ||
      item1.type !== item2.type ||
      item1.description !== item2.description ||
      (item1.activeDescription || '') !== (item2.activeDescription || '') ||
      (item1.isActive ?? false) !== (item2.isActive ?? false) ||
      (item1.isJunk ?? false) !== (item2.isJunk ?? false)
  ) {
    return false;
  }
  return areKnownUsesEffectivelyIdentical(item1.knownUses, item2.knownUses);
};

/**
 * Animates item gains, losses, and transformations over time.
 */
function ItemChangeAnimator({
  lastTurnChanges,
  isGameBusy,
}: ItemChangeAnimatorProps) {
  const [animationQueue, setAnimationQueue] = useState<AnimationQueueItem[]>([]);
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

  /** Clears any pending animation timeout. */
  const clearActiveTimeout = useCallback(() => {
    if (activeTimeoutRef.current) {
      clearTimeout(activeTimeoutRef.current);
      activeTimeoutRef.current = null;
    }
  }, []);

  /** Resets all animation-related state back to the idle baseline. */
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
      resetAnimationState();
    }
  }, [isGameBusy, resetAnimationState]);

  useEffect(() => {
    if (isGameBusy || !lastTurnChanges) {
      if (!isGameBusy && animationQueue.length > 0) {
        setAnimationQueue([]); // Clear queue if game becomes unbusy but changes didn't update
      }
      return;
    }
    if (lastTurnChanges === animatedTurnChangesRef || lastTurnChanges === currentProcessingChanges) return;
    if (currentProcessingChanges && currentAnimatingItem) return; // Don't process new changes if an animation is ongoing for current changes

    setCurrentProcessingChanges(lastTurnChanges);

    const newAnimationQueue: AnimationQueueItem[] = [];
    for (const change of lastTurnChanges.itemChanges) {
      if (change.type === 'gain' && change.gainedItem) {
        newAnimationQueue.push({ type: 'gain', item: change.gainedItem });
      } else if (change.type === 'loss' && change.lostItem) {
        newAnimationQueue.push({ type: 'loss', item: change.lostItem });
      } else if (change.type === 'update' && change.oldItem && change.newItem) {
        if (!areItemsEffectivelyIdentical(change.oldItem, change.newItem)) {
          newAnimationQueue.push({ type: 'change', oldItem: change.oldItem, newItem: change.newItem });
        }
      }
    }
    newAnimationQueue.sort((a, b) => {
        const priority = { loss: 0, gain: 1, change: 2 };
        return priority[a.type] - priority[b.type];
    });

    if (newAnimationQueue.length > 0) {
        setAnimationQueue(newAnimationQueue);
    } else { // No valid animations to queue from these changes
        setAnimationQueue([]);
        setAnimatedTurnChangesRef(lastTurnChanges); // Mark as processed
        setCurrentProcessingChanges(null);
        setIsVisibleOverlay(false); // Ensure overlay is hidden if no animations
    }
  }, [lastTurnChanges, isGameBusy, animatedTurnChangesRef, currentProcessingChanges, currentAnimatingItem, animationQueue]);

  /**
   * Pops the next queued item change and kicks off its animation sequence.
   */
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
        setItemForCardDisplay(null); // Should not happen if queue is built correctly
      }
      setAnimationStep('appearing');
    } else {
      // No more items in queue or game is busy
      setCurrentAnimatingItem(null);
      setAnimationStep('idle');
      setItemForCardDisplay(null);
      // Overlay visibility and currentProcessingChanges reset will be handled by the 'starter' useEffect
    }
  }, [animationQueue, isGameBusy, clearActiveTimeout]);

  // "Starter" useEffect: Manages queue processing and final cleanup
  useEffect(() => {
    if (animationStep === 'idle' && !currentAnimatingItem && !isGameBusy) {
      if (animationQueue.length > 0) {
        processNextAnimation();
      } else {
        // Queue is empty, and no item is animating
        setIsVisibleOverlay(false);
        if (currentProcessingChanges && currentProcessingChanges !== animatedTurnChangesRef) {
          setAnimatedTurnChangesRef(currentProcessingChanges); // Mark current batch as done
        }
        setCurrentProcessingChanges(null); // Ready for new lastTurnChanges
      }
    }
  }, [animationStep, animationQueue, currentAnimatingItem, processNextAnimation, isGameBusy, currentProcessingChanges, animatedTurnChangesRef]);


  // Main animation step orchestrator
  useEffect(() => {
    if (isGameBusy || !currentAnimatingItem || animationStep === 'idle') {
      return; // Do nothing if game is busy, no item to animate, or animator is idle
    }
    clearActiveTimeout(); // Clear any previous step's timeout

    switch (animationStep) {
      case 'appearing':
        setExplicitDisappearClass(null); // CRITICAL: Reset specific disappear styles for a clean "appear"
        setActiveGlowType(null);
        setIsCardVisibleClass(true); // Add .visible class, triggers transition from base (scale 0.1, op 0)
        activeTimeoutRef.current = window.setTimeout(() => {
          if (!isGameBusy && currentAnimatingItem) setAnimationStep('visible');
        }, ANIMATION_TRANSITION_DURATION_MS);
        break;

      case 'visible':
        // Apply glow based on item type
        if (currentAnimatingItem.type === 'gain') setActiveGlowType('gain');
        else if (currentAnimatingItem.type === 'loss') setActiveGlowType('loss');
        else if (currentAnimatingItem.type === 'change') setActiveGlowType('change-new');
        
        activeTimeoutRef.current = window.setTimeout(() => {
          if (!isGameBusy && currentAnimatingItem) setAnimationStep('disappearing');
        }, HOLD_DURATION_MS);
        break;

      case 'disappearing':
        setActiveGlowType(null); // Remove glow before disappearing
        // Set specific disappear class based on item type
        if (currentAnimatingItem.type === 'loss') {
          setExplicitDisappearClass('disappear-to-large');
        } else { // gain or change
          setExplicitDisappearClass('disappear-to-small');
        }
        setIsCardVisibleClass(false); // Remove .visible class, triggers transition to disappear class target
        
        activeTimeoutRef.current = window.setTimeout(() => {
          if (!isGameBusy) { // Ensure game didn't become busy during the timeout
            setCurrentAnimatingItem(null); // Mark current item as done
            setAnimationStep('idle');     // Ready for next item or to close overlay
            setExplicitDisappearClass(null); // Reset for next cycle
          }
        }, ANIMATION_TRANSITION_DURATION_MS);
        break;
    }

    // Cleanup function for this effect
    return () => clearActiveTimeout();
  }, [currentAnimatingItem, animationStep, isGameBusy, clearActiveTimeout]);


  /** Skips any in-progress or queued animations, marking them as complete. */
  const handleSkipAnimations = useCallback(() => {
    if (isGameBusy) return; // Don't allow skipping if game is busy with other things
    resetAnimationState();
    // Mark the current (or last processed if mid-skip) TurnChanges as animated
    if (currentProcessingChanges) {
        setAnimatedTurnChangesRef(currentProcessingChanges);
        setCurrentProcessingChanges(null);
    } else if (lastTurnChanges && lastTurnChanges !== animatedTurnChangesRef) {
        // If no currentProcessingChanges (e.g., queue was empty but overlay was visible for some reason)
        setAnimatedTurnChangesRef(lastTurnChanges);
    }
  }, [isGameBusy, resetAnimationState, lastTurnChanges, animatedTurnChangesRef, currentProcessingChanges]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        handleSkipAnimations();
      }
    },
    [handleSkipAnimations]
  );


  /** Renders the static card markup for a given item. */
  const renderCardContent = (item: Item) => (
    <>
      <div className="flex justify-between items-center mb-1 text-xs">
        <ItemTypeDisplay type={item.type} />

        {item.isActive ? <span className="text-green-400 font-semibold">
          Active
        </span> : null}
      </div>

      <div className="mb-1">
        <span className="font-semibold text-lg text-slate-100">
          {item.name}
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-3 italic leading-tight flex-grow">
        {item.isActive && item.activeDescription ? item.activeDescription : item.description}
      </p>

      {item.isJunk ? <p className="text-xs text-orange-400 mb-1 italic">
        (Marked as junk)
      </p> : null}

      <div className="space-y-1 mt-auto">
        {item.knownUses?.map(ku => (
          <button
            aria-hidden="true"
            className="w-full text-xs bg-slate-500/70 text-slate-400 font-medium py-1 px-2 rounded shadow cursor-not-allowed"
            disabled
            key={`${item.name}-anim-ku-${ku.actionName}`}
            title={ku.description || ku.actionName}
          >
            {ku.actionName}
          </button>
        ))}

        <button
          aria-hidden="true"
          className="w-full text-sm bg-slate-500/70 text-slate-400 font-medium py-1.5 px-3 rounded shadow cursor-not-allowed"
          disabled
        >
          Inspect
        </button>

        {(item.type !== 'knowledge' && item.type !== 'status effect' && item.type !== 'vehicle') && (
          <button
            aria-hidden="true"
            className="w-full text-sm bg-slate-600/70 text-slate-400 font-medium py-1.5 px-3 rounded shadow cursor-not-allowed"
            disabled
          >
            Attempt to Use (Generic)
          </button>
        )}

        {item.type === 'vehicle' && (
          <button
            aria-hidden="true"
            className="w-full text-sm bg-slate-600/70 text-slate-400 font-medium py-1.5 px-3 rounded shadow cursor-not-allowed"
            disabled
          >
            {item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
          </button>
        )}
      </div>
    </>
  );

  if (!isVisibleOverlay || !itemForCardDisplay) {
    return null;
  }
  
  /** Returns the appropriate glow CSS class for the active animation state. */
  const getGlowClass = (cardType?: 'old' | 'new' | 'single'): string => {
    if (!activeGlowType) return '';
    if (activeGlowType === 'gain' && cardType === 'single') return 'apply-green-glow-effect';
    if (activeGlowType === 'loss' && cardType === 'single') return 'apply-red-glow-effect';
    if (activeGlowType === 'change-new' && cardType === 'new') return 'apply-neutral-glow-effect';
    return '';
  };

  const baseCardClass = "animating-item-card";
  const visibilityClass = isCardVisibleClass ? 'visible' : '';
  // Apply explicitDisappearClass only when the card is NOT supposed to be visible (i.e., during disappearance)
  const disappearTargetClass = explicitDisappearClass && !isCardVisibleClass ? explicitDisappearClass : '';


  return (
    <div
      aria-label="Skip item animations"
      className={`item-change-overlay ${isVisibleOverlay ? 'active' : ''}`}
      onClick={handleSkipAnimations}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {currentAnimatingItem?.type === 'change' && itemForCardDisplay.oldItem && itemForCardDisplay.newItem ? (
        <>
          <div className={`${baseCardClass} ${visibilityClass} ${disappearTargetClass} ${getGlowClass('old')}`}>
            {renderCardContent(itemForCardDisplay.oldItem)}
          </div>

          <div className={`${baseCardClass} ${visibilityClass} ${disappearTargetClass} ${getGlowClass('new')}`}>
            {renderCardContent(itemForCardDisplay.newItem)}
          </div>
        </>
      ) : itemForCardDisplay.item ? (
        <div className={`${baseCardClass} ${visibilityClass} ${disappearTargetClass} ${getGlowClass('single')}`}>
          {renderCardContent(itemForCardDisplay.item)}
        </div>
      ) : null}
    </div>
  );
}

export default ItemChangeAnimator;
