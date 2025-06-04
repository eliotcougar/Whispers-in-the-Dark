
import React from 'react';
import { Character, AdventureTheme } from '../types'; 
import { CompanionIcon, NearbyNPCIcon } from './icons.tsx'; 

interface KnowledgeBaseProps {
  allCharacters: Character[];
  currentTheme: AdventureTheme | null; // Changed to AdventureTheme object
  isVisible: boolean;
  onClose: () => void;
}

interface GroupedEntities {
  [themeName: string]: {
    characters: Character[];
  };
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  allCharacters,
  currentTheme, // This is now AdventureTheme | null
  isVisible,
  onClose,
}) => {
  const groupedEntities = React.useMemo(() => {
    const grouped: GroupedEntities = {};

    allCharacters.forEach(character => {
      if (!grouped[character.themeName]) {
        grouped[character.themeName] = { characters: [] };
      }
      grouped[character.themeName].characters.push(character);
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
    <div className={`animated-frame ${isVisible ? 'open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="knowledge-base-title">
      <div className="animated-frame-content"> 
        <button
          onClick={onClose}
          className="animated-frame-close-button"
          aria-label="Close knowledge base"
        >
          &times;
        </button>
        <div className="knowledge-base-content-area"> 
          <h1 id="knowledge-base-title" className="text-3xl font-bold text-sky-300 mb-6 text-center">Knowledge Base</h1>
          
          {sortedThemeNames.length === 0 && isVisible && (
            <p className="text-slate-400 italic text-center">No knowledge has been recorded yet.</p>
          )}

          {isVisible && sortedThemeNames.map(themeName => {
            const themeData = groupedEntities[themeName];
            const characters = themeData.characters || [];

            if (characters.length === 0) { 
              return null; 
            }

            return (
              <section key={themeName} className="mb-8">
                <h2 className="kb-theme-group-title">
                  Theme: {themeName}
                  {currentTheme && themeName === currentTheme.name && (
                    <span className="text-sm text-purple-400 ml-2">(Current Active Theme)</span>
                  )}
                </h2>
                
                {characters.length > 0 && (
                  <>
                    <h3 className="text-xl font-semibold text-emerald-400 mt-4 mb-2">Characters</h3>
                    <div className="kb-card-grid">
                      {characters.map(character => {
                        let locationDisplay = null;
                        const isCurrentThemeCharacter = currentTheme && themeName === currentTheme.name;

                        if (isCurrentThemeCharacter && (character.presenceStatus === 'companion' || character.presenceStatus === 'nearby')) {
                          const Icon = character.presenceStatus === 'companion' ? CompanionIcon : NearbyNPCIcon;
                          const statusText = character.presenceStatus === 'companion' ? '(Companion)' : '(Nearby)';
                          const colorClass = character.presenceStatus === 'companion' ? 'text-green-300' : 'text-sky-300';
                          locationDisplay = (
                            <p className="text-sm text-slate-300 flex items-center">
                              <Icon /><span className={`ml-1 ${colorClass} italic`}>{character.preciseLocation || ''} {statusText}</span>
                            </p>
                          );
                        } else if (character.lastKnownLocation && character.lastKnownLocation !== "Unknown") { 
                           locationDisplay = (
                            <p className="text-sm text-slate-400 flex items-center">
                              <span className="ml-1 italic">{character.lastKnownLocation} ({character.presenceStatus})</span>
                            </p>
                          );
                        } else {
                           locationDisplay = (
                            <p className="text-sm text-slate-500 flex items-center">
                              <span className="ml-1 italic">({character.presenceStatus}, Location Unknown)</span>
                            </p>
                          );
                        }

                        return (
                          <div key={`${themeName}-char-${character.name}`} className="kb-card">
                            <div className="kb-card-name-header">{character.name}</div>
                            {character.aliases && character.aliases.length > 0 && (
                              <p className="kb-card-aliases">Aliases: {character.aliases.join(', ')}</p>
                            )}
                            <p className="kb-card-description">{character.description}</p>
                            {locationDisplay && (
                              <div className="mt-2 pt-2 border-t border-slate-600">
                                {locationDisplay}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
