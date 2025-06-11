
/**
 * @file utils/promptFormatters/map.ts
 * @description Utilities for formatting map related context for AI prompts.
 */

import { AdventureTheme, MapData, MapNode, MapEdge } from '../../types';

export interface FormattedMapContext {
  location: string;
  exits: string;
  pathsFromCurrent: string;
  pathsFromParent: string;
  nearby: string;
}
import { NON_DISPLAYABLE_EDGE_STATUSES } from '../../constants';

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
          let detailStr = ` - ${node.id} - "${node.placeName}"`;
          if (node.data.aliases && node.data.aliases.length > 0) {
            detailStr += ` (aka ${node.data.aliases.map(a => `"${a}"`).join(', ')})`;
          }
          detailStr += `${node.data.status == 'rumored' ? ', rumored' : ''}`;
          detailStr += `, "${node.data.description || 'No description available.'}"`;
          return detailStr;
        })
        .join(';\n') + '.'
    );
  }
  return (
    mainNodes
      .map(node => {
        let detailStr = `${node.id} - "${node.placeName}"`;
        if (node.data.aliases && node.data.aliases.length > 0) {
          detailStr += ` (aka ${node.data.aliases.map(a => `"${a}"`).join(', ')})`;
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

    const statusText = bestEdge.data.status || 'open';
    const typeText = bestEdge.data.type || 'path';
    const details: string[] = [];
    if (bestEdge.data.travelTime) {
      details.push(`travel time: ${bestEdge.data.travelTime}`);
    }
    if (bestEdge.data.description) {
      details.push(bestEdge.data.description);
    }
    const detailText = details.length > 0 ? ` (${details.join(', ')})` : '';
    const pathString = ` - ${statusText} ${typeText} to "${otherNode.placeName}"${detailText}.`;
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
): FormattedMapContext => {
  if (!currentMapNodeId || !currentTheme) {
    return {
      location:
        "Player's precise map location is currently unknown or they are between known locations.",
      exits: '',
      pathsFromCurrent: '',
      pathsFromParent: '',
      nearby: '',
    };
  }

  const currentNode = allNodesForTheme.find(node => node.id === currentMapNodeId);
  if (!currentNode) {
    return {
      location: '',
      exits: '',
      pathsFromCurrent: '',
      pathsFromParent: '',
      nearby: '',
    };
  }

  const locationParts: string[] = [
    ` - You are currently at ${currentNode.id} - "${currentNode.placeName}".`,
  ];
  if (currentNode.data.description) {
    locationParts.push(`${currentNode.data.description}.`);
  }

  const parentNodeForCurrent =
    currentNode.data.nodeType === 'feature' &&
    currentNode.data.parentNodeId &&
    currentNode.data.parentNodeId !== 'Universe'
      ? allNodesForTheme.find(n => n.id === currentNode.data.parentNodeId)
      : null;

  if (parentNodeForCurrent) {
    if (parentNodeForCurrent.data.nodeType === 'feature') {
      locationParts.push(`This is a feature of "${parentNodeForCurrent.placeName}".`);
    } else {
      locationParts.push(`This is part of the larger known location: "${parentNodeForCurrent.placeName}".`);
    }
  }
  const locationContext = locationParts.join(' ') + '\n';

  const areaMainNodeId =
    currentNode.data.nodeType === 'feature'
      ? (currentNode.data.parentNodeId && currentNode.data.parentNodeId !== 'Universe' ? currentNode.data.parentNodeId : undefined)
      : currentNode.id;
  let exitsContext = '';
  if (areaMainNodeId) {
    const areaMainNode = allNodesForTheme.find(node => node.id === areaMainNodeId);
    if (areaMainNode && !(areaMainNode.data.nodeType === 'feature')) {
      const exitFeatureNodesInCurrentArea = allNodesForTheme.filter(
        node => node.data.nodeType === 'feature' && node.data.parentNodeId === areaMainNode.id
      );
      const exitLines: string[] = [];
      for (const exitFeature of exitFeatureNodesInCurrentArea) {
        if (exitFeature.id === currentNode.id) continue;
        for (const edge of allEdgesForTheme) {
          if (edge.sourceNodeId !== exitFeature.id && edge.targetNodeId !== exitFeature.id) continue;
          if (edge.data.status && NON_DISPLAYABLE_EDGE_STATUSES.includes(edge.data.status)) continue;
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
              node => node.id === entryFeature.data.parentNodeId && !(node.data.nodeType === 'feature')
            );
            if (otherAreaMainNode) {
              const edgeStatus = edge.data.status || 'open';
              const edgeType = edge.data.type || 'path';
              exitLines.push(
                ` - '${edgeStatus} ${edgeType}' exit at '${exitFeature.placeName}', leading to '${otherAreaMainNode.placeName}' via '${entryFeature.placeName}'.`
              );
            }
          }
        }
      }

      exitsContext = exitLines.length > 0
        ? [`Possible Exits from Current Main Area (${areaMainNode.placeName}):`, ...exitLines].join('\n')
        : `No mapped exits from the current main area ("${areaMainNode.placeName}") to other major areas are known.`;
    } else if (areaMainNode && areaMainNode.data.nodeType === 'feature') {
      exitsContext = `You are at a detailed feature ("${areaMainNode.placeName}"). Connections to other major areas are listed below if available.`;
    }
  } else {
    exitsContext = 'Current location is not part of a larger mapped area.';
  }
  exitsContext += '\n';

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

  let pathsCurrentContext = '';
  if (pathsFromCurrentNode.length > 0) {
    pathsCurrentContext = [
      `Paths leading directly from your current spot (${currentNode.placeName}):`,
      ...pathsFromCurrentNode,
    ].join('\n');
  }

  let pathsParentContext = '';
  if (pathsFromParentNode.length > 0 && parentNodeForCurrent) {
    const lines = [
      `Additional paths and features within or connected to "${parentNodeForCurrent.placeName}":`,
      ...pathsFromParentNode,
    ];
    pathsParentContext = lines.join('\n');
  }
  if (pathsCurrentContext) pathsCurrentContext += '\n';
  if (pathsParentContext) pathsParentContext += '\n';

  let nearbyContext = '';
  const nearbyNodeIds = getNearbyNodeIds(currentNode.id, 2, allNodesForTheme, allEdgesForTheme);
  if (nearbyNodeIds.size > 0) {
    const nearbyNodeNames = Array.from(nearbyNodeIds)
      .map(id => allNodesForTheme.find(n => n.id === id)?.placeName)
      .filter(name => !!name)
      .map(name => `"${name}"`);
    if (nearbyNodeNames.length > 0) {
      nearbyContext = `Locations nearby (within two hops): ${nearbyNodeNames.join(', ')}.`;
    }
  }

  return {
    location: locationContext.trimEnd(),
    exits: exitsContext.trimEnd(),
    pathsFromCurrent: pathsCurrentContext.trimEnd(),
    pathsFromParent: pathsParentContext.trimEnd(),
    nearby: nearbyContext.trimEnd(),
  };
};

