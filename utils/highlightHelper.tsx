
/**
 * @file highlightHelper.tsx
 * @description Utility for highlighting entities within text snippets.
 */
import React from 'react';
import { Item, Character, MapNode } from '../types';
// Item and Character types are fine. Place-like entities will be mapped to HighlightableEntity.
// No direct type change needed here as long as the calling components map MapNode data to HighlightableEntity structure.

export interface HighlightableEntity {
  name: string;
  type: 'item' | 'place' | 'character';
  description: string; 
  aliases?: string[];   
}

const getEntityHighlightClass = (type: HighlightableEntity['type']): string => {
  switch (type) {
    case 'item':
      return 'font-semibold text-yellow-400 hover:text-yellow-300 cursor-pointer'; 
    case 'place':
      return 'font-semibold text-sky-400 hover:text-sky-300 cursor-pointer';
    case 'character':
      return 'font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer';
    default:
      return '';
  }
};

export const highlightEntitiesInText = (
  text: string | null | undefined,
  entities: HighlightableEntity[]
): React.ReactNode[] => {
  if (!text) return [text || '']; 

  const results: React.ReactNode[] = [];
  
  const uniqueMatchTerms = new Map<string, { term: string; entityData: HighlightableEntity }>();

  entities.forEach(entity => {
    const addTermToMap = (term: string, originalCasingTerm: string) => {
      if (term && term.trim() !== '') {
        const termLower = term.toLowerCase();
        if (!uniqueMatchTerms.has(termLower)) {
          uniqueMatchTerms.set(termLower, { term: originalCasingTerm, entityData: entity });
        }
      }
    };

    addTermToMap(entity.name, entity.name);
    (entity.aliases || []).forEach((alias: string) => {
      addTermToMap(alias, alias);
    });

    const nameLower = entity.name.toLowerCase();
    if (nameLower.startsWith("the ") && entity.name.length > 4) {
      const strippedName = entity.name.substring(4);
      addTermToMap(strippedName, strippedName);
    } else if (nameLower.startsWith("a ") && entity.name.length > 2) {
      const strippedName = entity.name.substring(2);
      addTermToMap(strippedName, strippedName);
    }
  });
  
  const matchTermsArray = Array.from(uniqueMatchTerms.values());
  matchTermsArray.sort((a, b) => b.term.length - a.term.length);

  if (matchTermsArray.length === 0) return [text];

  const regexPattern = matchTermsArray
    .map(mt => mt.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) 
    .filter(term => term.length > 0) 
    .join('|');
  
  if (!regexPattern) return [text]; 

  const regex = new RegExp(`\\b(${regexPattern})\\b`, 'gi');
  
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchedString = match[0]; 
    const matchedTermInfo = matchTermsArray.find(mt => mt.term.toLowerCase() === matchedString.toLowerCase());

    if (match.index > lastIndex) {
      results.push(text.substring(lastIndex, match.index));
    }

    if (matchedTermInfo) {
      results.push(
        <span
          key={`${matchedTermInfo.entityData.name}-${matchedTermInfo.term}-${match.index}`}
          className={getEntityHighlightClass(matchedTermInfo.entityData.type)}
          title={matchedTermInfo.entityData.description || matchedTermInfo.entityData.name}
        >
          {matchedString} 
        </span>
      );
    } else {
      results.push(matchedString); 
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    results.push(text.substring(lastIndex));
  }
  
  return results.length > 0 ? results : [text];
};

/**
 * Builds a list of highlightable entities from inventory items, map nodes and
 * characters for the current theme.
 */
export const buildHighlightableEntities = (
  inventory: Item[],
  mapData: MapNode[],
  allCharacters: Character[],
  currentThemeName: string | null
): HighlightableEntity[] => {
  const items: HighlightableEntity[] = inventory.map(item => ({
    name: item.name,
    type: 'item',
    description:
      item.isActive && item.activeDescription ? item.activeDescription : item.description,
  }));

  const places: HighlightableEntity[] = currentThemeName
    ? mapData
        .filter(node => node.themeName === currentThemeName)
        .map(node => ({
          name: node.placeName,
          type: 'place',
          description: node.data.description || 'A location of interest.',
          aliases: node.data.aliases || [],
        }))
    : [];

  const characters: HighlightableEntity[] = currentThemeName
    ? allCharacters
        .filter(c => c.themeName === currentThemeName)
        .map(c => ({
          name: c.name,
          type: 'character',
          description: c.description,
          aliases: c.aliases,
        }))
    : [];

  return [...items, ...places, ...characters];
};
