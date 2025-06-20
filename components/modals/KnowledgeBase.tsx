
/**
 * @file KnowledgeBase.tsx
 * @description Displays discovered characters and theme info.
 */
import * as React from 'react';
import { Character, AdventureTheme } from '../../types';
import { Icon } from '../elements/icons';
import Button from '../elements/Button';

interface KnowledgeBaseProps {
  readonly allCharacters: Array<Character>;
  readonly currentTheme: AdventureTheme | null; // Changed to AdventureTheme object
  readonly isVisible: boolean;
  readonly onClose: () => void;
}

type GroupedEntities = Record<string, Array<Character> | undefined>;

/**
 * Lists discovered characters grouped by their associated theme.
 */
function KnowledgeBase({
  allCharacters,
  currentTheme, // This is now AdventureTheme | null
  isVisible,
  onClose,
}: KnowledgeBaseProps) {
  const groupedEntities = React.useMemo(() => {
    const grouped: GroupedEntities = {};

    allCharacters.forEach(character => {
      let bucket = grouped[character.themeName];
      if (!bucket) {
        bucket = [];
        grouped[character.themeName] = bucket;
      }
      bucket.push(character);
    });
    return grouped;
  }, [allCharacters]);

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
          
          {sortedThemeNames.length === 0 && isVisible ? <p className="text-slate-400 italic text-center">
            No knowledge has been recorded yet.
          </p> : null}

          {isVisible ? sortedThemeNames.map(themeName => {
            const characters = groupedEntities[themeName] ?? [];

            if (characters.length === 0) { 
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
                
                {characters.length > 0 && (
                  <>
                    <h3 className="text-xl font-semibold text-emerald-400 mt-4 mb-2">
                      Characters
                    </h3>

                    <div className="kb-card-grid">
                      {characters.map(character => {
                        let locationDisplay: React.ReactNode;
                        const isCurrentThemeCharacter = currentTheme && themeName === currentTheme.name;

                        if (isCurrentThemeCharacter && (character.presenceStatus === 'companion' || character.presenceStatus === 'nearby')) {
                          const iconName = character.presenceStatus === 'companion' ? 'companion' : 'nearbyNpc';
                          const statusText = character.presenceStatus === 'companion' ? '(Companion)' : '(Nearby)';
                          const colorClass = character.presenceStatus === 'companion' ? 'text-green-300' : 'text-sky-300';
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
                                {character.preciseLocation ?? ''}

                                {' '}

                                {statusText}
                              </span>
                            </p>
                          );
                        } else if (character.lastKnownLocation && character.lastKnownLocation !== "Unknown") { 
                           locationDisplay = (
                             <p className="text-sm text-slate-400 flex items-center">
                               <span className="ml-1 italic">
                                 {character.lastKnownLocation}

                                 {' '}
                                 (

                                 {character.presenceStatus}
                                 )
                               </span>
                             </p>
                          );
                        } else {
                           locationDisplay = (
                             <p className="text-sm text-slate-500 flex items-center">
                               <span className="ml-1 italic">
                                 (
                                 {character.presenceStatus}
                                 , Location Unknown)
                               </span>
                             </p>
                          );
                        }

                        return (
                          <div
                            className="kb-card"
                            key={`${themeName}-char-${character.name}`}
                          >
                            <div className="kb-card-name-header">
                              {character.name}
                            </div>

                            {character.aliases && character.aliases.length > 0 ? <p className="kb-card-aliases">
                              Aliases:
                              {character.aliases.join(', ')}
                            </p> : null}

                            <p className="kb-card-description">
                              {character.description}
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
