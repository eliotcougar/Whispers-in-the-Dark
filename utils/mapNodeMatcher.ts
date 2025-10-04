
/**
 * @file mapNodeMatcher.ts
 * @description Utility functions for matching a local place description to the most relevant map node.
 */

import { AdventureTheme, MapData, MapNode } from '../types'; // Removed Place
import { ROOT_MAP_NODE_ID } from '../constants';

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

const tokenizeText = (text: string | null | undefined): Array<string> => {
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

const parseLocalPlaceIntoChunks = (localPlace: string | null | undefined): Array<ExtractedChunk> => {
  if (!localPlace || localPlace.trim() === "") return [];
  const chunks: Array<ExtractedChunk> = [];
  const regexPattern = `\\b(?:${ALL_PREPOSITION_KEYWORDS_FOR_REGEX.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`;
  const splitterRegex = new RegExp(regexPattern, 'gi');
  
  const prepMatches: Array<{ index: number; text: string; originalText: string, definition: PrepositionDefinition }> = [];
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
  return chunks.filter(chunk => chunk.phrase.length > 0);
};

const PROXIMITY_BONUS = 30;
const EXACT_MATCH_FEATURE_BONUS = 10;

interface NodeSemanticTokens {
  node: MapNode;
  nameTokenPairs: Array<{ name: string; tokens: Array<string> }>;
}

export const tokenizeForMatching = tokenizeText;

interface Candidate {
  nodeId: string;
  score: number;
}

const scoreExactMatchCandidates = (
  normalizedLocalPlace: string,
  tokenizedLocalPlace: string,
  nodes: Array<MapNode>,
): Array<ExactMatchCandidate> => {
  const matches: Array<ExactMatchCandidate> = [];
  for (const node of nodes) {
    const nodeNamesAndAliases: Array<string> = [node.placeName, ...(node.data.aliases ?? [])];
    for (const nameOrAlias of nodeNamesAndAliases.filter(name => name && name.trim() !== '')) {
      const normName = normalizeStringForMatching(nameOrAlias);
      const tokenizedName = tokenizeForMatching(nameOrAlias).join(' ');
      let currentMatchScore = 0;
      if (normName === normalizedLocalPlace) currentMatchScore = 1000;
      else if (normalizedLocalPlace.endsWith(normName) && normalizedLocalPlace.length > normName.length) currentMatchScore = 950;
      else if (normalizedLocalPlace.startsWith(normName) && normalizedLocalPlace.length > normName.length) currentMatchScore = 920;
      else if (tokenizedName && tokenizedLocalPlace && tokenizedName === tokenizedLocalPlace) currentMatchScore = 900;
      else if (normalizedLocalPlace.includes(normName) && normName.length > 0) {
        currentMatchScore = 800 + (normName.length * 0.5);
      }
      if (currentMatchScore > 0) {
        const isFeatureNode = node.data.nodeType === 'feature';
        matches.push({
          nodeId: node.id,
          score: currentMatchScore + (isFeatureNode ? EXACT_MATCH_FEATURE_BONUS : 0),
          isFeature: isFeatureNode,
          nameLength: nameOrAlias.length,
        });
      }
    }
  }
  return matches;
};

export const computeSemanticMatchScore = (
  nodeTokens: NodeSemanticTokens,
  chunks: Array<ExtractedChunk>,
  directNeighborIds: Set<string>,
): number => {
  const { node, nameTokenPairs } = nodeTokens;
  let maxScoreForCandidate = -1;
  for (const { name, tokens: nodeNameTokens } of nameTokenPairs) {
    if (nodeNameTokens.length === 0) continue;
    let scoreForNameAlias = 0;
    for (const chunk of chunks) {
      const chunkTokens = tokenizeForMatching(chunk.phrase);
      if (chunkTokens.length === 0) continue;
      let commonTokenCount = 0;
      const tempChunkTokens = [...chunkTokens];
      nodeNameTokens.forEach(nnToken => {
        const exactIndex = tempChunkTokens.indexOf(nnToken);
        if (exactIndex !== -1) {
          commonTokenCount++;
          tempChunkTokens.splice(exactIndex, 1);
        } else {
          const pluralIndex = tempChunkTokens.findIndex(ct => areTokensSingularPluralMatch(nnToken, ct));
          if (pluralIndex !== -1) {
            commonTokenCount++;
            tempChunkTokens.splice(pluralIndex, 1);
          }
        }
      });
      if (commonTokenCount > 0) {
        const nodeCoverage = commonTokenCount / nodeNameTokens.length;
        const chunkRelevance = commonTokenCount / chunkTokens.length;
        let baseScore = (nodeCoverage * 60) + (chunkRelevance * 40);
        const normalizedNodeName = normalizeStringForMatching(name);
        const normalizedChunkPhrase = normalizeStringForMatching(chunk.phrase);
        let exactOrSubstringBonus = 0;
        if (normalizedNodeName === normalizedChunkPhrase) exactOrSubstringBonus = 100;
        else if (normalizedChunkPhrase.endsWith(normalizedNodeName) && normalizedChunkPhrase.length > normalizedNodeName.length) exactOrSubstringBonus = 75;
        else if (normalizedChunkPhrase.startsWith(normalizedNodeName) && normalizedChunkPhrase.length > normalizedNodeName.length) exactOrSubstringBonus = 70;
        else if (normalizedChunkPhrase.includes(normalizedNodeName)) exactOrSubstringBonus = 50 + (normalizedNodeName.length * 0.2);
        else if (normalizedNodeName.includes(normalizedChunkPhrase)) exactOrSubstringBonus = 25 + (normalizedChunkPhrase.length * 0.2);
        baseScore += exactOrSubstringBonus;
        const effectiveWeight = (chunk.prepositionType === 'negating' && baseScore > 75) ? chunk.prepositionWeight * 0.5 : chunk.prepositionWeight;
        scoreForNameAlias += baseScore * (effectiveWeight / 100.0);
      }
    }
    if (scoreForNameAlias > maxScoreForCandidate) maxScoreForCandidate = scoreForNameAlias;
  }
  if (maxScoreForCandidate > -1 && directNeighborIds.has(node.id)) maxScoreForCandidate += PROXIMITY_BONUS;
  return maxScoreForCandidate;
};

const applySemanticTieBreaker = (
  currentBest: Candidate | null,
  newCandidate: Candidate,
  nodes: Array<MapNode>,
): Candidate => {
  if (!currentBest) return newCandidate;
  if (newCandidate.score > currentBest.score) return newCandidate;
  if (newCandidate.score < currentBest.score) return currentBest;
  const newNode = nodes.find(n => n.id === newCandidate.nodeId);
  const bestNode = nodes.find(n => n.id === currentBest.nodeId);
  if (!newNode || !bestNode) return currentBest;
  const newIsFeature = newNode.data.nodeType === 'feature';
  const bestIsFeature = bestNode.data.nodeType === 'feature';
  if (newIsFeature && !bestIsFeature) return newCandidate;
  if (!newIsFeature && bestIsFeature) return currentBest;
  const newLen = normalizeStringForMatching(newNode.placeName).length;
  const bestLen = normalizeStringForMatching(bestNode.placeName).length;
  return newLen > bestLen ? newCandidate : currentBest;
};

const selectFeatureChildIfMentioned = (
  bestNodeId: string | null,
  chunks: Array<ExtractedChunk>,
  nodes: Array<MapNode>,
): string | null => {
  if (!bestNodeId) return null;
  const bestNode = nodes.find(n => n.id === bestNodeId);
  if (!bestNode) return bestNodeId;
  if (bestNode.data.nodeType === 'feature') return bestNodeId;
  if (bestNode.data.parentNodeId && bestNode.data.parentNodeId !== ROOT_MAP_NODE_ID) return bestNodeId;
  const featureChildren = nodes.filter(child => child.data.nodeType === 'feature' && child.data.parentNodeId === bestNode.id);
  for (const featureChild of featureChildren) {
    const featureName = featureChild.placeName;
    const normalizedFeatureName = normalizeStringForMatching(featureName);
    const directlyMentionedChunk = chunks.find(chunk => chunk.prepositionType === 'direct' && normalizeStringForMatching(chunk.phrase).includes(normalizedFeatureName));
    if (directlyMentionedChunk) return featureChild.id;
  }
  return bestNodeId;
};

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
 * @param themeName The name of the active theme.
 * @param themeNodesFromDraft All MapNode objects for the current theme from the draft game state.
 * @returns An object `{ matched: boolean, nodeId: string | null }`. 
 *          `matched` is true if a node was successfully matched, `nodeId` is its ID.
 */
export const attemptMatchAndSetNode = (
    suggestedIdentifier: string | undefined | null,
    source: 'mapAI' | 'mainAI',
    oldMapNodeIdIfAvailable: string | null,
    themeName: string,
    themeNodesFromDraft: Array<MapNode>
  ): { matched: boolean; nodeId: string | null } => {
  
    if (!suggestedIdentifier || suggestedIdentifier.trim() === "") {
      console.log(`MapNodeMatcher (${source}): No suggestion provided or suggestion is empty.`);
      return { matched: false, nodeId: null };
    }
  
    if (themeNodesFromDraft.length === 0) {
        console.log(`MapNodeMatcher (${source}): No nodes found for theme "${themeName}" in draft state.`);
        return { matched: false, nodeId: null };
    }
  
    // 1. Try to match by ID (exact match)
    const foundNodeById = themeNodesFromDraft.find(n => n.id === suggestedIdentifier);
    if (foundNodeById) {
      console.log(`MapNodeMatcher (${source}): AI suggested node ID "${suggestedIdentifier}", matched to ID "${foundNodeById.id}".`);
      return { matched: true, nodeId: foundNodeById.id };
    }

    const lowerId = suggestedIdentifier.toLowerCase();
    let partialIdMatch = themeNodesFromDraft.find(n => n.id.toLowerCase().includes(lowerId));

    const idPattern = /^(.*)-([a-zA-Z0-9]{4})$/;
    let extractedBase: string | null = null;
    if (!partialIdMatch) {
      const m = idPattern.exec(suggestedIdentifier);
      if (m) {
        const baseStr = m[1];
        extractedBase = baseStr;
        partialIdMatch = themeNodesFromDraft.find(n => n.id.toLowerCase().includes(baseStr.toLowerCase()));
      }
    }

    if (partialIdMatch) {
      console.log(`MapNodeMatcher (${source}): Heuristically matched malformed ID "${suggestedIdentifier}" to "${partialIdMatch.id}".`);
      return { matched: true, nodeId: partialIdMatch.id };
    }
  
    // 2. Try to match by Name or Alias (case-insensitive)
    const lowerSuggestedIdentifier = suggestedIdentifier.toLowerCase();
    const matchingNodesByNameOrAlias = themeNodesFromDraft.filter(n =>
      n.placeName.toLowerCase() === lowerSuggestedIdentifier ||
      (n.data.aliases?.some(alias => alias.toLowerCase() === lowerSuggestedIdentifier))
    );

    if (matchingNodesByNameOrAlias.length === 0) {
      const baseForNames = extractedBase ?? suggestedIdentifier;
      const normalizedBase = baseForNames.replace(/_/g, ' ').toLowerCase();
      matchingNodesByNameOrAlias.push(
        ...themeNodesFromDraft.filter(n =>
          n.placeName.toLowerCase() === normalizedBase ||
          (n.data.aliases?.some(a => a.toLowerCase() === normalizedBase)),
        ),
      );
    }
  
    if (matchingNodesByNameOrAlias.length === 0) {
      console.log(`MapNodeMatcher (${source}): AI suggested identifier "${suggestedIdentifier}" NOT found by ID, name, or alias within theme "${themeName}".`);
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
 * @param theme - The current active theme object.
 * @param mapData - Complete map graph data.
 * @param allNodesForTheme - Nodes belonging to the current theme.
 * @param previousMapNodeId - ID of the player's previous map node if any.
 * @returns The best matching node ID or null when no suitable match is found.
 */
export const selectBestMatchingMapNode = (
  localPlace: string | null,
  theme: AdventureTheme | null,
  mapData: MapData, // Full map data
  allNodesForTheme: Array<MapNode>, // Pre-filtered nodes for the current theme
  previousMapNodeId: string | null
): string | null => {
  if (!localPlace || !theme || allNodesForTheme.length === 0) {
    return null;
  }

  const themeNodes = allNodesForTheme; // Use pre-filtered nodes

  const firstCommaIndex = localPlace.indexOf(',');
  const localPlaceForEarlyMatch = (firstCommaIndex !== -1 ? localPlace.substring(0, firstCommaIndex) : localPlace).trim();
  const normalizedLocalPlaceForEarlyMatch = normalizeStringForMatching(localPlaceForEarlyMatch);
  const tokenizedLocalPlaceString = tokenizeForMatching(localPlace).join(' ');

  const exactMatches = scoreExactMatchCandidates(
    normalizedLocalPlaceForEarlyMatch,
    tokenizedLocalPlaceString,
    themeNodes,
  );

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

  let bestCandidate: Candidate | null = null;

  const directNeighborIds = new Set<string>();
  if (previousMapNodeId) {
    mapData.edges.forEach(edge => {
      if (edge.sourceNodeId === previousMapNodeId) directNeighborIds.add(edge.targetNodeId);
      else if (edge.targetNodeId === previousMapNodeId) directNeighborIds.add(edge.sourceNodeId);
    });
  }

  const nodesWithTokens: Array<NodeSemanticTokens> = themeNodes.map(n => ({
    node: n,
    nameTokenPairs: [n.placeName, ...(n.data.aliases ?? [])]
      .filter(name => name && name.trim() !== '')
      .map(name => ({ name, tokens: tokenizeForMatching(name) })),
  }));

  for (const nodeInfo of nodesWithTokens) {
    const score = computeSemanticMatchScore(nodeInfo, extractedChunks, directNeighborIds);
    if (score > -1) {
      const candidate: Candidate = { nodeId: nodeInfo.node.id, score };
      bestCandidate = applySemanticTieBreaker(bestCandidate, candidate, themeNodes);
    }
  }

  let bestMatchNodeId = bestCandidate ? bestCandidate.nodeId : null;
  if (bestCandidate && bestCandidate.score > 0) {
    bestMatchNodeId = selectFeatureChildIfMentioned(bestMatchNodeId, extractedChunks, themeNodes);
  }
  return bestMatchNodeId;
};
