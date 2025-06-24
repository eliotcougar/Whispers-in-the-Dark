/**
 * @file ItemChangeAnimator.tsx
 * @description Animates item gain, loss, and changes.
 */
import { Item, TurnChanges } from '../../types';
import ItemTypeDisplay from './ItemTypeDisplay';
import Button from '../elements/Button';
import { useItemChangeQueue } from '../../hooks/useItemChangeQueue';

const noop = () => undefined;

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

      {item.tags?.includes('junk') ? <p className="text-xs text-orange-400 mb-1 italic">
        (Marked as junk)
      </p> : null}

      <div className="space-y-1 mt-auto">
        {item.knownUses?.map(ku => (
          <Button
            aria-hidden="true"
            ariaLabel={ku.actionName}
            disabled
            key={`${item.name}-anim-ku-${ku.actionName}`}
            label={ku.actionName}
            onClick={noop}
            preset="slate"
            size="sm"
            title={ku.description}
          />
        ))}

        <Button
          aria-hidden="true"
          ariaLabel="Inspect"
          disabled
          label="Inspect"
          onClick={noop}
          preset="slate"
          size="sm"
        />

        {(item.type !== 'knowledge' && item.type !== 'status effect' && item.type !== 'vehicle') && (
          <Button
            aria-hidden="true"
            ariaLabel="Attempt to Use (Generic)"
            disabled
            label="Attempt to Use (Generic)"
            onClick={noop}
            preset="slate"
            size="sm"
          />
        )}

        {item.type === 'vehicle' && (
          <Button
            aria-hidden="true"
            ariaLabel={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
            disabled
            label={item.isActive ? `Exit ${item.name}` : `Enter ${item.name}`}
            onClick={noop}
            preset="slate"
            size="sm"
          />
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

