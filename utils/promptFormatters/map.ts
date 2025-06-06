
/**
 * @file utils/promptFormatters/map.ts
 * @description Utilities for formatting map related context for AI prompts.
 */

import { AdventureTheme, MapData, MapNode, MapEdge } from '../../types';

/**
 * Formats a list of main map nodes for AI prompts.
 */
export const formatKnownPlacesForPrompt = (
  mapNodes: MapNode[],
  detailed: boolean = false
): string => {
  const mainNodes = mapNodes.filter(
    node => node.data.nodeType !== 'feature' && node.data.nodeType !== 'room'
  );
  if (mainNodes.length === 0) {
    return 'None specifically known in this theme yet.';
  }
  if (detailed) {
    return (
      mainNodes
        .map(node => {
          let detailStr = `"${node.placeName}"`;
          if (node.data.aliases && node.data.aliases.length > 0) {
            detailStr += ` (aliases: ${node.data.aliases.map(a => `"${a}"`).join(', ')})`;
          }
          detailStr += ` - Description: "${node.data.description || 'No description available.'}"`;
          return detailStr;
        })
        .join('; ') + '.'
    );
  }
  return (
    mainNodes
      .map(node => {
        let detailStr = `"${node.placeName}"`;
        if (node.data.aliases && node.data.aliases.length > 0) {
          detailStr += ` (aliases: ${node.data.aliases.map(a => `"${a}"`).join(', ')})`;
        }
        return detailStr;
      })
      .join(', ') + '.'
  );
};

const getEdgeStatusScore = (status: MapEdge['data']['status']): number => {
  const scores: { [key: string]: number } = {
    open: 10,
    accessible: 9,
    active: 8,
    temporary_bridge: 6,
    secret_passage: 5,
    door: 4,
    rumored: 3,
    closed: 2,
    locked: 1,
    blocked: 0,
    inactive: -1,
  };
  return status ? scores[status] ?? 0 : 7;
};

const NON_DISPLAYABLE_EDGE_STATUSES: Array<MapEdge['data']['status'] | undefined> = [
  'collapsed',
  'hidden',
  'removed',
];

/**
 * Helper function to get formatted connection strings from a perspective node.
 */
const getFormattedConnectionsForNode = (
  perspectiveNode: MapNode,
  allThemeNodes: MapNode[],
  allThemeEdges: MapEdge[],
  excludeTargetId: string | null,
  processedTargets: Set<string>
): string[] => {
  const connectedEdges = allThemeEdges.filter(
    edge => edge.sourceNodeId === perspectiveNode.id || edge.targetNodeId === perspectiveNode.id
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
    const statusText = bestEdge.data.status || 'open';

    pathString = `- Path to: "${otherNode.placeName}"`;
    if (statusText !== 'open') detailsArray.push(`status: ${statusText}`);
    if (bestEdge.data.type) detailsArray.push(`type: ${bestEdge.data.type}`);
    if (bestEdge.data.travelTime) detailsArray.push(`travel time: ${bestEdge.data.travelTime}`);
    if (bestEdge.data.description) detailsArray.push(bestEdge.data.description);

    if (detailsArray.length > 0) pathString += ` (${detailsArray.join(', ')})`;
    pathString += '.';
    formattedPaths.push(pathString);
    processedTargets.add(targetNodeId);
  }
  return formattedPaths;
};

/**
 * Finds reachable node IDs within a specified number of hops.
 */
const getNearbyNodeIds = (
  startNodeId: string,
  maxHops: number,
  allNodes: MapNode[],
  allEdges: MapEdge[],
  typesToInclude?: ('node' | 'feature')[],
  typesToTraverse?: ('node' | 'feature')[]
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
      const connectedEdges = allEdges.filter(
        edge =>
          (edge.sourceNodeId === current.nodeId || edge.targetNodeId === current.nodeId) &&
          allowedEdgeStatuses.includes(edge.data.status)
      );
      for (const edge of connectedEdges) {
        const neighborNodeId = edge.sourceNodeId === current.nodeId ? edge.targetNodeId : edge.sourceNodeId;
        if (!visitedForHops.has(neighborNodeId)) {
          const neighborNode = allNodes.find(n => n.id === neighborNodeId);
          if (neighborNode) {
            const neighborNodeType =
              neighborNode.data.nodeType === 'feature'
                ? 'feature'
                : 'node';
            if (typesToTraverse && typesToTraverse.length > 0 && !typesToTraverse.includes(neighborNodeType)) {
              continue;
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
        const nodeType = (node.data.nodeType === "feature" || node.data.nodeType === "room") ? 'feature' : 'node';
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
    return '';
  }

  let context = `You are currently at: "${currentNode.placeName}".`;
  if (currentNode.data.description) {
    context += ` - ${currentNode.data.description}.`;
  }
  if (currentNode.data.status) context += ` Status: ${currentNode.data.status}.`;

  const parentNodeForCurrent =
    currentNode.data.nodeType === 'feature' && currentNode.data.parentNodeId && currentNode.data.parentNodeId !== 'Universe'
      ? allNodesForTheme.find(n => n.id === currentNode.data.parentNodeId)
      : null;

  if (parentNodeForCurrent) {
    if (parentNodeForCurrent.data.nodeType === 'feature') {
      context += ` This is a feature of "${parentNodeForCurrent.placeName}".`;
    } else {
      context += ` This is part of the larger known location: "${parentNodeForCurrent.placeName}".`;
    }
  }
  context += '\n';

  const areaMainNodeId =
    currentNode.data.nodeType === 'feature'
      ? (currentNode.data.parentNodeId && currentNode.data.parentNodeId !== 'Universe' ? currentNode.data.parentNodeId : undefined)
      : currentNode.id;
  let exitsContext = '';
  if (areaMainNodeId) {
    const areaMainNode = allNodesForTheme.find(node => node.id === areaMainNodeId);
    if (areaMainNode && !(areaMainNode.data.nodeType === 'feature')) {
      const exitFeatureNodesInCurrentArea = allNodesForTheme.filter(
        node => node.data.nodeType === "feature" && node.data.parentNodeId === areaMainNode.id
      );
      const exitStrings: string[] = [];
      if (exitFeatureNodesInCurrentArea.length > 0) {
        for (const exitFeature of exitFeatureNodesInCurrentArea) {
          if (exitFeature.id === currentNode.id) continue;
          for (const edge of allEdgesForTheme) {
            if (edge.sourceNodeId !== exitFeature.id && edge.targetNodeId !== exitFeature.id) continue;
            if (NON_DISPLAYABLE_EDGE_STATUSES.includes(edge.data.status)) continue;
            const otherEndNodeId = edge.sourceNodeId === exitFeature.id ? edge.targetNodeId : edge.sourceNodeId;
            const entryFeature = allNodesForTheme.find(node => node.id === otherEndNodeId);
            if (
              entryFeature &&
              entryFeature.data.nodeType === 'feature' &&
              entryFeature.data.parentNodeId &&
              entryFeature.data.parentNodeId !== areaMainNode.id &&
              entryFeature.data.parentNodeId !== 'Universe'
            ) {
              const otherAreaMainNode = allNodesForTheme.find(
                node => node.id === entryFeature.data.parentNodeId && !(node.data.nodeType === "feature")
              );
              if (otherAreaMainNode) {
                const edgeStatus = edge.data.status || 'open';
                const edgeType = edge.data.type || 'path';
                exitStrings.push(
                  `- '${edgeStatus} ${edgeType}' exit at '${exitFeature.placeName}', leading to '${otherAreaMainNode.placeName}' via '${entryFeature.placeName}'.`
                );
              }
            }
          }
        }
      }
      if (exitStrings.length > 0) {
        exitsContext =
          'Possible Exits from Current Main Area (' + areaMainNode.placeName + "):\n" + exitStrings.join('\n');
      } else {
        exitsContext = `No mapped exits from the current main area ("${areaMainNode.placeName}") to other major areas are known.`;
      }
    } else if (areaMainNode && (areaMainNode.data.nodeType === 'feature')) {
      exitsContext = `You are at a detailed feature ("${areaMainNode.placeName}"). Connections to other major areas are listed below if available.`;
    }
  } else {
    exitsContext = 'Current location is not part of a larger mapped area.';
  }
  context += exitsContext + '\n\n';

  const processedTargets = new Set<string>();
  const excludeForCurrentNode =
    (currentNode.data.nodeType === 'feature') && parentNodeForCurrent
      ? parentNodeForCurrent.id
      : null;
  const pathsFromCurrentNode = getFormattedConnectionsForNode(
    currentNode,
    allNodesForTheme,
    allEdgesForTheme,
    excludeForCurrentNode,
    processedTargets
  );

  const pathsFromParentNode = parentNodeForCurrent
    ? getFormattedConnectionsForNode(
        parentNodeForCurrent,
        allNodesForTheme,
        allEdgesForTheme,
        currentNode.id,
        processedTargets
      )
    : [];

  if (pathsFromCurrentNode.length > 0) {
    context +=
      'Paths leading directly from your current spot (' + currentNode.placeName + "):\n" + pathsFromCurrentNode.join('\n');
  }

  if (pathsFromParentNode.length > 0 && parentNodeForCurrent) {
    if (pathsFromCurrentNode.length > 0) context += '\n\n';
    context +=
      `Additional paths and features within or connected to "${parentNodeForCurrent.placeName}":\n` +
      pathsFromParentNode.join('\n');
  }
  context += '\n';

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

