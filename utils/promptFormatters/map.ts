
/**
 * @file utils/promptFormatters/map.ts
 * @description Utilities for formatting map related context for AI prompts.
 */

import {
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
  itemsByHolder?: Map<string, Array<Item>>,
): string => {
  const parent = node.parentNodeId ?? ROOT_MAP_NODE_ID;
  const desc = node.description;
  const itemsAtNode = itemsByHolder
    ? itemsByHolder.get(node.id) ?? []
    : inventory.filter(item => item.holderId === node.id);
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
  `- ${edge.id} (${edge.status} ${edge.type})`;

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
      if (addAliases && n.aliases && n.aliases.length > 0) {
        str += ` (aka ${n.aliases.map(a => `"${a}"`).join(', ')})`;
      }
      if (addStatus) {
        str += ` (Type: ${n.type}, Visited: ${String(
          Boolean(n.visited),
        )}, ParentNodeId: ${n.parentNodeId ?? 'N/A'}, Status: ${n.status})`;
      }
      if (addDescription) {
        str += `, "${n.description}"`;
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
      const status = e.status;
      const type = e.type;
      let str = `${prefix}${e.id} (${status} ${type})`;
      const details: Array<string> = [];
      if (e.travelTime) details.push(`travel time: ${e.travelTime}`);
      if (e.description) details.push(e.description);
      if (addDescription && details.length > 0) {
        str += ` (${details.join(', ')})`;
      }
      return str;
    })
    .join(delimiter);

  return result + '.';
};

interface MapPromptLookup {
  nodesById: Map<string, MapNode>;
  edgesByNodeId: Map<string, Array<MapEdge>>;
  nodesByParentId: Map<string, Array<MapNode>>;
}

const buildMapPromptLookup = (mapData: MapData): MapPromptLookup => {
  const nodesById = new Map<string, MapNode>();
  const edgesByNodeId = new Map<string, Array<MapEdge>>();
  const nodesByParentId = new Map<string, Array<MapNode>>();

  mapData.nodes.forEach(node => {
    nodesById.set(node.id, node);
    const parentId = node.parentNodeId ?? ROOT_MAP_NODE_ID;
    const siblings = nodesByParentId.get(parentId);
    if (siblings) {
      siblings.push(node);
    } else {
      nodesByParentId.set(parentId, [node]);
    }
  });

  mapData.edges.forEach(edge => {
    const register = (nodeId: string) => {
      const edges = edgesByNodeId.get(nodeId);
      if (edges) {
        edges.push(edge);
      } else {
        edgesByNodeId.set(nodeId, [edge]);
      }
    };
    register(edge.sourceNodeId);
    register(edge.targetNodeId);
  });

  return { nodesById, edgesByNodeId, nodesByParentId };
};

const buildItemsByHolderMap = (inventory: Array<Item>): Map<string, Array<Item>> => {
  const itemsByHolder = new Map<string, Array<Item>>();
  inventory.forEach(item => {
    if (!item.holderId) return;
    const items = itemsByHolder.get(item.holderId);
    if (items) {
      items.push(item);
    } else {
      itemsByHolder.set(item.holderId, [item]);
    }
  });
  return itemsByHolder;
};

const isTraversableEdgeStatus = (status: MapEdge['status']): boolean => {
  return status === 'open' || status === 'accessible' || status === 'active';
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
      node.parentNodeId && node.parentNodeId !== ROOT_MAP_NODE_ID
        ? node.parentNodeId
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
    if (n.type === 'feature') {
      const parent = n.parentNodeId && n.parentNodeId !== ROOT_MAP_NODE_ID
        ? n.parentNodeId
        : ROOT_MAP_NODE_ID;
      return { area: parent, feature: n.id };
    }
    return { area: n.id, feature: n.id };
  };

  const nodeLines = nodes.map(n =>
    `NODE id=${n.id}; name="${n.placeName}"; type=${n.type}; parent=${n.parentNodeId ?? ROOT_MAP_NODE_ID}; status=${n.status}; visited=${n.visited === true ? 'true' : 'false'}; aliases=${aliasList(n.aliases)}; desc="${sanitize(n.description)}"`
  );

  const edgeLines = edges
    .filter(e => nodeById.has(e.sourceNodeId) && nodeById.has(e.targetNodeId))
    .filter(e => !NON_DISPLAYABLE_EDGE_STATUSES.includes(e.status))
    .map(e => {
      const from = resolveArea(e.sourceNodeId);
      const to = resolveArea(e.targetNodeId);
      const travel = e.travelTime ?? '';
      return `EDGE id=${e.id}; type=${e.type}; status=${e.status}; fromFeature=${from.feature}; fromArea=${from.area}; toFeature=${to.feature}; toArea=${to.area}; travelTime=${travel}; desc="${sanitize(e.description)}"`;
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
  const statusText = edge.status;
  const typeText = edge.type;
  const details: Array<string> = [];
  if (edge.travelTime) {
    details.push(`travel time: ${edge.travelTime}`);
  }
  if (edge.description) {
    details.push(edge.description);
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
    node => node.type !== 'feature' && node.type !== 'room'
  );
  if (mainNodes.length === 0) {
    return 'None specifically known yet.';
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
          if (node.aliases && node.aliases.length > 0) {
            detailStr += ` (aka ${node.aliases.map(a => `"${a}"`).join(', ')})`;
          }
          detailStr += node.status == 'rumored' ? ', rumored' : '';
          detailStr += `, "${node.description || 'No description available.'}"`;
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
        if (node.aliases && node.aliases.length > 0) {
          detailStr += ` (aka ${node.aliases.map(a => `"${a}"`).join(', ')})`;
        }
        return detailStr;
      })
      .join(', ') + '.'
  );
};

const getEdgeStatusScore = (status: MapEdge['status']): number => {
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
  return scores[status] ?? 0;
};

/**
 * Helper function to get formatted connection strings from a perspective node.
 */
const getFormattedConnectionsForNode = (
  perspectiveNode: MapNode,
  lookup: MapPromptLookup,
  excludeTargetId: string | null,
  processedTargets: Set<string>
): Array<string> => {
  const connectedEdges = lookup.edgesByNodeId.get(perspectiveNode.id) ?? [];

  const uniqueDestinations = new Map<string, Array<MapEdge>>();
  connectedEdges.forEach(edge => {
    const otherNodeId = edge.sourceNodeId === perspectiveNode.id ? edge.targetNodeId : edge.sourceNodeId;
    if (otherNodeId === excludeTargetId || processedTargets.has(otherNodeId)) {
      return;
    }
    const list = uniqueDestinations.get(otherNodeId);
    if (list) {
      list.push(edge);
    } else {
      uniqueDestinations.set(otherNodeId, [edge]);
    }
  });

  const formattedPaths: Array<string> = [];
  uniqueDestinations.forEach((candidateEdgesToTarget, targetNodeId) => {
    const validCandidateEdges = candidateEdgesToTarget.filter(edge => {
      const status = edge.status;
      if (NON_DISPLAYABLE_EDGE_STATUSES.includes(status)) {
        return false;
      }
      if (status === 'one_way' && edge.targetNodeId === perspectiveNode.id) {
        return false;
      }
      return true;
    });
    if (validCandidateEdges.length === 0) return;
    validCandidateEdges.sort((edgeA, edgeB) => {
      const scoreA = (edgeA.sourceNodeId === perspectiveNode.id ? 100 : 0) + getEdgeStatusScore(edgeA.status);
      const scoreB = (edgeB.sourceNodeId === perspectiveNode.id ? 100 : 0) + getEdgeStatusScore(edgeB.status);
      return scoreB - scoreA;
    });
    const bestEdge = validCandidateEdges[0];
    const otherNode = lookup.nodesById.get(targetNodeId);
    if (!otherNode) return;

    const pathString = formatConnectionToNode(bestEdge, otherNode);
    formattedPaths.push(pathString);
    processedTargets.add(targetNodeId);
  });

  return formattedPaths;
};

/**
 * Finds reachable node IDs within a specified number of hops.
 */
const getNearbyNodeIds = (
  startNodeId: string,
  maxHops: number,
  lookup: MapPromptLookup,
  typesToInclude?: Array<'node' | 'feature'>,
  typesToTraverse?: Array<'node' | 'feature'>
): Set<string> => {
  const allReachableNodeIds = new Set<string>();
  const queue: Array<{ nodeId: string; hop: number }> = [{ nodeId: startNodeId, hop: 0 }];
  const visitedForHops = new Set<string>([startNodeId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (current.nodeId !== startNodeId) {
      allReachableNodeIds.add(current.nodeId);
    }
    if (current.hop < maxHops) {
      const connectedEdges = lookup.edgesByNodeId.get(current.nodeId) ?? [];
      for (const edge of connectedEdges) {
        const neighborNodeId = edge.sourceNodeId === current.nodeId ? edge.targetNodeId : edge.sourceNodeId;
        if (visitedForHops.has(neighborNodeId)) {
          continue;
        }
        if (!isTraversableEdgeStatus(edge.status)) {
          continue;
        }
        const neighborNode = lookup.nodesById.get(neighborNodeId);
        if (!neighborNode) {
          continue;
        }
        const neighborNodeType =
          neighborNode.type === 'feature' || neighborNode.type === 'room'
            ? 'feature'
            : 'node';
        if (typesToTraverse && typesToTraverse.length > 0 && !typesToTraverse.includes(neighborNodeType)) {
          continue;
        }
        visitedForHops.add(neighborNodeId);
        queue.push({ nodeId: neighborNodeId, hop: current.hop + 1 });
      }
    }
  }

  if (typesToInclude && typesToInclude.length > 0) {
    const filteredReachableNodeIds = new Set<string>();
    for (const nodeId of allReachableNodeIds) {
      const node = lookup.nodesById.get(nodeId);
      if (node) {
        const nodeType = (node.type === 'feature' || node.type === 'room') ? 'feature' : 'node';
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
  const lookup = buildMapPromptLookup(mapData);
  const itemsByHolder = buildItemsByHolderMap(inventory);
  const nearbyIds = getNearbyNodeIds(currentMapNodeId, 2, lookup);
  nearbyIds.add(currentMapNodeId);
  const lines: Array<string> = [];
  mapData.nodes.forEach(node => {
    if (!nearbyIds.has(node.id)) return;
    lines.push(formatNodeLine(node, inventory, itemsByHolder));
  });
  return lines.join(';\n') + '.';
};

/**
 * Formats the current map context for the AI prompt.
 */
export const formatMapContextForPrompt = (
  mapData: MapData,
  currentMapNodeId: string | null
): string => {
  const lookup = buildMapPromptLookup(mapData);
  if (!currentMapNodeId) {
    return "Player's precise map location is currently unknown or they are between known locations.";
  }

  const currentNode = lookup.nodesById.get(currentMapNodeId);
  if (!currentNode) {
    return '';
  }

  let context = ` - You are currently at ${currentNode.id} - "${currentNode.placeName}".`;
  if (currentNode.description) {
    context += ` ${currentNode.description}.`;
  }

  const parentNodeForCurrent =
    currentNode.type === 'feature' && currentNode.parentNodeId && currentNode.parentNodeId !== ROOT_MAP_NODE_ID
      ? lookup.nodesById.get(currentNode.parentNodeId)
      : null;

  if (parentNodeForCurrent) {
    if (parentNodeForCurrent.type === 'feature') {
      context += ` This is a feature of "${parentNodeForCurrent.placeName}".`;
    } else {
      context += ` This is part of the larger known location: "${parentNodeForCurrent.placeName}".`;
    }
  }
  context += '\n';

  const areaMainNodeId =
    currentNode.type === 'feature'
      ? (currentNode.parentNodeId && currentNode.parentNodeId !== ROOT_MAP_NODE_ID ? currentNode.parentNodeId : undefined)
      : currentNode.id;
  let exitsContext = '';
  if (areaMainNodeId) {
    const areaMainNode = lookup.nodesById.get(areaMainNodeId);
    if (areaMainNode && !(areaMainNode.type === 'feature')) {
      const exitFeatureNodesInCurrentArea = (lookup.nodesByParentId.get(areaMainNode.id) ?? []).filter(
        node => node.type === 'feature'
      );
      const exitStrings: Array<string> = [];
      if (exitFeatureNodesInCurrentArea.length > 0) {
        for (const exitFeature of exitFeatureNodesInCurrentArea) {
          if (exitFeature.id === currentNode.id) continue;
          const featureEdges = lookup.edgesByNodeId.get(exitFeature.id) ?? [];
          for (const edge of featureEdges) {
            const status = edge.status;
            if (NON_DISPLAYABLE_EDGE_STATUSES.includes(status)) continue;
            const otherEndNodeId = edge.sourceNodeId === exitFeature.id ? edge.targetNodeId : edge.sourceNodeId;
            const entryFeature = lookup.nodesById.get(otherEndNodeId);
            if (
              entryFeature &&
              entryFeature.type === 'feature' &&
              entryFeature.parentNodeId &&
              entryFeature.parentNodeId !== areaMainNode.id &&
              entryFeature.parentNodeId !== ROOT_MAP_NODE_ID
            ) {
              const otherAreaMainNode = lookup.nodesById.get(entryFeature.parentNodeId);
              if (otherAreaMainNode && otherAreaMainNode.type === 'feature') {
                continue;
              }
              if (otherAreaMainNode) {
                const edgeStatus = status;
                const edgeType = edge.type;
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
    } else if (areaMainNode && (areaMainNode.type === 'feature')) {
      exitsContext = `You are at a detailed feature ("${areaMainNode.placeName}"). Connections to other major areas are listed below if available.`;
    }
  } else {
    exitsContext = 'Current location is not part of a larger mapped area.';
  }
  context += `${exitsContext}

`;

  const processedTargets = new Set<string>();
  const excludeForCurrentNode =
    (currentNode.type === 'feature') && parentNodeForCurrent
      ? parentNodeForCurrent.id
      : null;
  const pathsFromCurrentNode = getFormattedConnectionsForNode(
    currentNode,
    lookup,
    excludeForCurrentNode,
    processedTargets
  );

  const pathsFromParentNode = parentNodeForCurrent
    ? getFormattedConnectionsForNode(
        parentNodeForCurrent,
        lookup,
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

  const nearbyNodeIds = getNearbyNodeIds(currentNode.id, 2, lookup);
  if (nearbyNodeIds.size > 0) {
    const nearbyNodeNames = Array.from(nearbyNodeIds)
      .map(id => lookup.nodesById.get(id)?.placeName)
      .filter(name => !!name)
      .map(name => `"${String(name)}"`);
    if (nearbyNodeNames.length > 0) {
      context += `
Locations nearby (within two hops): ${nearbyNodeNames.join(', ')}.`;
    }
  }

  return context;
};

