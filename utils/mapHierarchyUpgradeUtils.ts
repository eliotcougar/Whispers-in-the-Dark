/**
 * @file mapHierarchyUpgradeUtils.ts
 * @description Utilities for upgrading feature nodes to higher-level regions
 *              when they acquire child nodes. Introduces connector features and
 *              reroutes edges to conform to map layering rules.
 */

import { MapData, MapNode, MapEdge } from '../types';
import { structuredCloneGameState } from './cloneUtils';

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
export const upgradeFeatureToRegion = (
  mapData: MapData,
  featureNodeId: string,
  connectorName = 'New Connector'
): MapData => {
  const working: MapData = structuredCloneGameState(mapData);
  const featureIndex = working.nodes.findIndex(n => n.id === featureNodeId);
  if (featureIndex === -1) return working;

  const featureNode = working.nodes[featureIndex];
  if (featureNode.data.nodeType !== 'feature') return working;

  // Promote feature to region level
  featureNode.data.nodeType = 'region';

  // Create connector feature as child of new region
  const connectorId = generateUniqueId(`${featureNodeId}_conn_`);
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
  const childNodes = working.nodes.filter(n => n.data.parentNodeId === featureNodeId && n.id !== connectorId);
  childNodes.forEach(child => {
    const edgeId = generateUniqueId(`edge_${connectorId}_to_${child.id}_`);
    const newEdge: MapEdge = {
      id: edgeId,
      sourceNodeId: connectorId,
      targetNodeId: child.id,
      data: {
        type: 'path',
        status: 'open',
        description: `Connection from ${connectorName} to ${child.placeName}`,
      },
    };
    working.edges.push(newEdge);
  });

  return working;
};
