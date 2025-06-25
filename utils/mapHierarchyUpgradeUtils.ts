/**
 * @file mapHierarchyUpgradeUtils.ts
 * @description Utilities for upgrading feature nodes to higher-level regions
 *              when they acquire child nodes. Introduces linking features and
 *              reroutes edges to conform to map layering rules.
 */

import { MapData, MapNode, MapEdge, AdventureTheme } from '../types';
import { structuredCloneGameState } from './cloneUtils';
import { decideFeatureHierarchyUpgrade_Service } from '../services/corrections/hierarchyUpgrade';
import { generateUniqueId } from './entityUtils';

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
  newEdges: Array<MapEdge>;
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
  const connectorId = generateUniqueId(`node_${connectorName}_`);
  const connectorNode: MapNode = {
    id: connectorId,
    themeName: featureNode.themeName,
    placeName: connectorName,
    position: { ...featureNode.position },
    data: {
      description: featureNode.data.description,
      aliases: featureNode.data.aliases ?? [],
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
  const createdEdges: Array<MapEdge> = [];

  childNodes.forEach(child => {
    const edgeId = generateUniqueId(`edge_${connectorId}_to_${child.id}`);
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
): Promise<{ updatedMapData: MapData; addedNodes: Array<MapNode>; addedEdges: Array<MapEdge> }> => {
  let working: MapData = structuredCloneGameState(mapData);
  const addedNodes: Array<MapNode> = [];
  const addedEdges: Array<MapEdge> = [];

  for (const node of working.nodes) {
    if (node.data.nodeType === 'feature') {
      const childNodes = working.nodes.filter(n => n.data.parentNodeId === node.id);
      if (childNodes.length > 0) {
        const decision = await decideFeatureHierarchyUpgrade_Service(node, childNodes[0], currentTheme);
        if (decision === 'convert_child') {
          childNodes.forEach(child => { child.data.parentNodeId = node.data.parentNodeId; });
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

export const repairFeatureHierarchy = async (
  mapData: MapData,
  currentTheme: AdventureTheme,
): Promise<MapData> => {
  try {
    const result = await upgradeFeaturesWithChildren(mapData, currentTheme);
    return result.updatedMapData;
  } catch (error: unknown) {
    console.error('repairFeatureHierarchy error:', error);
    return mapData;
  }
};
