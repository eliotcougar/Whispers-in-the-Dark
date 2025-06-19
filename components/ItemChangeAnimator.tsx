/**
 * @file ItemChangeAnimator.tsx
 * @description Animates item gain, loss, and changes.
 */
import { Item, TurnChanges } from '../types';
import ItemTypeDisplay from './ItemTypeDisplay';
import { useItemChangeQueue } from '../hooks/useItemChangeQueue';

interface ItemChangeAnimatorProps {
  readonly lastTurnChanges: TurnChanges | null;
  readonly isGameBusy: boolean;
}

function ItemChangeAnimator({ lastTurnChanges, isGameBusy }: ItemChangeAnimatorProps) {
  const {
    itemForCardDisplay,
    currentAnimatingItem,
    isVisibleOverlay,
    isCardVisibleClass,
    explicitDisappearClass,
    activeGlowType,
    handleSkipAnimations,
    handleKeyDown,
  } = useItemChangeQueue({ lastTurnChanges, isGameBusy });

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
            title={ku.description ?? ku.actionName}
            type="button"
          >
            {ku.actionName}
          </button>
        ))}

        <button
          aria-hidden="true"
          className="w-full text-sm bg-slate-500/70 text-slate-400 font-medium py-1.5 px-3 rounded shadow cursor-not-allowed"
          disabled
          type="button"
        >
          Inspect
        </button>

        {(item.type !== 'knowledge' && item.type !== 'status effect' && item.type !== 'vehicle') && (
          <button
            aria-hidden="true"
            className="w-full text-sm bg-slate-600/70 text-slate-400 font-medium py-1.5 px-3 rounded shadow cursor-not-allowed"
            disabled
            type="button"
          >
            Attempt to Use (Generic)
          </button>
        )}

        {item.type === 'vehicle' && (
          <button
            aria-hidden="true"
            className="w-full text-sm bg-slate-600/70 text-slate-400 font-medium py-1.5 px-3 rounded shadow cursor-not-allowed"
            disabled
            type="button"
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

  const getGlowClass = (cardType?: 'old' | 'new' | 'single'): string => {
    if (!activeGlowType) return '';
    if (activeGlowType === 'gain' && cardType === 'single') return 'apply-green-glow-effect';
    if (activeGlowType === 'loss' && cardType === 'single') return 'apply-red-glow-effect';
    if (activeGlowType === 'change-new' && cardType === 'new') return 'apply-neutral-glow-effect';
    return '';
  };

  const baseCardClass = 'animating-item-card';
  const visibilityClass = isCardVisibleClass ? 'visible' : '';
  const disappearTargetClass = explicitDisappearClass && !isCardVisibleClass ? explicitDisappearClass : '';

  return (
    <div
      aria-label="Skip item animations"
      className="item-change-overlay active"
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

