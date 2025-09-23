
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
                  {sortedNPCs.map(npc => {
                        let locationDisplay: React.ReactNode;
                        const isCurrentThemeNPC = Boolean(currentTheme);

                        if (
                          isCurrentThemeNPC &&
                          CLOSE_PRESENCE_STATUSES.includes(
                            npc.presenceStatus as (typeof CLOSE_PRESENCE_STATUSES)[number],
                          )
                        ) {
                          const iconName = npc.presenceStatus === 'companion' ? 'companion' : 'nearbyNpc';
                          const statusText = npc.presenceStatus === 'companion' ? '(Companion)' : '(Nearby)';
                          const colorClass = npc.presenceStatus === 'companion' ? 'text-green-300' : 'text-sky-300';
                          locationDisplay = (
                            <p className="text-sm text-slate-300 flex items-center">
                              <Icon
                                color={iconName === 'companion' ? 'green' : 'sky'}
                                inline
                                marginRight={4}
                                name={iconName}
                                size={16}
                              />

                              <span className={`ml-1 ${colorClass} italic`}>
                                {npc.preciseLocation ?? ''}

                                {' '}

                                {statusText}
                              </span>
                            </p>
                          );
                        } else if (npc.lastKnownLocation && npc.lastKnownLocation !== "Unknown") { 
                           locationDisplay = (
                             <p className="text-sm text-slate-300 flex items-center">
                               <span className="ml-1 italic">
                                 {npc.lastKnownLocation}

                                 {' '}
                                 (

                                 {npc.presenceStatus}
                                 )
                               </span>
                             </p>
                          );
                        } else {
                           locationDisplay = (
                             <p className="text-sm text-slate-500 flex items-center">
                               <span className="ml-1 italic">
                                 (
                                 {npc.presenceStatus}
                                 , Location Unknown)
                               </span>
                             </p>
                          );
                        }

                        return (
                          <div
                            className="kb-card"
                            key={npc.name}
                          >
                            <div className="kb-card-name-header">
                              {npc.name}
                            </div>

                            {npc.aliases && npc.aliases.length > 0 ? <p className="kb-card-aliases">
                              Aliases:
                              {npc.aliases.join(', ')}
                            </p> : null}

                            <p className="kb-card-description">
                              {npc.description}
                            </p>

                            <div className="mt-2 pt-2 border-t border-slate-600">
                              {locationDisplay}
                            </div>
                          </div>
                        );
                  })}
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
