
/**
 * @file promptFormatters.ts
 * @description Utility functions for creating well-structured AI prompts from game state data.
 */

import { Item, Character, FullGameState, AdventureTheme, ThemeMemory, MapData, MapNode, MapEdge, ThemeHistoryState } from '../types';

export const formatInventoryForPrompt = (inventory: Item[]): string => {
  if (inventory.length === 0) return "Empty."; 
  return inventory.map(item => {
    let itemStr = `"${item.name}" (Type: ${item.type}, Description: ${item.isActive && item.activeDescription ? item.activeDescription : item.description}, Active: ${!!item.isActive}, Junk: ${!!item.isJunk})`;
    if (item.knownUses && item.knownUses.length > 0) {
      const applicableUses = item.knownUses.filter(ku => {
        const isActive = !!item.isActive;
        if (ku.appliesWhenActive !== undefined && ku.appliesWhenInactive !== undefined) {
            return (ku.appliesWhenActive && isActive) || (ku.appliesWhenInactive && !isActive);
        }
        if (ku.appliesWhenActive !== undefined) return ku.appliesWhenActive === isActive;
        if (ku.appliesWhenInactive !== undefined) return ku.appliesWhenInactive === !isActive;
        return true;
      });
      if (applicableUses.length > 0) {
        itemStr += `, Available Actions: [${applicableUses.map(ku => `"${ku.actionName}" (triggers: "${ku.promptEffect}")`).join(', ')}]`;
      }
    }
    return itemStr;
  }).join("\n - ");
};

/**
 * Formats a list of MapNode objects (expected to be main nodes) for AI prompts.
 * @param {MapNode[]} mapNodes - Array of MapNode objects (should be filtered for main nodes of the current theme).
 * @param {boolean} detailed - If true, includes descriptions and aliases from MapNode.data.
 * @returns {string} A formatted string listing the place names and optionally their details.
 */
export const formatKnownPlacesForPrompt = (mapNodes: MapNode[], detailed: boolean = false): string => {
  const mainNodes = mapNodes.filter(node => !node.data.isLeaf); // Ensure we are only formatting main nodes
  if (mainNodes.length === 0) {
    return "None specifically known in this theme yet."; 
  }
  if (detailed) {
    return mainNodes.map(node => {
      let detailStr = `"${node.placeName}"`;
      if (node.data.aliases && node.data.aliases.length > 0) {
        detailStr += ` (aliases: ${node.data.aliases.map(a => `"${a}"`).join(', ')})`;
      }
      // Main nodes get their description from MapNode.data.description
      detailStr += ` - Description: "${node.data.description || 'No description available.'}"`;
      return detailStr;
    }).join('; ') + ".";
  } else {
    return mainNodes.map(node => {
      let detailStr = `"${node.placeName}"`;
      if (node.data.aliases && node.data.aliases.length > 0) {
        detailStr += ` (aliases: ${node.data.aliases.map(a => `"${a}"`).join(', ')})`;
      }
      return detailStr;
    }).join(', ') + ".";
  }
};


export const formatKnownCharactersForPrompt = (characters: Character[], detailed: boolean = false): string => {
  if (characters.length === 0) {
    return "None specifically known in this theme yet.";
  }

  if (detailed) {
    const formatSingleCharacterDetailed = (c: Character): string => {
      let details = `"${c.name}"`;
      if (c.aliases && c.aliases.length > 0) {
        details += ` (aliases: ${c.aliases.map(a => `"${a}"`).join(', ')})`;
      }
      details += ` (Status: ${c.presenceStatus}`;
      if (c.presenceStatus === 'companion' || c.presenceStatus === 'nearby') {
        details += `, ${c.preciseLocation || (c.presenceStatus === 'companion' ? 'with you' : 'nearby')}`;
      } else {
        details += `, Last Location: ${c.lastKnownLocation || 'Unknown'}`;
      }
      details += `) - Description: "${c.description}"`;
      return details;
    };
    return characters.map(formatSingleCharacterDetailed).join('; ') + ".";
  } else {
    const companions = characters.filter(c => c.presenceStatus === 'companion');
    const nearbyCharacters = characters.filter(c => c.presenceStatus === 'nearby');
    const otherKnownCharacters = characters.filter(c => c.presenceStatus === 'distant' || c.presenceStatus === 'unknown');

    let promptParts: string[] = [];

    if (companions.length > 0) {
      const companionStrings = companions.map(c => `"${c.name}" (${c.preciseLocation || 'with player'})`);
      promptParts.push(`Companions traveling with the Player: ${companionStrings.join(', ')}.`);
    }

    if (nearbyCharacters.length > 0) {
      const nearbyStrings = nearbyCharacters.map(c => `"${c.name}" (${c.preciseLocation || 'in the vicinity'})`);
      promptParts.push(`Characters Player can interact with (nearby): ${nearbyStrings.join(', ')}.`);
    }

    if (otherKnownCharacters.length > 0) {
      const otherStrings = otherKnownCharacters.map(c => {
        let statusDetail = `Status: ${c.presenceStatus}`;
        if (c.lastKnownLocation && c.lastKnownLocation !== "Unknown") {
          statusDetail += `, Last known location: ${c.lastKnownLocation}`;
        } else {
          statusDetail += `, Location Unknown`;
        }
        return `"${c.name}" (${statusDetail})`;
      });
      promptParts.push(`Other known characters: ${otherStrings.join(', ')}.`);
    }
    
    return promptParts.length > 0 ? promptParts.join("\n") : "None specifically known in this theme yet.";
  }
};

export const formatRecentEventsForPrompt = (logMessages: string[]): string => {
  if (logMessages.length === 0) {
    return "\n";
  }
  return "\n- " + logMessages.join("\n- ") + "\n";
};

export const formatDetailedContextForMentionedEntities = (
  allKnownMainMapNodes: MapNode[], 
  allKnownCharacters: Character[],
  contextString: string,
  placesPrefixIfAny: string,
  charactersPrefixIfAny: string
): string => {
  const mentionedPlaces: MapNode[] = [];
  allKnownMainMapNodes.forEach(node => {
    const allNames = [node.placeName, ...(node.data.aliases || [])];
    const nameRegex = new RegExp(allNames.map(name => `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    if (nameRegex.test(contextString)) {
      mentionedPlaces.push(node);
    }
  });

  const mentionedCharacters: Character[] = [];
  allKnownCharacters.forEach(c => {
    const allNames = [c.name, ...(c.aliases || [])];
    const nameRegex = new RegExp(allNames.map(name => `\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).join('|'), 'i');
    if (nameRegex.test(contextString)) {
      mentionedCharacters.push(c);
    }
  });

  let detailedContext = "";
  const formattedMentionedPlaces = formatKnownPlacesForPrompt(mentionedPlaces, true);
  if (formattedMentionedPlaces && formattedMentionedPlaces !== "None specifically known in this theme yet.") {
    detailedContext += `\n${placesPrefixIfAny}\n${formattedMentionedPlaces}`;
  }

  const formattedMentionedCharacters = formatKnownCharactersForPrompt(mentionedCharacters, true);
  if (formattedMentionedCharacters && formattedMentionedCharacters !== "None specifically known in this theme yet.") {
    detailedContext += `\n${charactersPrefixIfAny}\n${formattedMentionedCharacters}`;
  }
  return detailedContext.trimStart(); 
};

const getEdgeStatusScore = (status: MapEdge['data']['status']): number => {
    const scores: { [key: string]: number } = {
      'open': 10,
      'accessible': 9,
      'active': 8,
      // undefined status is considered neutral/good
      'temporary_bridge': 6, // Assuming active if listed
      'secret_passage': 5,   // Assuming accessible if listed
      'door': 4,             // Generic door, state might be implied by other statuses
      'rumored': 3,
      'closed': 2,
      'locked': 1,
      'blocked': 0,
      'inactive': -1,
    };
    return status ? (scores[status] ?? 0) : 7; // Default score for undefined status
};

const NON_DISPLAYABLE_EDGE_STATUSES: Array<MapEdge['data']['status'] | undefined> =
  ['collapsed', 'hidden', 'removed'];

/**
 * Helper function to get formatted connection strings from a given perspective node.
 * @param perspectiveNode - The node from which paths are being sought.
 * @param allThemeNodes - All nodes in the current theme.
 * @param allThemeEdges - All edges in the current theme.
 * @param excludeTargetId - An optional ID of a target node to specifically exclude from being listed as a destination.
 * @param processedTargets - A Set to track target node IDs already processed to avoid duplicates.
 * @returns An array of formatted path strings.
 */
const getFormattedConnectionsForNode = (
  perspectiveNode: MapNode,
  allThemeNodes: MapNode[],
  allThemeEdges: MapEdge[],
  excludeTargetId: string | null,
  processedTargets: Set<string>
): string[] => {
  const connectedEdges = allThemeEdges.filter(edge =>
    edge.sourceNodeId === perspectiveNode.id || edge.targetNodeId === perspectiveNode.id
  );

  const uniqueDestinations: { [targetNodeId: string]: MapEdge[] } = {};

  connectedEdges.forEach(edge => {
    const otherNodeId = edge.sourceNodeId === perspectiveNode.id ? edge.targetNodeId : edge.sourceNodeId;
    if (otherNodeId === excludeTargetId || processedTargets.has(otherNodeId)) {
      return;
    }
    if (!uniqueDestinations[otherNodeId]) {
      uniqueDestinations[otherNodeId] = [];
    }
    uniqueDestinations[otherNodeId].push(edge);
  });

  const formattedPaths: string[] = [];

  for (const targetNodeId in uniqueDestinations) {
    const candidateEdgesToTarget = uniqueDestinations[targetNodeId];

    const validCandidateEdges = candidateEdgesToTarget.filter(edge => {
      if (edge.data.status && NON_DISPLAYABLE_EDGE_STATUSES.includes(edge.data.status)) {
        return false;
      }
      if (edge.data.status === 'one_way' && edge.targetNodeId === perspectiveNode.id) {
        return false; 
      }
      return true;
    });

    if (validCandidateEdges.length === 0) continue;

    validCandidateEdges.sort((edgeA, edgeB) => {
      const scoreA = (edgeA.sourceNodeId === perspectiveNode.id ? 100 : 0) + getEdgeStatusScore(edgeA.data.status);
      const scoreB = (edgeB.sourceNodeId === perspectiveNode.id ? 100 : 0) + getEdgeStatusScore(edgeB.data.status);
      return scoreB - scoreA; 
    });
    const bestEdge = validCandidateEdges[0];

    const otherNode = allThemeNodes.find(node => node.id === targetNodeId);
    if (!otherNode) continue;

    let pathString: string;
    const detailsArray: string[] = [];
    const statusText = bestEdge.data.status || "open";

    const isPerspectiveMainToItsLeafChildContainment =
        bestEdge.data.type === 'containment' &&
        !perspectiveNode.data.isLeaf &&
        otherNode.data.isLeaf &&
        otherNode.data.parentNodeId === perspectiveNode.id;

    const isPerspectiveLeafToOtherLeafContainment =
        bestEdge.data.type === 'containment' &&
        perspectiveNode.data.isLeaf &&
        otherNode.data.isLeaf;
    
    const isPerspectiveLeafToItsParentContainment = 
        bestEdge.data.type === 'containment' &&
        perspectiveNode.data.isLeaf &&
        // !otherNode.data.isLeaf && // Parent can now be a leaf
        perspectiveNode.data.parentNodeId === otherNode.id;

    if (isPerspectiveLeafToItsParentContainment) { 
        processedTargets.add(targetNodeId); 
        continue;
    }


    if (isPerspectiveMainToItsLeafChildContainment) {
      pathString = `- Nearby feature: "${otherNode.placeName}" (within "${perspectiveNode.placeName}")`;
      if (statusText !== 'open') detailsArray.push(`status: ${statusText}`);
    } else if (isPerspectiveLeafToOtherLeafContainment) {
      pathString = `- Direct connection to: "${otherNode.placeName}"`;
      if (statusText !== 'open') detailsArray.push(`status: ${statusText}`);
      if (bestEdge.data.type && bestEdge.data.type !== 'containment') {
          detailsArray.push(`type: ${bestEdge.data.type}`);
      } else if (bestEdge.data.type === 'containment' && detailsArray.length === 0 && !(bestEdge.data.travelTime || bestEdge.data.description)) {
          // No type shown if just "open containment"
      } else if (bestEdge.data.type) {
          detailsArray.push(`type: ${bestEdge.data.type}`);
      }
      if (bestEdge.data.travelTime) detailsArray.push(`travel time: ${bestEdge.data.travelTime}`);
      if (bestEdge.data.description) detailsArray.push(bestEdge.data.description);
    } else {
      const connectionDescription = `from "${perspectiveNode.placeName}" to "${otherNode.placeName}"`;
      pathString = `- `;
      pathString += statusText + " ";
      pathString += (bestEdge.data.type || "connection") + " ";
      pathString += connectionDescription;
      if (bestEdge.data.description) detailsArray.push(bestEdge.data.description);
      if (bestEdge.data.travelTime) detailsArray.push(`travel time: ${bestEdge.data.travelTime}`);
    }

    if (detailsArray.length > 0) pathString += ` (${detailsArray.join(', ')})`;
    pathString += ".";
    
    formattedPaths.push(pathString);
    processedTargets.add(targetNodeId);
  }
  return formattedPaths;
};

/**
 * Finds reachable node IDs within a specified number of hops.
 * @param startNodeId The ID of the node to start searching from.
 * @param maxHops The maximum number of hops to explore.
 * @param allNodes All map nodes in the current theme.
 * @param allEdges All map edges in the current theme.
 * @param typesToInclude Optional array to filter included node types ('node' or 'leaf').
 * @param typesToTraverse Optional array to filter traversable node types ('node' | 'leaf').
 * @returns A Set of node IDs reachable within maxHops, excluding the startNodeId, filtered by types.
 */
const getNearbyNodeIds = (
  startNodeId: string,
  maxHops: number,
  allNodes: MapNode[],
  allEdges: MapEdge[],
  typesToInclude?: ('node' | 'leaf')[],
  typesToTraverse?: ('node' | 'leaf')[]
): Set<string> => {
  const allReachableNodeIds = new Set<string>();
  const queue: { nodeId: string; hop: number }[] = [{ nodeId: startNodeId, hop: 0 }];
  const visitedForHops = new Set<string>(); 
  const allowedEdgeStatuses: Array<MapEdge['data']['status']> = ['open', 'accessible', 'active'];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    if (visitedForHops.has(current.nodeId) && current.nodeId !== startNodeId) continue;
    visitedForHops.add(current.nodeId);

    if (current.nodeId !== startNodeId) {
      allReachableNodeIds.add(current.nodeId);
    }

    if (current.hop < maxHops) {
      const connectedEdges = allEdges.filter(edge =>
        (edge.sourceNodeId === current.nodeId || edge.targetNodeId === current.nodeId) &&
        allowedEdgeStatuses.includes(edge.data.status)
      );

      for (const edge of connectedEdges) {
        const neighborNodeId = edge.sourceNodeId === current.nodeId ? edge.targetNodeId : edge.sourceNodeId;
        if (!visitedForHops.has(neighborNodeId)) {
          const neighborNode = allNodes.find(n => n.id === neighborNodeId);
          if (neighborNode) {
            const neighborNodeType = neighborNode.data.isLeaf ? 'leaf' : 'node';
            if (typesToTraverse && typesToTraverse.length > 0 && !typesToTraverse.includes(neighborNodeType)) {
              continue; // Skip traversal through this node type
            }
            queue.push({ nodeId: neighborNodeId, hop: current.hop + 1 });
          }
        }
      }
    }
  }

  if (typesToInclude && typesToInclude.length > 0) {
    const filteredReachableNodeIds = new Set<string>();
    for (const nodeId of allReachableNodeIds) {
      const node = allNodes.find(n => n.id === nodeId);
      if (node) {
        const nodeType = node.data.isLeaf ? 'leaf' : 'node';
        if (typesToInclude.includes(nodeType)) {
          filteredReachableNodeIds.add(nodeId);
        }
      }
    }
    return filteredReachableNodeIds;
  }

  return allReachableNodeIds;
};


/**
 * Formats the current map context for the AI prompt.
 * Describes the player's current node, possible exits to other main areas, available paths, and nearby locations.
 * @param {MapData} mapData - The complete map data.
 * @param {string | null} currentMapNodeId - The ID of the player's current map node.
 * @param {AdventureTheme | null} currentTheme - The current theme object.
 * @param {MapNode[]} allNodesForTheme - Pre-filtered list of all map nodes for the current theme.
 * @param {MapEdge[]} allEdgesForTheme - Pre-filtered list of all map edges for the current theme.
 * @returns {string} A text description of the local map context including exits and nearby locations.
 */
export const formatMapContextForPrompt = (
  mapData: MapData, 
  currentMapNodeId: string | null,
  currentTheme: AdventureTheme | null, 
  allNodesForTheme: MapNode[],
  allEdgesForTheme: MapEdge[] 
): string => {
  if (!currentMapNodeId || !currentTheme) {
    return "Player's precise map location is currently unknown or they are between known locations.";
  }

  const currentNode = allNodesForTheme.find(node => node.id === currentMapNodeId);
  if (!currentNode) {
    return "";
  }

  let context = `You are currently at: "${currentNode.placeName}".`;
  if (currentNode.data.description) {
    context += ` - ${currentNode.data.description}.`;
  }
  if (currentNode.data.status) context += ` Status: ${currentNode.data.status}.`;
  
  const parentNodeForCurrent = currentNode.data.isLeaf && currentNode.data.parentNodeId 
    ? allNodesForTheme.find(n => n.id === currentNode.data.parentNodeId) 
    : null;

  if (parentNodeForCurrent) {
    if (parentNodeForCurrent.data.isLeaf) {
        context += ` This is a feature of "${parentNodeForCurrent.placeName}".`;
    } else {
        context += ` This is part of the larger known location: "${parentNodeForCurrent.placeName}".`;
    }
  }
  context += "\n";

  const areaMainNodeId = currentNode.data.isLeaf ? currentNode.data.parentNodeId : currentNode.id;
  let exitsContext = "";
  if (areaMainNodeId) {
    const areaMainNode = allNodesForTheme.find(node => node.id === areaMainNodeId);
    if (areaMainNode && !areaMainNode.data.isLeaf) {
      const exitLeafNodesInCurrentArea = allNodesForTheme.filter(
        node => node.data.isLeaf && node.data.parentNodeId === areaMainNode.id
      );

      const exitStrings: string[] = [];
      if (exitLeafNodesInCurrentArea.length > 0) {
        for (const exitLeaf of exitLeafNodesInCurrentArea) {
          if (exitLeaf.id === currentNode.id) continue;
          for (const edge of allEdgesForTheme) {
            if (edge.sourceNodeId !== exitLeaf.id && edge.targetNodeId !== exitLeaf.id) continue;
            if (NON_DISPLAYABLE_EDGE_STATUSES.includes(edge.data.status)) continue;
            const otherEndNodeId = edge.sourceNodeId === exitLeaf.id ? edge.targetNodeId : edge.sourceNodeId;
            const entryLeaf = allNodesForTheme.find(node => node.id === otherEndNodeId);
            if (entryLeaf && entryLeaf.data.isLeaf && entryLeaf.data.parentNodeId && entryLeaf.data.parentNodeId !== areaMainNode.id) {
              const otherAreaMainNode = allNodesForTheme.find(node => node.id === entryLeaf.data.parentNodeId && !node.data.isLeaf);
              if (otherAreaMainNode) {
                const edgeStatus = edge.data.status || "open";
                const edgeType = edge.data.type || "path";
                exitStrings.push(
                  `- '${edgeStatus} ${edgeType}' exit at '${exitLeaf.placeName}', leading to '${otherAreaMainNode.placeName}' via '${entryLeaf.placeName}'.`
                );
              }
            }
          }
        }
      }
      if (exitStrings.length > 0) {
        exitsContext = "Possible Exits from Current Main Area (" + areaMainNode.placeName + "):\n" + exitStrings.join("\n");
      } else {
        exitsContext = `No mapped exits from the current main area ("${areaMainNode.placeName}") to other major areas are known.`;
      }
    } else if (areaMainNode && areaMainNode.data.isLeaf) {
        exitsContext = `You are at a detailed feature ("${areaMainNode.placeName}"). Connections to other major areas are listed below if available.`;
    }
  } else {
    exitsContext = "Current location is not part of a larger mapped area.";
  }
  context += exitsContext + "\n\n";
  
  const processedTargets = new Set<string>();
  const excludeForCurrentNode = currentNode.data.isLeaf && parentNodeForCurrent ? parentNodeForCurrent.id : null;
  let pathsFromCurrentNode = getFormattedConnectionsForNode(
    currentNode, allNodesForTheme, allEdgesForTheme, excludeForCurrentNode, processedTargets
  );

  let pathsFromParentNode: string[] = [];
  if (parentNodeForCurrent) {
    pathsFromParentNode = getFormattedConnectionsForNode(
      parentNodeForCurrent, allNodesForTheme, allEdgesForTheme, currentNode.id, processedTargets
    );
  }

  if (pathsFromCurrentNode.length > 0) {
    context += "Paths leading directly from your current spot (" + currentNode.placeName + "):\n" + pathsFromCurrentNode.join("\n");
  }

  if (pathsFromParentNode.length > 0 && parentNodeForCurrent) {
    if (pathsFromCurrentNode.length > 0) context += "\n\n"; 
    context += `Additional paths and features within or connected to "${parentNodeForCurrent.placeName}":\n` + pathsFromParentNode.join("\n");
  }
  context += "\n";


  const nearbyNodeIds = getNearbyNodeIds(currentNode.id, 2, allNodesForTheme, allEdgesForTheme); 
  if (nearbyNodeIds.size > 0) {
    const nearbyNodeNames = Array.from(nearbyNodeIds)
      .map(id => allNodesForTheme.find(n => n.id === id)?.placeName)
      .filter(name => !!name)
      .map(name => `"${name}"`);
    
    if (nearbyNodeNames.length > 0) {
      context += `\nLocations nearby (within two hops): ${nearbyNodeNames.join(', ')}.`;
    }
  }

  return context.trim();
};


// --- Main Turn Formatters ---

export const formatNewGameFirstTurnPrompt = (theme: AdventureTheme, playerGender: string): string => {
  let prompt = `Start a new adventure in the theme "${theme.name}".
Player's Character Gender: "${playerGender}"
Suggested Initial Scene: "${theme.initialSceneDescriptionSeed}" (Adjust to add variely)
Suggested Initial Main Quest: "${theme.initialMainQuest}" (Adjust to add variely)
Suggested Initial Current Objective: "${theme.initialCurrentObjective}" (Adjust to add variely)
Suggested Initial Inventory to be granted: "${theme.initialItems}" (Adjust the names and descriptions to add variely)

Last player's action was unremarkable, something very common, what people do in the described situation.

Creatively enerate the variation of the mainQuest and currentObjective, based on the suggested Quest and Objective, but noticeably different.
Creatively generate the initial scene description, action options, items (variation based on 'Initial Inventory to be granted') and logMessage.
Creatively add possible important quest item(s), if any, based on your generated Quest and Objective.
Set "mapUpdated": true if your generated Scene, Quest or Objective mention specific locations that should be on the map.
Of all the optional variables, your response MUST include at least the "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};

export const formatNewThemePostShiftPrompt = (
  theme: AdventureTheme, 
  inventory: Item[], 
  playerGender: string
): string => {
  const inventoryPrompt = formatInventoryForPrompt(inventory);
  let prompt = `The player is entering a NEW theme "${theme.name}" after a reality shift.
Player's Character Gender: "${playerGender}"
Initial Scene: "${theme.initialSceneDescriptionSeed}" (Adapt this to an arrival scene, describing the disorienting transition).
Main Quest: "${theme.initialMainQuest}" (Adjust to add variely)
Current Objective: "${theme.initialCurrentObjective}" (Adjust to add variely)

Player's Current Inventory (brought from previous reality or last visit):\n - ${inventoryPrompt}
IMPORTANT: 
- EXAMINE the player's Current Inventory for any items that are CLEARLY ANACHRONISTIC for the theme "${theme.name}".
- If anachronistic items are found, TRANSFORM them into thematically appropriate equivalents using an "itemChange" "update" action with "newName", "type", and "description". Creatively explain this transformation in the "logMessage". Refer to ITEMS_GUIDE for anachronistic item handling.
- If no items are anachronistic, no transformation is needed.

Generate the scene description for a disoriented arrival, and provide appropriate initial action options for the player to orient themselves.
The response MUST include at least the "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
Set "mapUpdated": true if your generated Scene, Quest or Objective mention specific locations that should be on a map.
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};

export const formatReturnToThemePostShiftPrompt = (
  theme: AdventureTheme, 
  inventory: Item[], 
  playerGender: string,
  themeMemory: ThemeMemory,
  mapDataForTheme: MapData, 
  allCharactersForTheme: Character[]
): string => {
  const inventoryPrompt = formatInventoryForPrompt(inventory);
  const currentThemeMainMapNodes = mapDataForTheme.nodes.filter(n => n.themeName === theme.name && !n.data.isLeaf);
  
  const placesContext = formatKnownPlacesForPrompt(currentThemeMainMapNodes, false); 
  const charactersContext = formatKnownCharactersForPrompt(allCharactersForTheme, false);

  let prompt = `The player is CONTINUING their adventure by re-entering the theme "${theme.name}" after a reality shift.
Player's Character Gender: "${playerGender}"
The Adventure Summary: "${themeMemory.summary}"
Main Quest: "${themeMemory.mainQuest}"
Current Objective: "${themeMemory.currentObjective}"

Player's Current Inventory (brought from previous reality or last visit):\n - ${inventoryPrompt}
IMPORTANT: 
- EXAMINE the player's Current Inventory for any items that are CLEARLY ANACHRONISTIC for the theme "${theme.name}".
- If anachronistic items are found, TRANSFORM them into thematically appropriate equivalents using an "itemChange" "update" action with "newName", "type", and "description". Creatively explain this transformation in the "logMessage". Refer to ITEMS_GUIDE for anachronistic item handling.
- CRITICALLY IMPORTANT: ALWAYS transform some items into important quest items you must have already had in this reality, based on Main Quest, Current Objective, or the Adventure Summary even if they are NOT anachronistic, using an "itemChange" "update" action with "newName", "type", "description". Creatively explain this transformation in the "logMessage".

Known Locations: ${placesContext}
Known Characters (including presence): ${charactersContext}

Describe the scene as they re-enter, potentially in a state of confusion from the shift, making it feel like a continuation or a new starting point consistent with the Adventure Summary and current quest/objective.
Provide appropriate action options for the player to orient themselves.
The response MUST include at least the "mainQuest", "currentObjective", "localTime", "localEnvironment", and "localPlace".
Set "mapUpdated": true if your generated Scene, Quest or Objective mention specific locations that should be on a map or if existing map information needs updating based on the re-entry context.
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};

export const formatMainGameTurnPrompt = (
  currentScene: string,
  playerAction: string,
  inventory: Item[],
  mainQuest: string | null,
  currentObjective: string | null,
  currentTheme: AdventureTheme, // Changed to AdventureTheme
  recentLogEntries: string[],
  currentThemeMainMapNodes: MapNode[], 
  currentThemeCharacters: Character[],
  localTime: string | null,
  localEnvironment: string | null,
  localPlace: string | null,
  playerGender: string,
  themeHistory: ThemeHistoryState, 
  currentMapNodeDetails: MapNode | null, 
  fullMapData: MapData 
): string => {
  const inventoryPrompt = formatInventoryForPrompt(inventory);
  const placesContext = formatKnownPlacesForPrompt(currentThemeMainMapNodes, true); 
  const charactersContext = formatKnownCharactersForPrompt(currentThemeCharacters, true); 
  const recentEventsContext = formatRecentEventsForPrompt(recentLogEntries);
  
  const allNodesForCurrentTheme = fullMapData.nodes.filter(node => node.themeName === currentTheme.name);
  const allEdgesForCurrentTheme = fullMapData.edges.filter(edge => {
      const sourceNode = allNodesForCurrentTheme.find(n => n.id === edge.sourceNodeId);
      const targetNode = allNodesForCurrentTheme.find(n => n.id === edge.targetNodeId);
      return sourceNode && targetNode;
  });
  const mapContext = formatMapContextForPrompt(fullMapData, currentMapNodeDetails?.id || null, currentTheme, allNodesForCurrentTheme, allEdgesForCurrentTheme);
  
  const detailedEntityContext = formatDetailedContextForMentionedEntities(
    currentThemeMainMapNodes, 
    currentThemeCharacters, 
    `${currentScene} ${playerAction}`, 
    "Details on relevant map nodes (locations/features) mentioned in current scene or action:", 
    "Details on relevant characters mentioned in current scene or action:"
  );

  let prompt = `** Context:
Player's Character Gender: "${playerGender}"
Previous Local Time: "${localTime || 'Unknown'}"
Previous Local Environment: "${localEnvironment || 'Undetermined'}"
Previous Local Place: "${localPlace || 'Undetermined Location'}"
Main Quest: "${mainQuest || 'Not set'}"
Current Objective: "${currentObjective || 'Not set'}"
Current Inventory:\n - ${inventoryPrompt}
Known Locations: ${placesContext}
Known Characters: ${charactersContext}

Current Map Context (including your location, possible exits, nearby paths, and other nearby locations): 
${mapContext}

${detailedEntityContext}

Recent Events to keep in mind (provided ONLY for extra context, these actions have already been processed):
${recentEventsContext}
---

Current Theme: "${currentTheme.name}"
Previous Scene: "${currentScene}"
Player Action: "${playerAction}"

Based on the Previous Scene and Player Action, and taking into account the provided historical and environmental context (including map context and possible exits):
Generate the next scene description, options, item changes, log message, etc.
Compare the new Local Place of the character to the precise locations of relevant characters, and update their presence state accordingly.
For example, leaving character's location makes them "distant", entering character's location makes them 'nearby' if they are still there, or 'unknown', is they moved while the player was not there.
If a Companion leaves the Player, or the Player leaves a Companion, their presence status changes to 'nearby' or, sometimes, 'distant', depending on context.
The response MUST include "localTime", "localEnvironment", and "localPlace".
If "mainQuest" or "currentObjective" change, they MUST be provided. Otherwise, they are optional.
If "localPlace" corresponds to a location in "Locations Nearby", always set "currentMapNodeId" to the name of that location.
If the narrative implies any changes to the map (new details, locations, connections, status changes), set "mapUpdated": true.
Adhere to all rules in the SYSTEM_INSTRUCTION for character and presence management using "charactersAdded" and "charactersUpdated", and for item management using "itemChange".
Ensure the response adheres to the JSON structure specified in the SYSTEM_INSTRUCTION.`;
  return prompt;
};
