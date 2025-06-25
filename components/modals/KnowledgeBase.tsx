
/**
 * @file KnowledgeBase.tsx
 * @description Displays discovered NPCs.
 */
import * as React from 'react';
import { NPC, AdventureTheme } from '../../types';
import { Icon } from '../elements/icons';
import Button from '../elements/Button';

interface KnowledgeBaseProps {
  readonly allNPCs: Array<NPC>;
  readonly currentTheme: AdventureTheme | null; // Changed to AdventureTheme object
  readonly isVisible: boolean;
  readonly onClose: () => void;
}

type GroupedEntities = Record<string, Array<NPC> | undefined>;

/**
 * Lists discovered NPCs grouped by their associated theme.
 */
function KnowledgeBase({
  allNPCs: allNPCs,
  currentTheme, // This is now AdventureTheme | null
  isVisible,
  onClose,
}: KnowledgeBaseProps) {
  const groupedEntities = React.useMemo(() => {
    const grouped: GroupedEntities = {};

    allNPCs.forEach(npc => {
      let bucket = grouped[npc.themeName];
      if (!bucket) {
        bucket = [];
        grouped[npc.themeName] = bucket;
      }
      bucket.push(npc);
    });
    return grouped;
  }, [allNPCs]);

  const sortedThemeNames = React.useMemo(() => {
    return Object.keys(groupedEntities).sort((a, b) => {
      if (currentTheme && a === currentTheme.name) return -1;
      if (currentTheme && b === currentTheme.name) return 1;
      return a.localeCompare(b);
    });
  }, [groupedEntities, currentTheme]);

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
          
          {sortedThemeNames.length === 0 && isVisible ? <p className="text-slate-300 italic text-center">
            No knowledge has been recorded yet.
          </p> : null}

          {isVisible ? sortedThemeNames.map(themeName => {
            const npcs = groupedEntities[themeName] ?? [];

            if (npcs.length === 0) { 
              return null; 
            }

            return (
              <section
                className="mb-8"
                key={themeName}
              >
                <h2 className="kb-theme-group-title">
                  Theme: 
                  {' '}

                  {themeName}

                  {currentTheme && themeName === currentTheme.name ? <span className="text-sm text-purple-400 ml-2">
                    (Current Active Theme)
                  </span> : null}
                </h2>
                
                {npcs.length > 0 && (
                  <>
                    <h3 className="text-xl font-semibold text-emerald-400 mt-4 mb-2">
                      NPCs
                    </h3>

                    <div className="kb-card-grid">
                      {npcs.map(npc => {
                        let locationDisplay: React.ReactNode;
                        const isCurrentThemeNPC = currentTheme && themeName === currentTheme.name;

                        if (isCurrentThemeNPC && (npc.presenceStatus === 'companion' || npc.presenceStatus === 'nearby')) {
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
                            key={`${themeName}-npc-${npc.name}`}
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
                  </>
                )}
              </section>
            );
          }) : null}
        </div>
      </div>
    </div>
  );
}

export default KnowledgeBase;
