/**
 * @file mapHierarchyUpgradeUtils.ts
 * @description Utilities for upgrading feature nodes to higher-level regions
 *              when they acquire child nodes. Introduces linking features and
 *              reroutes edges to conform to map layering rules.
 */

import { MapData, MapNode, MapEdge, AdventureTheme } from '../types';
import { structuredCloneGameState } from './cloneUtils';
import { decideFeatureHierarchyUpgrade_Service } from '../services/corrections/map';

/** Generates a roughly unique ID string with an optional prefix. */
const generateUniqueId = (prefix: string = 'id_'): string => {
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Upgrades a feature node into a region and creates a new connector feature.
 * Existing edges targeting the original feature are reassigned to the connector
 * feature. New edges are also created between the connector feature and each of
 * the feature's existing children.
 *
 * @param mapData - Original map data object.
 * @param featureNodeId - ID of the feature to upgrade.
 * @param connectorName - Name of the connector feature.
 * @returns Updated MapData with the applied transformation.
 */

export interface FeatureUpgradeResult {
  updatedMapData: MapData;
  newNode: MapNode | null;
  newEdges: MapEdge[];
}

export const upgradeFeatureToRegion = (
  mapData: MapData,
  featureNodeId: string,
  connectorName = 'New Approach'
): FeatureUpgradeResult => {
  const working: MapData = structuredCloneGameState(mapData);
  const featureIndex = working.nodes.findIndex(n => n.id === featureNodeId);
  if (featureIndex === -1) {
    return { updatedMapData: working, newNode: null, newEdges: [] };
  }

  const featureNode = working.nodes[featureIndex];
  if (featureNode.data.nodeType !== 'feature') {
    return { updatedMapData: working, newNode: null, newEdges: [] };
  }


  // Promote feature to region level
  featureNode.data.nodeType = 'region';

  // Create connector feature as child of new region
  const connectorId = generateUniqueId(
    `node_${connectorName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}_`
  );
  const connectorNode: MapNode = {
    id: connectorId,
    themeName: featureNode.themeName,
    placeName: connectorName,
    position: { ...featureNode.position },
    data: {
      description: featureNode.data.description,
      aliases: featureNode.data.aliases || [],
      status: featureNode.data.status,
      nodeType: 'feature',
      parentNodeId: featureNode.id,
      visited: featureNode.data.visited,
    },
  };
  working.nodes.push(connectorNode);

  // Redirect edges that pointed to the feature node
  working.edges.forEach(edge => {
    if (edge.sourceNodeId === featureNodeId) edge.sourceNodeId = connectorId;
    if (edge.targetNodeId === featureNodeId) edge.targetNodeId = connectorId;
  });

  // Add edges from connector to existing children
  const childNodes = working.nodes.filter(
    n => n.data.parentNodeId === featureNodeId && n.id !== connectorId
  );
  const createdEdges: MapEdge[] = [];

  childNodes.forEach(child => {
    const edgeId = generateUniqueId(`edge_${connectorId}_to_${child.id}_`);
    const newEdge: MapEdge = {
      id: edgeId,
      sourceNodeId: connectorId,
      targetNodeId: child.id,
      data: {
        type: 'path',
        status: featureNode.data.status === 'rumored' ? 'rumored' : 'open',
        description: `Connection from ${connectorName} to ${child.placeName}`,
      },
    };
    working.edges.push(newEdge);
    createdEdges.push(newEdge);
  });

  return { updatedMapData: working, newNode: connectorNode, newEdges: createdEdges };
};

/**
 * Scans the map for feature nodes that already have child nodes and upgrades
 * them to regions. Returns the updated map data and any newly created nodes
 * and edges.
 */
export const upgradeFeaturesWithChildren = async (
  mapData: MapData,
  currentTheme: AdventureTheme
): Promise<{ updatedMapData: MapData; addedNodes: MapNode[]; addedEdges: MapEdge[] }> => {
  let working: MapData = structuredCloneGameState(mapData);
  const addedNodes: MapNode[] = [];
  const addedEdges: MapEdge[] = [];

  for (const node of working.nodes) {
    if (node.data.nodeType === 'feature') {
      const childNodes = working.nodes.filter(n => n.data.parentNodeId === node.id);
      if (childNodes.length > 0) {
        const decision = await decideFeatureHierarchyUpgrade_Service(node, childNodes[0], currentTheme);
        if (decision === 'convert_child') {
          childNodes.forEach(c => { c.data.parentNodeId = node.data.parentNodeId; });
        } else {
          const res = upgradeFeatureToRegion(working, node.id, 'Temp Approach');
          working = res.updatedMapData;
          if (res.newNode) addedNodes.push(res.newNode);
          addedEdges.push(...res.newEdges);
        }
      }
    }
  }

  return { updatedMapData: working, addedNodes, addedEdges };
};
