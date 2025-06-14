
/**
 * @file mapNodeMatcher.ts
 * @description Utility functions for matching a local place description to the most relevant map node.
 */

import { AdventureTheme, MapData, MapNode } from '../types'; // Removed Place

import {
  PREPOSITIONS,
  ALL_PREPOSITION_KEYWORDS_FOR_REGEX,
  PrepositionDefinition
} from "./matcherData";

const commonWords = new Set([
  "the", "a", "an", "is", "are", "was", "were", "am", "i", "you", "he", "she", "it", "we", "they",
  "and", "or", "but", "so", "then", "just", "very", "quite", "also", "too", "now", "player", "character",
  "up", "down", "left", "right", "north", "south", "east", "west", "above", "below", "under", "over",
  "through", "around", "along", "across", "between", "among", "front",
  "go", "look", "see", "find", "take", "get", "move", "walk", "run", "stand", "sit", "player is",
  "several", "stories" 
]);

const normalizeStringForMatching = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[.,!?;:"(){}[\]'’]/g, '')
    .trim();
};

const tokenizeString = (text: string | null | undefined): string[] => {
  if (!text) return [];
  const normalized = normalizeStringForMatching(text);
  return normalized
    .split(/\s+/)
    .map(token => token.replace(/^['"]+|['"]+$/g, '')) 
    .filter(token => token.length > 0 && !commonWords.has(token))
    .map(token => token.trim())
    .filter(token => token.length > 0);
};

function areTokensSingularPluralMatch(token1: string, token2: string): boolean {
  if (!token1 || !token2) return false;
  if (token1 === token2 || (token1.length < 3 && token2.length < 3)) return false;
  const t1 = token1.toLowerCase();
  const t2 = token2.toLowerCase();
  if (t1 === t2 + 's' || t2 === t1 + 's') return true;
  if (t1.endsWith('es') && t1.slice(0, -2) === t2) return true;
  if (t2.endsWith('es') && t2.slice(0, -2) === t1) return true;
  if (t1.endsWith('ies') && t1.slice(0, -3) + 'y' === t2) return true;
  if (t2.endsWith('ies') && t2.slice(0, -3) + 'y' === t1) return true;
  return false;
}

interface ExtractedChunk {
  phrase: string;
  prepositionKeyword: string; 
  prepositionType: PrepositionDefinition['type'] | 'direct'; 
  prepositionWeight: number;
  originalPrepositionText?: string; 
}

const parseLocalPlaceIntoChunks = (localPlace: string | null | undefined): ExtractedChunk[] => {
  if (!localPlace || localPlace.trim() === "") return [];
  const chunks: ExtractedChunk[] = [];
  const regexPattern = `\\b(?:${ALL_PREPOSITION_KEYWORDS_FOR_REGEX.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`;
  const splitterRegex = new RegExp(regexPattern, 'gi');
  
  const prepMatches: { index: number; text: string; originalText: string, definition: PrepositionDefinition }[] = [];
  let match;
  while ((match = splitterRegex.exec(localPlace)) !== null) {
    const matchedKeywordLower = match[0].toLowerCase();
    const definition = PREPOSITIONS.find(pDef => pDef.keywords.includes(matchedKeywordLower));
    if (definition && definition.type !== 'contextual_linking') {
      prepMatches.push({ index: match.index, text: matchedKeywordLower, originalText: match[0], definition });
    }
  }
  prepMatches.sort((a, b) => a.index - b.index);

  let currentPhraseStart = 0;
  const firstSplitterIndex = prepMatches.length > 0 ? prepMatches[0].index : localPlace.length;
  let initialPhrase = localPlace.substring(0, firstSplitterIndex).trim();
  
  const initialCommaIndex = initialPhrase.indexOf(',');
  if (initialCommaIndex !== -1) initialPhrase = initialPhrase.substring(0, initialCommaIndex).trim();

  if (initialPhrase) {
    chunks.push({
      phrase: initialPhrase,
      prepositionKeyword: 'implicit_subject',
      prepositionType: 'direct',
      prepositionWeight: 100, 
    });
  }
  
  for (let i = 0; i < prepMatches.length; i++) {
    const currentPrepMatch = prepMatches[i];
    currentPhraseStart = currentPrepMatch.index + currentPrepMatch.originalText.length;
    const phraseEnd = (i + 1 < prepMatches.length) ? prepMatches[i+1].index : localPlace.length;
    
    let phrase = localPlace.substring(currentPhraseStart, phraseEnd).trim();
    const commaIndexInPhrase = phrase.indexOf(',');
    if (commaIndexInPhrase !== -1) phrase = phrase.substring(0, commaIndexInPhrase).trim();

    if (phrase) {
      chunks.push({
        phrase,
        prepositionKeyword: currentPrepMatch.text, 
        prepositionType: currentPrepMatch.definition.type,
        prepositionWeight: currentPrepMatch.definition.weight,
        originalPrepositionText: currentPrepMatch.originalText, 
      });
    }
  }
  return chunks.filter(c => c.phrase.length > 0);
};

const PROXIMITY_BONUS = 30; 
const EXACT_MATCH_FEATURE_BONUS = 10;

interface ExactMatchCandidate {
  nodeId: string;
  score: number;
  isFeature: boolean;
  nameLength: number;
}

/**
 * Attempts to match a suggested node identifier (ID, name, or alias) to an existing node in the current theme.
 * @param suggestedIdentifier The identifier string suggested by an AI.
 * @param source For logging purposes, indicates if suggestion is from 'mapAI' or 'mainAI'.
 * @param oldMapNodeIdIfAvailable The ID of the player's previous map node, used for tie-breaking. Can be null.
 * @param currentThemeName The name of the active theme.
 * @param currentThemeNodesFromDraft All MapNode objects for the current theme from the draft game state.
 * @returns An object `{ matched: boolean, nodeId: string | null }`. 
 *          `matched` is true if a node was successfully matched, `nodeId` is its ID.
 */
export const attemptMatchAndSetNode = (
    suggestedIdentifier: string | undefined | null,
    source: 'mapAI' | 'mainAI',
    oldMapNodeIdIfAvailable: string | null,
    currentThemeName: string,
    currentThemeNodesFromDraft: MapNode[]
  ): { matched: boolean; nodeId: string | null } => {
  
    if (!suggestedIdentifier || suggestedIdentifier.trim() === "") {
      console.log(`MapNodeMatcher (${source}): No suggestion provided or suggestion is empty.`);
      return { matched: false, nodeId: null };
    }
  
    if (currentThemeNodesFromDraft.length === 0) {
        console.log(`MapNodeMatcher (${source}): No nodes found for theme "${currentThemeName}" in draft state.`);
        return { matched: false, nodeId: null };
    }
  
    // 1. Try to match by ID (exact match)
    const foundNodeById = currentThemeNodesFromDraft.find(n => n.id === suggestedIdentifier);
    if (foundNodeById) {
      console.log(`MapNodeMatcher (${source}): AI suggested node ID "${suggestedIdentifier}", matched to ID "${foundNodeById.id}".`);
      return { matched: true, nodeId: foundNodeById.id };
    }

    // 1b. Heuristic: treat malformed IDs with wrong suffix
    const idPattern = /^(.*)_([a-zA-Z0-9]{4})$/;
    const m = suggestedIdentifier.match(idPattern);
    if (m) {
      const base = m[1];
      const prefixMatch = currentThemeNodesFromDraft.find(n => n.id.startsWith(`${base}_`));
      if (prefixMatch) {
        console.log(`MapNodeMatcher (${source}): Heuristically matched malformed ID "${suggestedIdentifier}" to "${prefixMatch.id}".`);
        return { matched: true, nodeId: prefixMatch.id };
      }
    }
  
    // 2. Try to match by Name or Alias (case-insensitive)
    const lowerSuggestedIdentifier = suggestedIdentifier.toLowerCase();
    const matchingNodesByNameOrAlias = currentThemeNodesFromDraft.filter(n =>
      n.placeName.toLowerCase() === lowerSuggestedIdentifier ||
      (n.data.aliases && n.data.aliases.some(alias => alias.toLowerCase() === lowerSuggestedIdentifier))
    );

    if (matchingNodesByNameOrAlias.length === 0) {
      const base = m ? m[1] : suggestedIdentifier;
      const normalizedBase = base.replace(/_/g, ' ').toLowerCase();
      matchingNodesByNameOrAlias.push(
        ...currentThemeNodesFromDraft.filter(n =>
          n.placeName.toLowerCase() === normalizedBase ||
          (n.data.aliases && n.data.aliases.some(a => a.toLowerCase() === normalizedBase)),
        ),
      );
    }
  
    if (matchingNodesByNameOrAlias.length === 0) {
      console.log(`MapNodeMatcher (${source}): AI suggested identifier "${suggestedIdentifier}" NOT found by ID, name, or alias within theme "${currentThemeName}".`);
      return { matched: false, nodeId: null };
    }
  
    if (matchingNodesByNameOrAlias.length === 1) {
      const matchedNode = matchingNodesByNameOrAlias[0];
      console.log(`MapNodeMatcher (${source}): AI suggested node NAME/ALIAS "${suggestedIdentifier}", uniquely matched to ID "${matchedNode.id}".`);
      return { matched: true, nodeId: matchedNode.id };
    }
  
    // Multiple matches by name/alias - apply tie-breaking
    console.log(`MapNodeMatcher (${source}): AI suggested node NAME/ALIAS "${suggestedIdentifier}", multiple matches found. Applying tie-breaking.`);
  
    // Tie-breaker 1: Is oldMapNodeIdIfAvailable one of the matches?
    if (oldMapNodeIdIfAvailable) {
      const oldNodeIsMatch = matchingNodesByNameOrAlias.find(n => n.id === oldMapNodeIdIfAvailable);
      if (oldNodeIsMatch) {
        console.log(`MapNodeMatcher (${source}): Tie-breaker: Matched oldMapNodeId "${oldMapNodeIdIfAvailable}".`);
        return { matched: true, nodeId: oldNodeIsMatch.id };
      }
    }
  
    // Tie-breaker 2: Prefer non-feature nodes
    const nonFeatureMatches = matchingNodesByNameOrAlias.filter(n => n.data.nodeType !== 'feature');
    if (nonFeatureMatches.length > 0) {
      const chosenNonFeature = nonFeatureMatches[0]; // Could add more heuristics like name length later if needed
      console.log(`MapNodeMatcher (${source}): Tie-breaker: Chose non-feature node "${chosenNonFeature.placeName}" (ID: ${chosenNonFeature.id}).`);
      return { matched: true, nodeId: chosenNonFeature.id };
    }
  
    // Tie-breaker 3: All matches are feature nodes, pick the first one
    const firstMatch = matchingNodesByNameOrAlias[0]; // Could add more heuristics like name length
    console.log(`MapNodeMatcher (${source}): Tie-breaker: Chose first feature node match "${firstMatch.placeName}" (ID: ${firstMatch.id}).`);
    return { matched: true, nodeId: firstMatch.id };
};

/**
 * Determines the most appropriate map node based on a textual place description.
 * The function scores each node by comparing tokens and prepositions extracted
 * from the description, preferring nodes that were previously nearby.
 *
 * @param localPlace - The freeform location string from the player.
 * @param currentTheme - The current active theme object.
 * @param mapData - Complete map graph data.
 * @param allNodesForTheme - Nodes belonging to the current theme.
 * @param previousMapNodeId - ID of the player's previous map node if any.
 * @returns The best matching node ID or null when no suitable match is found.
 */
export const selectBestMatchingMapNode = (
  localPlace: string | null,
  currentTheme: AdventureTheme | null,
  mapData: MapData, // Full map data
  allNodesForTheme: MapNode[], // Pre-filtered nodes for the current theme
  previousMapNodeId: string | null
): string | null => {
  if (!localPlace || !currentTheme || !mapData || allNodesForTheme.length === 0) {
    return null;
  }

  const themeNodes = allNodesForTheme; // Use pre-filtered nodes

  const firstCommaIndex = localPlace.indexOf(',');
  const localPlaceForEarlyMatch = (firstCommaIndex !== -1 ? localPlace.substring(0, firstCommaIndex) : localPlace).trim();
  const normalizedLocalPlaceForEarlyMatch = normalizeStringForMatching(localPlaceForEarlyMatch);
  const tokenizedLocalPlaceString = tokenizeString(localPlace).join(' ');

  const exactMatches: ExactMatchCandidate[] = [];

  for (const node of themeNodes) {
    const nodeNamesAndAliases: string[] = [node.placeName, ...(node.data.aliases || [])];

    for (const nameOrAlias of nodeNamesAndAliases.filter(name => name && name.trim() !== "")) {
      const normName = normalizeStringForMatching(nameOrAlias);
      const tokenizedNodeNameString = tokenizeString(nameOrAlias).join(' ');
      let currentMatchScore = 0;

      if (normName === normalizedLocalPlaceForEarlyMatch) currentMatchScore = 1000;
      else if (normalizedLocalPlaceForEarlyMatch.endsWith(normName) && normalizedLocalPlaceForEarlyMatch.length > normName.length) currentMatchScore = 950;
      else if (normalizedLocalPlaceForEarlyMatch.startsWith(normName) && normalizedLocalPlaceForEarlyMatch.length > normName.length) currentMatchScore = 920;
      else if (tokenizedNodeNameString && tokenizedLocalPlaceString && tokenizedNodeNameString === tokenizedLocalPlaceString) currentMatchScore = 900;
      else if (normalizedLocalPlaceForEarlyMatch.includes(normName) && normName.length > 0) currentMatchScore = 800 + (normName.length * 0.5);

      if (currentMatchScore > 0) {
        const isFeatureNode = node.data.nodeType === 'feature';
        exactMatches.push({
          nodeId: node.id,
          score: currentMatchScore + (isFeatureNode ? EXACT_MATCH_FEATURE_BONUS : 0),
          isFeature: isFeatureNode,
          nameLength: nameOrAlias.length
        });
      }
    }
  }

  if (exactMatches.length > 0) {
    exactMatches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.isFeature !== b.isFeature) return a.isFeature ? -1 : 1;
      return b.nameLength - a.nameLength;
    });
    return exactMatches[0].nodeId; 
  }

  const extractedChunks = parseLocalPlaceIntoChunks(localPlace);
  if (extractedChunks.length === 0) return null; 

  let bestMatchNodeId: string | null = null;
  let overallBestScore = -1;

  const directNeighborIds = new Set<string>();
  if (previousMapNodeId && mapData.edges) {
    mapData.edges.forEach(edge => {
      if (edge.sourceNodeId === previousMapNodeId) directNeighborIds.add(edge.targetNodeId);
      else if (edge.targetNodeId === previousMapNodeId) directNeighborIds.add(edge.sourceNodeId);
    });
  }

  for (const node of themeNodes) {
    const nodeNamesAndAliases: string[] = [node.placeName, ...(node.data.aliases || [])];
    let maxScoreForThisNodeCandidate = -1;

    for (const nodeNameOrAlias of nodeNamesAndAliases.filter(name => name && name.trim() !== "")) {
      const nodeNameTokens = tokenizeString(nodeNameOrAlias);
      if (nodeNameTokens.length === 0) continue;

      let currentScoreForNameAliasPair = 0;
      for (const chunk of extractedChunks) {
        const chunkPhraseTokens = tokenizeString(chunk.phrase);
        if (chunkPhraseTokens.length === 0) continue;

        let commonTokenCount = 0;
        const tempChunkTokensForMatching = [...chunkPhraseTokens]; 
        nodeNameTokens.forEach(nnToken => {
          const exactMatchIndex = tempChunkTokensForMatching.indexOf(nnToken);
          if (exactMatchIndex !== -1) {
            commonTokenCount++; tempChunkTokensForMatching.splice(exactMatchIndex, 1); 
          } else {
            const pluralMatchIndex = tempChunkTokensForMatching.findIndex(chunkToken => areTokensSingularPluralMatch(nnToken, chunkToken));
            if (pluralMatchIndex !== -1) { commonTokenCount++; tempChunkTokensForMatching.splice(pluralMatchIndex, 1); }
          }
        });

        if (commonTokenCount > 0) {
          const nodeCoverage = commonTokenCount / nodeNameTokens.length;
          const chunkRelevance = commonTokenCount / chunkPhraseTokens.length;
          let baseScore = (nodeCoverage * 60) + (chunkRelevance * 40); 

          const normalizedNodeName = normalizeStringForMatching(nodeNameOrAlias);
          const normalizedChunkPhrase = normalizeStringForMatching(chunk.phrase); 

          let exactOrSubstringBonus = 0;
          if (normalizedNodeName === normalizedChunkPhrase) exactOrSubstringBonus = 100; 
          else if (normalizedChunkPhrase.endsWith(normalizedNodeName) && normalizedChunkPhrase.length > normalizedNodeName.length) exactOrSubstringBonus = 75; 
          else if (normalizedChunkPhrase.startsWith(normalizedNodeName) && normalizedChunkPhrase.length > normalizedNodeName.length) exactOrSubstringBonus = 70;
          else if (normalizedChunkPhrase.includes(normalizedNodeName)) exactOrSubstringBonus = 50 + (normalizedNodeName.length * 0.2);
          else if (normalizedNodeName.includes(normalizedChunkPhrase)) exactOrSubstringBonus = 25 + (normalizedChunkPhrase.length * 0.2);
          
          baseScore += exactOrSubstringBonus;
          const effectiveWeight = (chunk.prepositionType === 'negating' && baseScore > 75) ? chunk.prepositionWeight * 0.5 : chunk.prepositionWeight;
          currentScoreForNameAliasPair += baseScore * (effectiveWeight / 100.0);
        }
      }
      if (currentScoreForNameAliasPair > maxScoreForThisNodeCandidate) maxScoreForThisNodeCandidate = currentScoreForNameAliasPair;
    }

    if (maxScoreForThisNodeCandidate > -1 && directNeighborIds.has(node.id)) maxScoreForThisNodeCandidate += PROXIMITY_BONUS;
    
    if (maxScoreForThisNodeCandidate > overallBestScore) {
      overallBestScore = maxScoreForThisNodeCandidate;
      bestMatchNodeId = node.id;
    } else if (maxScoreForThisNodeCandidate === overallBestScore && bestMatchNodeId) {
      const prevBestNode = themeNodes.find(n => n.id === bestMatchNodeId);
      if (prevBestNode) {
        const nodeIsFeature = node.data.nodeType === 'feature';
        const prevIsFeature = prevBestNode.data.nodeType === 'feature';
        if (nodeIsFeature && !prevIsFeature) bestMatchNodeId = node.id;
        else if (!nodeIsFeature && prevIsFeature) { /* Keep prev */ }
        else if (normalizeStringForMatching(node.placeName).length > normalizeStringForMatching(prevBestNode.placeName).length) bestMatchNodeId = node.id;
      }
    }
  }
  
  if (bestMatchNodeId && overallBestScore > 0) {
    const bestNode = themeNodes.find(n => n.id === bestMatchNodeId);
    if (bestNode && bestNode.data.nodeType !== 'feature' && (!bestNode.data.parentNodeId || bestNode.data.parentNodeId === 'Universe')) {
      const featureChildren = themeNodes.filter(child => child.data.nodeType === 'feature' && child.data.parentNodeId === bestNode.id);
      for (const featureChild of featureChildren) {
        const featureName = featureChild.placeName;
        const normalizedFeatureName = normalizeStringForMatching(featureName);
        const directlyMentionedChunk = extractedChunks.find(chunk => chunk.prepositionType === 'direct' && normalizeStringForMatching(chunk.phrase).includes(normalizedFeatureName));
        if (directlyMentionedChunk) { bestMatchNodeId = featureChild.id; break; }
      }
    }
  }
  return bestMatchNodeId;
};
