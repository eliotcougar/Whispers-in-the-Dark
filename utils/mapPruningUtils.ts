
/**
 * @file mapPruningUtils.ts
 * @description Utility functions for restructuring map connections by introducing
 *              intermediate feature nodes to replace direct main-to-main node edges.
 */

import { MapData, MapNode, MapEdge, MapChainToRefine } from '../types';
import { structuredCloneGameState } from './cloneUtils';

/**
 * Generates a unique ID string.
 * @param {string} [prefix="id_"] - Optional prefix for the ID.
 * @returns {string} A unique ID.
 */
const generateUniqueId = (prefix: string = "id_"): string => {
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Identifies and restructures map connections based on specified patterns.
 * Phase 1: Handles parent-child-feature transitions (M1 -> featureL -> M2) by adding a temporary feature for M2.
 * Phase 2: Handles direct M1-M2 connections by inserting temporary features for both nodes.
 * Original problematic edges are removed and new chains are prepared for AI refinement.
 *
 * @param originalMapData - The current map data.
 * @param currentThemeName - The name of the currently active theme.
 * @returns An object containing:
 *          - `updatedMapData`: The map data with new temporary feature nodes,
 *            parent-child edges, feature-to-feature edges, and original direct edges removed.
 *          - `chainsToRefine`: An array of `MapChainToRefine` objects, each detailing
 *            a new (mainNode-feature-feature-mainNode) chain that requires AI refinement.
 */
export const pruneAndRefineMapConnections = (
  originalMapData: MapData,
  currentThemeName: string
): { updatedMapData: MapData; chainsToRefine: MapChainToRefine[] } => {
  const workingMapData: MapData = structuredCloneGameState(originalMapData);
  const chainsToRefine: MapChainToRefine[] = [];
  const edgesToRemoveIds = new Set<string>();

  const themeNodes = workingMapData.nodes.filter(node => node.themeName === currentThemeName);
  const themeNodeMap = new Map(themeNodes.map(n => [n.id, n]));


  // Phase 1: Process M1 - L - M2 cases based on parent links
  const featureNodesInTheme = themeNodes.filter(
    node => node.data.nodeType === 'feature'
  );

  for (const featureL of featureNodesInTheme) {
    if (!featureL.data.parentNodeId) continue;

    const parentM1 = themeNodeMap.get(featureL.data.parentNodeId);
    if (!parentM1 || parentM1.data.nodeType === 'feature') continue; // Parent must be a main node



    // Find edges connecting L to another main node M2 (not M1)
    const edgesFromL = workingMapData.edges.filter(edge =>
      (edge.sourceNodeId === featureL.id || edge.targetNodeId === featureL.id) &&
      !edgesToRemoveIds.has(edge.id) // Not already marked for removal
    );

    for (const edge_LM2 of edgesFromL) {
      const otherNodeId = edge_LM2.sourceNodeId === featureL.id ? edge_LM2.targetNodeId : edge_LM2.sourceNodeId;
      const mainNodeM2 = themeNodeMap.get(otherNodeId);

      if (
        mainNodeM2 &&
        mainNodeM2.data.nodeType !== 'feature' &&
        mainNodeM2.data.nodeType !== 'room' &&
        mainNodeM2.id !== parentM1.id
      ) {
        // Found M1 - L - M2 connection. Replace L-M2 with L - L_M2 - M2
        
        const tempFeatureM2_NameSuggestion = `Entrance to ${mainNodeM2.placeName} from ${featureL.placeName}`;
        const tempFeatureM2_Id = generateUniqueId('featureM2_');
        const tempFeatureM2: MapNode = {
          id: tempFeatureM2_Id,
          themeName: currentThemeName,
          placeName: `TempFeature_${mainNodeM2.id.slice(-4)}_${featureL.id.slice(-4)}_B`,
          position: { x: mainNodeM2.position.x - 20, y: mainNodeM2.position.y - 20 },
          data: {
            description: `A temporary transition point into ${mainNodeM2.placeName}.`,
            aliases: [`Entrance to ${mainNodeM2.placeName}`],
            status: 'discovered',
            nodeType: 'feature',
            parentNodeId: mainNodeM2.id,
            visited: false,
          },
        };
        workingMapData.nodes.push(tempFeatureM2);
        themeNodeMap.set(tempFeatureM2_Id, tempFeatureM2); // Add to map for current phase



        const edge_L_LM2_Id = generateUniqueId(`edge_L_LM2_`);
        const edge_L_LM2: MapEdge = {
          id: edge_L_LM2_Id,
          sourceNodeId: featureL.id,
          targetNodeId: tempFeatureM2.id,
          data: { // Inherit type and status from original L-M2 edge
            type: edge_LM2.data.type || 'path',
            status: edge_LM2.data.status || 'open',
            description: `Path connecting ${featureL.placeName} and new transition to ${mainNodeM2.placeName}.`,
          },
        };
        workingMapData.edges.push(edge_L_LM2);

        edgesToRemoveIds.add(edge_LM2.id);

        chainsToRefine.push({
          mainNodeA_Id: parentM1.id,
          mainNodeB_Id: mainNodeM2.id,
          featureA_Info: { nodeId: featureL.id, isTemporary: false, nameSuggestion: featureL.placeName },
          featureB_Info: { nodeId: tempFeatureM2.id, isTemporary: true, nameSuggestion: tempFeatureM2_NameSuggestion },
          edgeBetweenFeatures_Id: edge_L_LM2_Id,
          originalDirectEdgeId: edge_LM2.id,
        });
      }
    }
  }

  // Phase 2: Process direct M1 - M2 cases
  const currentEdgesInTheme = workingMapData.edges.filter(edge =>
    themeNodeMap.has(edge.sourceNodeId) && themeNodeMap.has(edge.targetNodeId) &&
    !edgesToRemoveIds.has(edge.id) // Don't re-process edges already handled or marked for removal
  );

  for (const edge of currentEdgesInTheme) {
    const sourceNode = themeNodeMap.get(edge.sourceNodeId);
    const targetNode = themeNodeMap.get(edge.targetNodeId);

    if (
      sourceNode &&
      targetNode &&
      sourceNode.data.nodeType !== 'feature' &&
      sourceNode.data.nodeType !== 'room' &&
      targetNode.data.nodeType !== 'feature' &&
      targetNode.data.nodeType !== 'room'
    ) {
      
      // Create Feature F_M1 (child of sourceNode)
      const tempFeatureM1_NameSuggestion = `Exit from ${sourceNode.placeName} towards ${targetNode.placeName}`;
      const featureM1_Id = generateUniqueId('featureM1_');
      const featureM1: MapNode = {
        id: featureM1_Id,
        themeName: currentThemeName,
        placeName: `TempFeature_${sourceNode.id.slice(-4)}_${targetNode.id.slice(-4)}_A`,
        position: { x: sourceNode.position.x + 20, y: sourceNode.position.y + 20 },
        data: {
          description: `A temporary transition point from ${sourceNode.placeName}.`,
          aliases: [`Exit from ${sourceNode.placeName}`],
          status: 'discovered',
          nodeType: 'feature',
          parentNodeId: sourceNode.id,
          visited: false,
        },
      };
      workingMapData.nodes.push(featureM1);
      themeNodeMap.set(featureM1_Id, featureM1); 


      // Create Feature F_M2 (child of targetNode)
      const tempFeatureM2_NameSuggestion = `Entrance to ${targetNode.placeName} from ${sourceNode.placeName}`;
      const featureM2_Id = generateUniqueId('featureM2_');
      const featureM2: MapNode = {
        id: featureM2_Id,
        themeName: currentThemeName,
        placeName: `TempFeature_${sourceNode.id.slice(-4)}_${targetNode.id.slice(-4)}_B`,
        position: { x: targetNode.position.x - 20, y: targetNode.position.y - 20 },
        data: {
          description: `A temporary transition point into ${targetNode.placeName}.`,
          aliases: [`Entrance to ${targetNode.placeName}`],
          status: 'discovered',
          nodeType: 'feature',
          parentNodeId: targetNode.id,
          visited: false,
        },
      };
      workingMapData.nodes.push(featureM2);
      themeNodeMap.set(featureM2_Id, featureM2);


      // Create edge between Feature F_M1 and Feature F_M2
      const edgeBetweenFeatures_Id = generateUniqueId(`edge_features_`);
      const edgeBetweenFeatures: MapEdge = {
        id: edgeBetweenFeatures_Id,
        sourceNodeId: featureM1.id,
        targetNodeId: featureM2.id,
        data: { // Inherit type and status from original M1-M2 edge
          type: edge.data.type || 'path',
          status: edge.data.status || 'open',
          description: `Path between temporary transition points.`,
        },
      };
      workingMapData.edges.push(edgeBetweenFeatures);

      edgesToRemoveIds.add(edge.id);

      chainsToRefine.push({
        mainNodeA_Id: sourceNode.id,
        mainNodeB_Id: targetNode.id,
        featureA_Info: { nodeId: featureM1.id, isTemporary: true, nameSuggestion: tempFeatureM1_NameSuggestion },
        featureB_Info: { nodeId: featureM2.id, isTemporary: true, nameSuggestion: tempFeatureM2_NameSuggestion },
        edgeBetweenFeatures_Id: edgeBetweenFeatures_Id,
        originalDirectEdgeId: edge.id,
      });
    }
  }

  // Final pass: remove all marked edges
  workingMapData.edges = workingMapData.edges.filter(edge => !edgesToRemoveIds.has(edge.id));

  return { updatedMapData: workingMapData, chainsToRefine };
};
