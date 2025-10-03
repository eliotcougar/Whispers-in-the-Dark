
/**
 * @file utils/promptFormatters/map.ts
 * @description Utilities for formatting map related context for AI prompts.
 */

import {
  AdventureTheme,
  MapData,
  MapNode,
  MapEdge,
  Item,
} from '../../types';
import { NON_DISPLAYABLE_EDGE_STATUSES, ROOT_MAP_NODE_ID } from '../../constants';
import { extractJsonFromFence } from '../jsonUtils';

/**
 * Formats a single map node line including optional items present at the node.
 */
export const formatNodeLine = (
  node: MapNode,
  inventory: Array<Item> = [],
): string => {
  const parent = node.data.parentNodeId ?? ROOT_MAP_NODE_ID;
  const desc = node.data.description;
  const itemsAtNode = inventory.filter(item => item.holderId === node.id);
  const itemsStr =
    itemsAtNode.length > 0
      ? ` Items: ${itemsAtNode.map(i => `"${i.name}"`).join(', ')}`
      : '';
  return ` - ${node.id} - "${node.placeName}" (parent: ${parent}), "${desc}"${itemsStr}`;
};

/**
 * Formats a single map edge line for prompt context.
 */
export const formatEdgeLine = (edge: MapEdge): string =>
  `- ${edge.id} (${String(edge.data.status)} ${String(edge.data.type)})`;

/**
 * Formats a list of map nodes for inclusion in prompts.
 */
export const mapNodesToString = (
  nodes: MapNode | Array<MapNode>,
  prefix = '',
  addAliases = true,
  addStatus = true,
  addDescription = true,
  singleLine = false,
): string => {
  const nodeList = Array.isArray(nodes) ? nodes : [nodes];
  if (nodeList.length === 0) {
    return '';
  }
  const delimiter = singleLine ? '; ' : ';\n';

  const result = nodeList
    .map(n => {
      let str = `${prefix}${n.id} - "${n.placeName}"`;
      if (addAliases && n.data.aliases && n.data.aliases.length > 0) {
        str += ` (aka ${n.data.aliases.map(a => `"${a}"`).join(', ')})`;
      }
      if (addStatus) {
        str += ` (Type: ${n.data.nodeType}, Visited: ${String(
          Boolean(n.data.visited),
        )}, ParentNodeId: ${n.data.parentNodeId ?? 'N/A'}, Status: ${n.data.status})`;
      }
      if (addDescription) {
        str += `, "${n.data.description}"`;
      }
      return str;
    })
    .join(delimiter);

  return result + '.';
};

/**
 * Formats a list of map edges for inclusion in prompts.
 */
export const mapEdgesToString = (
  edges: MapEdge | Array<MapEdge>,
  prefix = '',
  addDescription = true,
  singleLine = false,
): string => {
  const edgeList = Array.isArray(edges) ? edges : [edges];
  if (edgeList.length === 0) {
    return '';
  }
  const delimiter = singleLine ? '; ' : ';\n';

  const result = edgeList
    .map(e => {
      const status = e.data.status ?? 'open';
      const type = e.data.type ?? 'path';
      let str = `${prefix}${e.id} (${status} ${type})`;
      const details: Array<string> = [];
      if (e.data.travelTime) details.push(`travel time: ${e.data.travelTime}`);
      if (e.data.description) details.push(e.data.description);
      if (addDescription && details.length > 0) {
        str += ` (${details.join(', ')})`;
      }
      return str;
    })
    .join(delimiter);

  return result + '.';
};

/**
 * Formats map nodes as a tree structure for prompt context.
 */
export const formatNodesAsTree = (
  nodes: Array<MapNode>,
  addAliases = true,
  addStatus = true,
  addDescription = true,
): string => {
  const childMap = new Map<string, Array<MapNode>>();
  nodes.forEach(node => {
    const parent =
      node.data.parentNodeId && node.data.parentNodeId !== ROOT_MAP_NODE_ID
        ? node.data.parentNodeId
        : ROOT_MAP_NODE_ID;
    const list = childMap.get(parent);
    if (list) {
      list.push(node);
    } else {
      childMap.set(parent, [node]);
    }
  });

  const sortByName = (a: MapNode, b: MapNode) =>
    a.placeName.localeCompare(b.placeName);
  for (const list of childMap.values()) list.sort(sortByName);

  const lines: Array<string> = [];
  const traverse = (node: MapNode, linePrefix: string, isLast: boolean) => {
    const connector = isLast ? '└─' : '├─';
    const nodeLine = mapNodesToString(
      node,
      `${linePrefix}${connector} `,
      addAliases,
      addStatus,
      addDescription,
      true,
    );
    lines.push(nodeLine);
    const childPrefix = linePrefix + (isLast ? '   ' : '│  ');
    const children = childMap.get(node.id) ?? [];
    children.forEach((child, idx) => {
      traverse(child, childPrefix, idx === children.length - 1);
    });
  };

  const roots = childMap.get(ROOT_MAP_NODE_ID) ?? [];
  roots.forEach((rootNode, idx) => {
    traverse(rootNode, '', idx === roots.length - 1);
  });

  return lines.join('\n');
};

/**
 * Formats the entire map data in a normalized, line‑based representation that is easy for AIs to ingest.
 * Each node and edge is represented on a single line with explicit labeled fields to reduce ambiguity.
 * This avoids tree glyphs/indentation and focuses on concrete, machine-like descriptors.
 */
export const formatMapDataForAI = (mapData: MapData): string => {
  const nodes = mapData.nodes;
  const edges = mapData.edges;

  const nodeById = new Map(nodes.map(n => [n.id, n] as const));

  const sanitize = (s: string | null | undefined): string =>
    (s ?? '').replace(/\s+/g, ' ').trim();

  const aliasList = (arr: Array<string> | null | undefined): string =>
    arr && arr.length > 0 ? `[${arr.map(a => `"${a}"`).join(', ')}]` : '[]';

  const resolveArea = (nodeId: string): { area: string; feature: string } => {
    const n = nodeById.get(nodeId);
    if (!n) return { area: 'Unknown', feature: nodeId };
    if (n.data.nodeType === 'feature') {
      const parent = n.data.parentNodeId && n.data.parentNodeId !== ROOT_MAP_NODE_ID
        ? n.data.parentNodeId
        : ROOT_MAP_NODE_ID;
      return { area: parent, feature: n.id };
    }
    return { area: n.id, feature: n.id };
  };

  const nodeLines = nodes.map(n =>
    `NODE id=${n.id}; name="${n.placeName}"; type=${n.data.nodeType}; parent=${n.data.parentNodeId ?? ROOT_MAP_NODE_ID}; status=${n.data.status}; visited=${String(Boolean(n.data.visited))}; aliases=${aliasList(n.data.aliases)}; desc="${sanitize(n.data.description)}"`
  );

  const edgeLines = edges
    .filter(e => nodeById.has(e.sourceNodeId) && nodeById.has(e.targetNodeId))
    .filter(e => !(e.data.status && NON_DISPLAYABLE_EDGE_STATUSES.includes(e.data.status)))
    .map(e => {
      const from = resolveArea(e.sourceNodeId);
      const to = resolveArea(e.targetNodeId);
      const travel = e.data.travelTime ?? '';
      return `EDGE id=${e.id}; type=${e.data.type ?? 'path'}; status=${e.data.status ?? 'open'}; fromFeature=${from.feature}; fromArea=${from.area}; toFeature=${to.feature}; toArea=${to.area}; travelTime=${travel}; desc="${sanitize(e.data.description)}"`;
    });

  return [
    'MAP SNAPSHOT (normalized, line-based)',
    'NODES:',
    ...nodeLines,
    'EDGES:',
    ...edgeLines,
  ].join('\n');
};

const formatConnectionToNode = (edge: MapEdge, otherNode: MapNode): string => {
  const statusText = edge.data.status ?? 'open';
  const typeText = edge.data.type ?? 'path';
  const details: Array<string> = [];
  if (edge.data.travelTime) {
    details.push(`travel time: ${edge.data.travelTime}`);
  }
  if (edge.data.description) {
    details.push(edge.data.description);
  }
  const detailText = details.length > 0 ? ` (${details.join(', ')})` : '';
  return ` - ${statusText} ${typeText} to "${otherNode.placeName}"${detailText}.`;
};

/**
 * Cleans up an observations string for display in prompts.
 */
export const formatObservationsForPrompt = (observations?: string): string => {
  if (!observations) return '';
  return extractJsonFromFence(observations).trim();
};

/**
 * Formats a list of main map nodes for AI prompts.
 */
export const formatKnownPlacesForPrompt = (
  mapNodes: Array<MapNode>,
  detailed = false,
  includeIds = true
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
          let detailStr = ' - ';
          if (includeIds) {
            detailStr += `${node.id} - `;
          }
          detailStr += `"${node.placeName}"`;
          if (node.data.aliases && node.data.aliases.length > 0) {
            detailStr += ` (aka ${node.data.aliases.map(a => `"${a}"`).join(', ')})`;
          }
          detailStr += node.data.status == 'rumored' ? ', rumored' : '';
          detailStr += `, "${node.data.description || 'No description available.'}"`;
          return detailStr;
        })
        .join(';\n') + '.'
    );
  }
  return (
    mainNodes
      .map(node => {
        let detailStr = '';
        if (includeIds) {
          detailStr += `${node.id} - `;
        }
        detailStr += `"${node.placeName}"`;
        if (node.data.aliases && node.data.aliases.length > 0) {
          detailStr += ` (aka ${node.data.aliases.map(a => `"${a}"`).join(', ')})`;
        }
        return detailStr;
      })
      .join(', ') + '.'
  );
};

const getEdgeStatusScore = (status: MapEdge['data']['status']): number => {
  const scores: Record<string, number> = {
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
  allThemeNodes: Array<MapNode>,
  allThemeEdges: Array<MapEdge>,
  excludeTargetId: string | null,
  processedTargets: Set<string>
): Array<string> => {
  const connectedEdges = allThemeEdges.filter(
    edge => edge.sourceNodeId === perspectiveNode.id || edge.targetNodeId === perspectiveNode.id
  );

  const uniqueDestinations: Record<string, Array<MapEdge> | undefined> = {};
  connectedEdges.forEach(edge => {
    const otherNodeId = edge.sourceNodeId === perspectiveNode.id ? edge.targetNodeId : edge.sourceNodeId;
    if (otherNodeId === excludeTargetId || processedTargets.has(otherNodeId)) {
      return;
    }
    let list = uniqueDestinations[otherNodeId];
    if (!list) {
      list = [];
      uniqueDestinations[otherNodeId] = list;
    }
    list.push(edge);
  });

  const formattedPaths: Array<string> = [];
  for (const targetNodeId in uniqueDestinations) {
    const candidateEdgesToTarget = uniqueDestinations[targetNodeId];
    if (!candidateEdgesToTarget) continue;
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

    const pathString = formatConnectionToNode(bestEdge, otherNode);
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
  allNodes: Array<MapNode>,
  allEdges: Array<MapEdge>,
  typesToInclude?: Array<'node' | 'feature'>,
  typesToTraverse?: Array<'node' | 'feature'>
): Set<string> => {
  const allReachableNodeIds = new Set<string>();
  const queue: Array<{ nodeId: string; hop: number }> = [{ nodeId: startNodeId, hop: 0 }];
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
 * Formats limited map context for inventory prompts.
 * Lists nodes within two hops including id, name, parent id, description, and items at each node.
 */
export const formatLimitedMapContextForPrompt = (
  mapData: MapData,
  currentMapNodeId: string | null,
  inventory: Array<Item> = [],
): string => {
  if (!currentMapNodeId) return 'Current location unknown.';
  const allNodes = mapData.nodes;
  const allEdges = mapData.edges;
  const nearbyIds = getNearbyNodeIds(currentMapNodeId, 2, allNodes, allEdges);
  nearbyIds.add(currentMapNodeId);
  const lines: Array<string> = [];
  nearbyIds.forEach(id => {
    const node = allNodes.find(n => n.id === id);
    if (!node) return;
    lines.push(formatNodeLine(node, inventory));
  });
  return lines.join(';\n') + '.';
};

/**
 * Formats the current map context for the AI prompt.
 */
export const formatMapContextForPrompt = (
  mapData: MapData,
  currentMapNodeId: string | null,
  currentTheme: AdventureTheme | null,
  allNodesForTheme: Array<MapNode>,
  allEdgesForTheme: Array<MapEdge>
): string => {
  if (!currentMapNodeId || !currentTheme) {
    return "Player's precise map location is currently unknown or they are between known locations.";
  }

  const currentNode = allNodesForTheme.find(node => node.id === currentMapNodeId);
  if (!currentNode) {
    return '';
  }

  let context = ` - You are currently at ${currentNode.id} - "${currentNode.placeName}".`;
  if (currentNode.data.description) {
    context += ` ${currentNode.data.description}.`;
  }

  const parentNodeForCurrent =
    currentNode.data.nodeType === 'feature' && currentNode.data.parentNodeId && currentNode.data.parentNodeId !== ROOT_MAP_NODE_ID
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
      ? (currentNode.data.parentNodeId && currentNode.data.parentNodeId !== ROOT_MAP_NODE_ID ? currentNode.data.parentNodeId : undefined)
      : currentNode.id;
  let exitsContext = '';
  if (areaMainNodeId) {
    const areaMainNode = allNodesForTheme.find(node => node.id === areaMainNodeId);
    if (areaMainNode && !(areaMainNode.data.nodeType === 'feature')) {
      const exitFeatureNodesInCurrentArea = allNodesForTheme.filter(
        node => node.data.nodeType === "feature" && node.data.parentNodeId === areaMainNode.id
      );
      const exitStrings: Array<string> = [];
      if (exitFeatureNodesInCurrentArea.length > 0) {
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
              entryFeature.data.parentNodeId !== ROOT_MAP_NODE_ID
            ) {
              const otherAreaMainNode = allNodesForTheme.find(
                node => node.id === entryFeature.data.parentNodeId && !(node.data.nodeType === "feature")
              );
              if (otherAreaMainNode) {
                const edgeStatus = edge.data.status ?? 'open';
                const edgeType = edge.data.type ?? 'path';
                exitStrings.push(
                  ` - '${edgeStatus} ${edgeType}' exit at '${exitFeature.placeName}', leading to '${otherAreaMainNode.placeName}' via '${entryFeature.placeName}'.`
                );
              }
            }
          }
        }
      }
      if (exitStrings.length > 0) {
        exitsContext = `
Possible Exits from Current Main Area (${areaMainNode.placeName}):
${exitStrings.join('\n')}`;
      } else {
        exitsContext = `
No mapped exits from the current main area ("${areaMainNode.placeName}") to other major areas are known.`;
      }
    } else if (areaMainNode && (areaMainNode.data.nodeType === 'feature')) {
      exitsContext = `You are at a detailed feature ("${areaMainNode.placeName}"). Connections to other major areas are listed below if available.`;
    }
  } else {
    exitsContext = 'Current location is not part of a larger mapped area.';
  }
  context += `${exitsContext}

`;

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
    context += `Paths leading directly from your current spot (${currentNode.placeName}):
${pathsFromCurrentNode.join('\n')}`;
  }

  if (pathsFromParentNode.length > 0 && parentNodeForCurrent) {
    if (pathsFromCurrentNode.length > 0) context += '\n\n';
    context += `Additional paths and features within or connected to "${parentNodeForCurrent.placeName}":
${pathsFromParentNode.join('\n')}`;
  }
  context += '\n';

  const nearbyNodeIds = getNearbyNodeIds(currentNode.id, 2, allNodesForTheme, allEdgesForTheme);
  if (nearbyNodeIds.size > 0) {
    const nearbyNodeNames = Array.from(nearbyNodeIds)
      .map(id => allNodesForTheme.find(n => n.id === id)?.placeName)
      .filter(name => !!name)
      .map(name => `"${String(name)}"`);
    if (nearbyNodeNames.length > 0) {
      context += `
Locations nearby (within two hops): ${nearbyNodeNames.join(', ')}.`;
    }
  }

  return context;
};

