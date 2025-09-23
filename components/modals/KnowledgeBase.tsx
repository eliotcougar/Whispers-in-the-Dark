
/**
 * @file KnowledgeBase.tsx
 * @description Displays discovered NPCs.
 */
import * as React from 'react';
import { NPC, AdventureTheme } from '../../types';
import { Icon } from '../elements/icons';
import Button from '../elements/Button';
import { CLOSE_PRESENCE_STATUSES } from '../../constants';

interface KnowledgeBaseProps {
  readonly allNPCs: Array<NPC>;
  readonly currentTheme: AdventureTheme | null; // Changed to AdventureTheme object
  readonly isVisible: boolean;
  readonly onClose: () => void;
}

/**
 * Lists discovered NPCs.
 */
function KnowledgeBase({
  allNPCs: allNPCs,
  currentTheme, // This is now AdventureTheme | null
  isVisible,
  onClose,
}: KnowledgeBaseProps) {
  const sortedNPCs = React.useMemo(
    () => [...allNPCs].sort((a, b) => a.name.localeCompare(b.name)),
    [allNPCs],
  );

  const renderLocationDisplay = React.useCallback(
    (npc: NPC): React.ReactNode => {
      const lastKnownLocation = npc.lastKnownLocation;
      const hasKnownLocation = typeof lastKnownLocation === 'string' && lastKnownLocation !== 'Unknown';

      if (currentTheme && CLOSE_PRESENCE_STATUSES.includes(
        npc.presenceStatus as (typeof CLOSE_PRESENCE_STATUSES)[number],
      )) {
        const isCompanion = npc.presenceStatus === 'companion';
        const iconName = isCompanion ? 'companion' : 'nearbyNpc';
        const colorClass = isCompanion ? 'text-green-300' : 'text-sky-300';
        const statusText = isCompanion ? '(Companion)' : '(Nearby)';
        const preciseLocation = npc.preciseLocation?.trim();

        return (
          <p className="text-sm text-slate-300 flex items-center">
            <Icon
              color={isCompanion ? 'green' : 'sky'}
              inline
              marginRight={4}
              name={iconName}
              size={16}
            />

            <span className={`ml-1 ${colorClass} italic`}>
              {preciseLocation && preciseLocation.length > 0 ? (
                <>
                  {preciseLocation}
                  {' '}
                  {statusText}
                </>
              ) : statusText}
            </span>
          </p>
        );
      }

      if (hasKnownLocation) {
        return (
          <p className="text-sm text-slate-300 flex items-center">
            <span className="ml-1 italic">
              {lastKnownLocation}
              {' '}
              ({npc.presenceStatus})
            </span>
          </p>
        );
      }

      return (
        <p className="text-sm text-slate-500 flex items-center">
          <span className="ml-1 italic">
            ({npc.presenceStatus})
          </span>
        </p>
      );
    },
    [currentTheme],
  );

  return (
    <div
      aria-labelledby="knowledge-base-title"
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      role="dialog"
    >
      <div className="animated-frame-content">
        <Button
          ariaLabel="Close knowledge base"
          icon={<Icon
            name="x"
            size={20}
          />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <div className="knowledge-base-content-area"> 
          <h1
            className="text-3xl font-bold text-sky-300 mb-6 text-center"
            id="knowledge-base-title"
          >
            Knowledge Base
          </h1>
          
          {sortedNPCs.length === 0 && isVisible ? <p className="text-slate-300 italic text-center">
            No knowledge has been recorded yet.
          </p> : null}

          {isVisible ? (
            <section className="mb-8">
              <h2 className="kb-theme-group-title">
                NPCs
              </h2>

              {sortedNPCs.length > 0 && (
                <div className="kb-card-grid">
                  {sortedNPCs.map(npc => (
                    <div
                      className="kb-card"
                      key={npc.name}
                    >
                      <div className="kb-card-name-header">
                        {npc.name}
                      </div>

                      {npc.aliases && npc.aliases.length > 0 ? <p className="kb-card-aliases">
                        {npc.aliases.join(', ')}
                      </p> : null}

                      <p className="kb-card-description">
                        {npc.description}
                      </p>

                      <div className="mt-2 pt-2 border-t border-slate-600">
                        {renderLocationDisplay(npc)}
                      </div>

                      {npc.knowsPlayerAs.length > 0 ? <p className="text-sm text-slate-400">
                        Knows you as:
                        {' '}
                        {npc.knowsPlayerAs.join(', ')}
                      </p> : <p className="text-sm text-slate-500 italic">
                        Does not know your name.
                      </p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default KnowledgeBase;
