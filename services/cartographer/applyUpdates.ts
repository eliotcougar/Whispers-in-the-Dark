/**
 * @file applyUpdates.ts
 * @description Applies a validated map update payload to the current MapData.
 */
import {
  GameStateFromAI,
  AdventureTheme,
  MapData,
  MapNode,
  MapEdge,
  MapNodeData,
  MapEdgeData,
  AIMapUpdatePayload,
  MinimalModelCallRecord,
  Item,
  Character,
} from '../../types';
import { structuredCloneGameState } from '../../utils/cloneUtils';
import {
  fetchLikelyParentNode_Service,
  fetchCorrectedNodeIdentifier_Service,
} from '../corrections/placeDetails';
import type { EdgeChainRequest, ConnectorChainsServiceResult } from '../corrections/edgeFixes';
import { fetchConnectorChains_Service } from '../corrections/edgeFixes';
import { resolveSplitFamilyOrphans_Service } from '../corrections/hierarchyUpgrade';
import { findClosestAllowedParent } from '../../utils/mapGraphUtils';
import { generateUniqueId, findMapNodeByIdentifier, buildNodeId } from '../../utils/entityUtils';
import { isEdgeConnectionAllowed, addEdgeWithTracking } from './edgeUtils';
import { buildChainRequest } from './connectorChains';
import { MAX_RETRIES } from '../../constants';
import type { MapUpdateDebugInfo } from './types';

const MAX_CHAIN_REFINEMENT_ROUNDS = 2;

export interface ApplyMapUpdatesParams {
  payload: AIMapUpdatePayload;
  currentMapData: MapData;
  currentTheme: AdventureTheme;
  previousMapNodeId: string | null;
  inventoryItems: Array<Item>;
  knownCharacters: Array<Character>;
  aiData: GameStateFromAI;
  minimalModelCalls: Array<MinimalModelCallRecord>;
  debugInfo: MapUpdateDebugInfo;
}

export interface ApplyMapUpdatesResult {
  updatedMapData: MapData;
  newlyAddedNodes: Array<MapNode>;
  newlyAddedEdges: Array<MapEdge>;
  debugInfo: MapUpdateDebugInfo;
}

export const applyMapUpdates = async ({
  payload,
  currentMapData,
  currentTheme,
  previousMapNodeId,
  inventoryItems,
  knownCharacters,
  aiData,
  minimalModelCalls,
  debugInfo,
}: ApplyMapUpdatesParams): Promise<ApplyMapUpdatesResult> => {
  const sceneDesc =
    'sceneDescription' in aiData ? aiData.sceneDescription : '';
  const logMsg = aiData.logMessage ?? '';
  const localPlace = aiData.localPlace ?? 'Unknown';
  const referenceMapNodeId =
    'currentMapNodeId' in aiData && aiData.currentMapNodeId
      ? aiData.currentMapNodeId
      : previousMapNodeId;

  const currentThemeNodesFromMapData = currentMapData.nodes.filter(
    n => n.themeName === currentTheme.name,
  );
  const currentThemeNodeIdsSet = new Set(
    currentThemeNodesFromMapData.map(n => n.id),
  );
  const currentThemeEdgesFromMapData = currentMapData.edges.filter(e =>
    currentThemeNodeIdsSet.has(e.sourceNodeId) &&
    currentThemeNodeIdsSet.has(e.targetNodeId),
  );
  const themeNodeIdMap = new Map<string, MapNode>();
  const themeNodeNameMap = new Map<string, MapNode>();
  const themeNodeAliasMap = new Map<string, MapNode>();
  const themeEdgesMap = new Map<string, Array<MapEdge>>();
  currentThemeNodesFromMapData.forEach(n => {
    themeNodeIdMap.set(n.id, n);
    themeNodeNameMap.set(n.placeName, n);
    if (n.data.aliases) {
      n.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), n));
    }
  });
  currentThemeEdgesFromMapData.forEach(e => {
    if (!themeEdgesMap.has(e.sourceNodeId)) themeEdgesMap.set(e.sourceNodeId, []);
    if (!themeEdgesMap.has(e.targetNodeId)) themeEdgesMap.set(e.targetNodeId, []);
    const arr1 = themeEdgesMap.get(e.sourceNodeId);
    if (arr1) arr1.push(e);
    const arr2 = themeEdgesMap.get(e.targetNodeId);
    if (arr2) arr2.push(e);
  });

  const resolveNodeRef = async (
    identifier: string,
  ): Promise<MapNode | undefined> => {
    let node = findMapNodeByIdentifier(
      identifier,
      newMapData.nodes,
      newMapData,
      referenceMapNodeId,
    ) as MapNode | undefined;
    if (!node) {
      const corrected = await fetchCorrectedNodeIdentifier_Service(
        identifier,
        {
          themeNodes: newMapData.nodes.filter(
            n => n.themeName === currentTheme.name,
          ),
          currentLocationId: referenceMapNodeId,
        },
        minimalModelCalls,
      );
      if (corrected) {
        node = findMapNodeByIdentifier(
          corrected,
          newMapData.nodes,
          newMapData,
          referenceMapNodeId,
        ) as MapNode | undefined;
      }
    }
    return node;
  };

  const normalizeName = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[{}().,!?;:"[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const tokenize = (text: string): Array<string> =>
    normalizeName(text)
      .split(' ')
      .filter(t => t.length > 0);

  const itemNameTokens = inventoryItems.map(i => ({
    norm: normalizeName(i.name),
    tokens: tokenize(i.name),
  }));
  const charNameTokens: Array<{ norm: string; tokens: Array<string> }> = [];
    knownCharacters.forEach(c => {
      charNameTokens.push({ norm: normalizeName(c.name), tokens: tokenize(c.name) });
      (c.aliases ?? []).forEach(a => {
        charNameTokens.push({ norm: normalizeName(a), tokens: tokenize(a) });
      });
    });

  const nameMatchesItemOrChar = (name: string): boolean => {
    const norm = normalizeName(name);
    const tokens = tokenize(name);
    const checkTokens = (candidate: { norm: string; tokens: Array<string> }): boolean => {
      if (candidate.norm === norm) return true;
      const intersection = tokens.filter(t => candidate.tokens.includes(t));
      const ratioA = intersection.length / tokens.length;
      const ratioB = intersection.length / candidate.tokens.length;
      return intersection.length > 0 && ratioA >= 0.6 && ratioB >= 0.6;
    };
    return itemNameTokens.some(checkTokens) || charNameTokens.some(checkTokens);
  };

  // Proceed with map data processing using payload
  const newMapData: MapData = structuredCloneGameState(currentMapData);
  const newNodesInBatchIdNameMap: Record<string, { id: string; name: string }> = {};
  const newlyAddedNodes: Array<MapNode> = [];
  const newlyAddedEdges: Array<MapEdge> = [];
  const pendingChainRequests: Array<EdgeChainRequest> = [];
  const processedChainKeys = new Set<string>();

  // Refresh lookup maps for the cloned map data
  themeNodeIdMap.clear();
  themeNodeNameMap.clear();
  themeNodeAliasMap.clear();
  themeEdgesMap.clear();
  newMapData.nodes
    .filter(n => n.themeName === currentTheme.name)
    .forEach(n => {
      themeNodeIdMap.set(n.id, n);
      themeNodeNameMap.set(n.placeName, n);
      if (n.data.aliases) n.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), n));
    });
  newMapData.edges.forEach(e => {
    if (themeNodeIdMap.has(e.sourceNodeId) && themeNodeIdMap.has(e.targetNodeId)) {
      if (!themeEdgesMap.has(e.sourceNodeId)) themeEdgesMap.set(e.sourceNodeId, []);
      if (!themeEdgesMap.has(e.targetNodeId)) themeEdgesMap.set(e.targetNodeId, []);
      const arr1 = themeEdgesMap.get(e.sourceNodeId);
      if (arr1) arr1.push(e);
      const arr2 = themeEdgesMap.get(e.targetNodeId);
      if (arr2) arr2.push(e);
    }
  });

  // Annihilation Step (remains the same)
  let nodesToAddOps_mut: AIMapUpdatePayload['nodesToAdd'] = [...(payload.nodesToAdd ?? [])];
  const nodesToRemove_mut = [...(payload.nodesToRemove ?? [])];
  let edgesToAdd_mut = [...(payload.edgesToAdd ?? [])];
  const edgesToRemove_mut = [...(payload.edgesToRemove ?? [])];

  const finalNodesToAddOps: typeof nodesToAddOps_mut = [];
  const ignoredNodeNames = new Set<string>();
  for (const nodeAdd of nodesToAddOps_mut) {
      if (nameMatchesItemOrChar(nodeAdd.placeName)) {
          console.warn(`MapUpdate: Skipping node add "${nodeAdd.placeName}" that resembles an item or character.`);
          ignoredNodeNames.add(nodeAdd.placeName);
          continue;
      }
      const removeIndex = nodesToRemove_mut.findIndex(nr => nr.nodeName && nr.nodeName.toLowerCase() === nodeAdd.placeName.toLowerCase());
      if (removeIndex !== -1) {
          nodesToRemove_mut.splice(removeIndex, 1);
      } else { finalNodesToAddOps.push(nodeAdd); }
  }
  nodesToAddOps_mut = finalNodesToAddOps;

  const finalEdgesToAdd: typeof edgesToAdd_mut = [];
  for (const edgeAdd of edgesToAdd_mut) {
      finalEdgesToAdd.push(edgeAdd);
  }
  edgesToAdd_mut = finalEdgesToAdd;

  const dedupedEdges: typeof edgesToAdd_mut = [];
  const edgeKeySet = new Set<string>();
  for (const e of edgesToAdd_mut) {
      const src = e.sourcePlaceName.toLowerCase();
      const tgt = e.targetPlaceName.toLowerCase();
      const type = e.data.type ?? 'path';
      const key = src < tgt ? `${src}|${tgt}|${type}` : `${tgt}|${src}|${type}`;
      if (!edgeKeySet.has(key)) {
          edgeKeySet.add(key);
          dedupedEdges.push(e);
      }
  }
  edgesToAdd_mut = dedupedEdges;

  if (ignoredNodeNames.size > 0) {
    edgesToAdd_mut = edgesToAdd_mut.filter(
      e => !ignoredNodeNames.has(e.sourcePlaceName) && !ignoredNodeNames.has(e.targetPlaceName)
    );
  }

  // If a node is being renamed via nodesToUpdate, ignore any matching
  // nodesToRemove operation referencing either the old or new name.
  (payload.nodesToUpdate ?? []).forEach(upd => {
    const updNames = [upd.placeName.toLowerCase()];
    if (upd.newData.placeName)
      updNames.push(upd.newData.placeName.toLowerCase());
    for (const name of updNames) {
      const idx = nodesToRemove_mut.findIndex(r => r.nodeName && r.nodeName.toLowerCase() === name);
      if (idx !== -1) nodesToRemove_mut.splice(idx, 1);
    }
  });



  // --- Hierarchical Node Addition ---
  let unresolvedQueue: AIMapUpdatePayload['nodesToAdd'] = [...nodesToAddOps_mut];
  let triedParentInference = false;

  while (unresolvedQueue.length > 0) {
    const nextQueue: typeof unresolvedQueue = [];
      for (const nodeAddOp of unresolvedQueue) {
        let resolvedParentId: string | undefined = undefined;
        let sameTypeParent: MapNode | null = null;
        if (nodeAddOp.data.parentNodeId) {
          if (nodeAddOp.data.parentNodeId === 'Universe') {
            resolvedParentId = undefined;
          } else {
          const parent = findMapNodeByIdentifier(
            nodeAddOp.data.parentNodeId,
            newMapData.nodes,
            newMapData,
            referenceMapNodeId
          ) as MapNode | undefined;
          if (parent) {
            const childType = nodeAddOp.data.nodeType ?? 'feature';
            if (parent.data.nodeType === childType) {
              sameTypeParent = parent;
            }
            resolvedParentId = findClosestAllowedParent(parent, childType, themeNodeIdMap);
          } else {
            nextQueue.push(nodeAddOp);
            continue;
          }
        }
      }

      // Use buildNodeId helper for consistent node id generation
      const existingNode = findMapNodeByIdentifier(
        nodeAddOp.placeName,
        newMapData.nodes,
        newMapData,
        referenceMapNodeId,
      ) as MapNode | undefined;

        const canReuseExisting =
          existingNode !== undefined &&
          existingNode.themeName === currentTheme.name &&
          ((resolvedParentId === undefined && !existingNode.data.parentNodeId) ||
            existingNode.data.parentNodeId === resolvedParentId) &&
          (existingNode.placeName.toLowerCase() === nodeAddOp.placeName.toLowerCase() ||
            (existingNode.data.aliases?.some(a => a.toLowerCase() === nodeAddOp.placeName.toLowerCase()) ?? false) ||
            (nodeAddOp.data.aliases?.some(a => a.toLowerCase() === existingNode.placeName.toLowerCase()) ?? false));

        if (canReuseExisting) {
          const existing = existingNode;
          if (nodeAddOp.data.aliases) {
            const aliasSet = new Set([...(existing.data.aliases ?? [])]);
            nodeAddOp.data.aliases.forEach(a => aliasSet.add(a));
            existing.data.aliases = Array.from(aliasSet);
          }
          if (
            nodeAddOp.data.description &&
            existing.data.description.trim().length === 0
          ) {
            existing.data.description = nodeAddOp.data.description;
          }
          continue;
        }

      const newNodeId = buildNodeId(nodeAddOp.placeName);

      const {
        description,
        aliases,
        parentNodeId: _ignoredParent,
        status,
        nodeType,
        visited: _ignoredVisited,
        ...rest
      } = nodeAddOp.data;
      void _ignoredParent;
      void _ignoredVisited;

      const newNodeData: MapNodeData = {
        description: description ?? '',
        aliases: aliases ?? [],
        status,
        parentNodeId: resolvedParentId,
        nodeType: nodeType ?? 'feature',
        ...rest,
      };

      const newNode: MapNode = {
        id: newNodeId,
        themeName: currentTheme.name,
        placeName: nodeAddOp.placeName,
        position: nodeAddOp.initialPosition ?? { x: 0, y: 0 },
        data: newNodeData,
      };

      newMapData.nodes.push(newNode);
      newlyAddedNodes.push(newNode);
      themeNodeIdMap.set(newNodeId, newNode);
      themeNodeNameMap.set(nodeAddOp.placeName, newNode);
      if (newNode.data.aliases) {
        newNode.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), newNode));
      }
      newNodesInBatchIdNameMap[nodeAddOp.placeName] = { id: newNodeId, name: nodeAddOp.placeName };

      if (sameTypeParent) {
        const edgeData: MapEdgeData = {
          type: 'path',
          status:
            newNode.data.status === 'rumored' || sameTypeParent.data.status === 'rumored'
              ? 'rumored'
              : 'open',
          description: `Path between ${nodeAddOp.placeName} and ${sameTypeParent.placeName}`,
        };
        if (isEdgeConnectionAllowed(newNode, sameTypeParent, 'path', themeNodeIdMap)) {
          addEdgeWithTracking(newNode, sameTypeParent, edgeData, newMapData.edges, themeEdgesMap);
        } else {
          pendingChainRequests.push(buildChainRequest(newNode, sameTypeParent, edgeData, themeNodeIdMap));
        }
      }
    }

    if (nextQueue.length === unresolvedQueue.length) {
      if (!triedParentInference) {
        for (const unresolved of nextQueue) {
          const guessed = await fetchLikelyParentNode_Service(
            {
              placeName: unresolved.placeName,
              description: unresolved.data.description,
              nodeType: unresolved.data.nodeType,
              status: unresolved.data.status,
              aliases: unresolved.data.aliases,
            },
            {
              sceneDescription: sceneDesc,
              logMessage: logMsg,
              localPlace,
              currentTheme,
              currentMapNodeId: referenceMapNodeId,
              themeNodes: currentThemeNodesFromMapData,
              themeEdges: currentThemeEdgesFromMapData,
            },
            minimalModelCalls
          );
          unresolved.data.parentNodeId = guessed ?? 'Universe';
        }
        triedParentInference = true;
        unresolvedQueue = nextQueue;
        continue;
      } else {
        console.warn(
          'MapUpdate: Some nodes could not be added due to unresolved parents after AI assistance:',
          nextQueue.map(n => n.placeName).join(', ')
        );
        break;
      }
    }
    unresolvedQueue = nextQueue;
  }

  // Process Node Updates (after all adds, so placeName changes are based on initial state of batch)
  for (const nodeUpdateOp of payload.nodesToUpdate ?? []) {
    const node = await resolveNodeRef(nodeUpdateOp.placeName);

    if (node) {

        // Handle parentNodeId update
        let resolvedParentIdOnUpdate: string | undefined | null = node.data.parentNodeId; // Default to existing

        if (nodeUpdateOp.newData.parentNodeId !== undefined) {
            const parentField = (nodeUpdateOp.newData as { parentNodeId?: string | null }).parentNodeId;
            if (parentField === null) { // Explicitly clearing parent
                resolvedParentIdOnUpdate = undefined; // Store as undefined if cleared
            } else if (typeof parentField === 'string') {
                if (parentField === 'Universe') {
                    resolvedParentIdOnUpdate = undefined;
                } else {
                    // Allow parent to be ANY node
                    const parentNode = await resolveNodeRef(
                      parentField,
                    );
                    if (parentNode) {
                        resolvedParentIdOnUpdate = parentNode.id;
                        const intendedType = nodeUpdateOp.newData.nodeType ?? node.data.nodeType;
                        if (parentNode.data.nodeType === intendedType) {
                            resolvedParentIdOnUpdate = parentNode.data.parentNodeId;
                        }
                    } else {
                        console.warn(`MapUpdate (nodesToUpdate): Feature node "${nodeUpdateOp.placeName}" trying to update parentNodeId to NAME "${nodeUpdateOp.newData.parentNodeId}" which was not found.`);
                        resolvedParentIdOnUpdate = undefined; // Or keep old one: node.data.parentNodeId
                    }
                }
            }
        }

        // Apply general data updates
        {
            if (nodeUpdateOp.newData.description !== undefined) node.data.description = nodeUpdateOp.newData.description;
            if (nodeUpdateOp.newData.aliases !== undefined) {
                node.data.aliases = nodeUpdateOp.newData.aliases;
                for (const [k, v] of Array.from(themeNodeAliasMap.entries())) {
                  if (v.id === node.id) themeNodeAliasMap.delete(k);
                }
                node.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), node));
            }
            if (nodeUpdateOp.newData.status !== undefined) node.data.status = nodeUpdateOp.newData.status;
            if (nodeUpdateOp.newData.nodeType !== undefined) node.data.nodeType = nodeUpdateOp.newData.nodeType;

            // Update parentNodeId based on resolution
            node.data.parentNodeId = resolvedParentIdOnUpdate;

            // Apply other custom data, excluding handled fields
            for (const key in nodeUpdateOp.newData) {
            if (!['description', 'aliases', 'status', 'parentNodeId', 'nodeType', 'placeName', 'visited'].includes(key)) {
                (node.data as Record<string, unknown>)[key] = (nodeUpdateOp.newData as Record<string, unknown>)[key];
            }
            }
            // Handle placeName change last, as it might affect lookups for newNodesInBatchIdNameMap if not careful
            if (nodeUpdateOp.newData.placeName && nodeUpdateOp.newData.placeName !== node.placeName) {
                // If this node was newly added in THIS batch, update its entry in newNodesInBatchIdNameMap
                const oldBatchEntryKey = Object.keys(newNodesInBatchIdNameMap).find(key => newNodesInBatchIdNameMap[key].id === node.id);
                if (oldBatchEntryKey) {
                    Reflect.deleteProperty(newNodesInBatchIdNameMap, oldBatchEntryKey);
                    newNodesInBatchIdNameMap[nodeUpdateOp.newData.placeName] = {
                        id: node.id,
                        name: nodeUpdateOp.newData.placeName,
                    };
                }
                themeNodeNameMap.delete(node.placeName);
                const oldName = node.placeName;
                node.placeName = nodeUpdateOp.newData.placeName;
                themeNodeNameMap.set(node.placeName, node);
                node.data.aliases ??= [];
                if (!node.data.aliases.includes(oldName)) node.data.aliases.push(oldName);
                for (const [k, v] of Array.from(themeNodeAliasMap.entries())) {
                  if (v.id === node.id) themeNodeAliasMap.delete(k);
                }
                node.data.aliases.forEach(a => themeNodeAliasMap.set(a.toLowerCase(), node));
            }
        }
    } else {
        console.warn(`MapUpdate (nodesToUpdate): Node with original name "${nodeUpdateOp.placeName}" not found for update.`);
    }
  }

  // Process Node Removals
  for (const nodeRemoveOp of nodesToRemove_mut) {
      let node = await resolveNodeRef(nodeRemoveOp.nodeId);
      if (!node && nodeRemoveOp.nodeName) {
        node = await resolveNodeRef(nodeRemoveOp.nodeName);
      }
      if (node) {
          if (nodeRemoveOp.nodeName && node.placeName.toLowerCase() !== nodeRemoveOp.nodeName.toLowerCase()) {
              console.warn(`MapUpdate (nodesToRemove): nodeId "${nodeRemoveOp.nodeId}" resolves to "${node.placeName}" which mismatches provided nodeName "${nodeRemoveOp.nodeName}".`);
          }
          const removedNodeId = node.id;
          const index = newMapData.nodes.findIndex(n => n.id === removedNodeId);
          if (index !== -1) newMapData.nodes.splice(index, 1);
          themeNodeNameMap.delete(node.placeName);
          themeNodeIdMap.delete(removedNodeId);
          // Also remove edges connected to this node
          newMapData.edges = newMapData.edges.filter(edge => edge.sourceNodeId !== removedNodeId && edge.targetNodeId !== removedNodeId);
          themeEdgesMap.forEach((edgesArr: Array<MapEdge>, nid: string) => {
              themeEdgesMap.set(nid, edgesArr.filter(e => e.sourceNodeId !== removedNodeId && e.targetNodeId !== removedNodeId));
          });
          themeEdgesMap.delete(removedNodeId);
          for (const [k, v] of Array.from(themeNodeAliasMap.entries())) {
              if (v.id === removedNodeId) themeNodeAliasMap.delete(k);
          }
          // Remove from newNodesInBatchIdNameMap if it was added then removed in same batch
          const batchKey = Object.keys(newNodesInBatchIdNameMap).find(
            k => newNodesInBatchIdNameMap[k].id === removedNodeId || k === nodeRemoveOp.nodeName
          );
          if (batchKey) Reflect.deleteProperty(newNodesInBatchIdNameMap, batchKey);
        } else {
            console.warn(`MapUpdate (nodesToRemove): Node "${nodeRemoveOp.nodeId}" not found for removal.`);
        }
  }




  // Process Edges (uses findMapNodeByIdentifier to resolve nodes in the updated map)
  for (const edgeAddOp of edgesToAdd_mut) {
      const sourceNodeRef = await resolveNodeRef(edgeAddOp.sourcePlaceName);
      const targetNodeRef = await resolveNodeRef(edgeAddOp.targetPlaceName);

      if (!sourceNodeRef || !targetNodeRef) {
          console.warn(`MapUpdate: Skipping edge add due to missing source ("${edgeAddOp.sourcePlaceName}") or target ("${edgeAddOp.targetPlaceName}") node.`);
          continue;
      }

    const sourceNode = themeNodeIdMap.get(sourceNodeRef.id);
    const targetNode = themeNodeIdMap.get(targetNodeRef.id);
    if (!sourceNode || !targetNode) {
      console.warn('MapUpdate: Failed to resolve edge nodes after lookup.');
      continue;
    }

        const pairKey =
          sourceNode.id < targetNode.id
            ? `${sourceNode.id}|${targetNode.id}|${edgeAddOp.data.type ?? 'path'}`
            : `${targetNode.id}|${sourceNode.id}|${edgeAddOp.data.type ?? 'path'}`;
        if (processedChainKeys.has(pairKey)) continue;
        processedChainKeys.add(pairKey);

        const chainReq = buildChainRequest(sourceNode, targetNode, edgeAddOp.data, themeNodeIdMap);
        if (!isEdgeConnectionAllowed(sourceNode, targetNode, edgeAddOp.data.type, themeNodeIdMap)) {
          pendingChainRequests.push(chainReq);
          continue;
        }

        addEdgeWithTracking(
          sourceNode,
          targetNode,
          {
            ...edgeAddOp.data,
            status:
              edgeAddOp.data.status ??
              (sourceNode.data.status === 'rumored' || targetNode.data.status === 'rumored' ? 'rumored' : 'open'),
          },
          newMapData.edges,
          themeEdgesMap,
        );
  }

    for (const edgeUpdateOp of payload.edgesToUpdate ?? []) {
    const sourceNodeRef = await resolveNodeRef(edgeUpdateOp.sourcePlaceName);
    const targetNodeRef = await resolveNodeRef(edgeUpdateOp.targetPlaceName);
    if (!sourceNodeRef || !targetNodeRef) {
      console.warn(
        `MapUpdate: Skipping edge update due to missing source ("${edgeUpdateOp.sourcePlaceName}") or target ("${edgeUpdateOp.targetPlaceName}") node.`,
      );
      continue;
    }
    const sourceNodeId = sourceNodeRef.id;
    const targetNodeId = targetNodeRef.id;
    const sourceNode = themeNodeIdMap.get(sourceNodeId);
    const targetNode = themeNodeIdMap.get(targetNodeId);
    if (!sourceNode || !targetNode) continue;

    // Find edge to update. If type is specified in newData, it's part of the match criteria.
    // Otherwise, find any edge and update its type.
    const candidateEdges = (themeEdgesMap.get(sourceNodeId) ?? []).filter(
      e =>
        (e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId) ||
        (e.sourceNodeId === targetNodeId && e.targetNodeId === sourceNodeId)
    );

    const checkType = edgeUpdateOp.newData.type ?? candidateEdges[0]?.data.type;
    if (!isEdgeConnectionAllowed(sourceNode, targetNode, checkType, themeNodeIdMap)) {
      console.warn(
        `MapUpdate: Edge update between "${sourceNode.placeName}" and "${targetNode.placeName}" violates hierarchy rules. Skipping update.`
      );
      continue;
    }
    const edgeToUpdate = candidateEdges.find(e =>
      edgeUpdateOp.newData.type ? e.data.type === edgeUpdateOp.newData.type : true,
    );

    if (!edgeToUpdate) {
      console.warn(
        `MapUpdate (edgesToUpdate): Edge between "${edgeUpdateOp.sourcePlaceName}" and "${edgeUpdateOp.targetPlaceName}" not found for update.`,
      );
      continue;
    }

    edgeToUpdate.data = { ...edgeToUpdate.data, ...edgeUpdateOp.newData };
  }

  for (const edgeRemoveOp of edgesToRemove_mut) {
        let edge = newMapData.edges.find(e => e.id === edgeRemoveOp.edgeId) ??
                   newMapData.edges.find(e => e.id.toLowerCase().includes(edgeRemoveOp.edgeId.toLowerCase()));
      if (!edge && edgeRemoveOp.sourceId && edgeRemoveOp.targetId) {
          const sourceNodeRef = await resolveNodeRef(edgeRemoveOp.sourceId);
          const targetNodeRef = await resolveNodeRef(edgeRemoveOp.targetId);
          if (!sourceNodeRef || !targetNodeRef) {
              console.warn(`MapUpdate: Skipping edge removal due to missing source ("${edgeRemoveOp.sourceId}") or target ("${edgeRemoveOp.targetId}") node.`);
              continue;
          }
          edge = newMapData.edges.find(e => {
              const matchesNodes = (e.sourceNodeId === sourceNodeRef.id && e.targetNodeId === targetNodeRef.id) ||
                                   (e.sourceNodeId === targetNodeRef.id && e.targetNodeId === sourceNodeRef.id);
              return matchesNodes;
          }) ?? undefined;
      } else if (edge) {
          if ((edgeRemoveOp.sourceId && edge.sourceNodeId !== edgeRemoveOp.sourceId && edge.targetNodeId !== edgeRemoveOp.sourceId) ||
              (edgeRemoveOp.targetId && edge.sourceNodeId !== edgeRemoveOp.targetId && edge.targetNodeId !== edgeRemoveOp.targetId)) {
              console.warn(`MapUpdate (edgesToRemove): edgeId "${edgeRemoveOp.edgeId}" does not match provided sourceId/targetId.`);
          }
      }
      if (!edge) {
          console.warn(`MapUpdate (edgesToRemove): Edge "${edgeRemoveOp.edgeId}" not found for removal.`);
          continue;
      }
      newMapData.edges = newMapData.edges.filter(e => e !== edge);
      const arr1 = themeEdgesMap.get(edge.sourceNodeId);
      if (arr1) themeEdgesMap.set(edge.sourceNodeId, arr1.filter(e2 => e2 !== edge));
      const arr2 = themeEdgesMap.get(edge.targetNodeId);
      if (arr2) themeEdgesMap.set(edge.targetNodeId, arr2.filter(e2 => e2 !== edge));
  }

  let chainRequests: Array<EdgeChainRequest> = pendingChainRequests.splice(0);
  let refineAttempts = 0;
  const chainContext = {
      sceneDescription: sceneDesc,
      logMessage: logMsg,
      currentTheme,
      themeNodes: newMapData.nodes.filter(n => n.themeName === currentTheme.name)
  };

  while (chainRequests.length > 0 && refineAttempts < MAX_CHAIN_REFINEMENT_ROUNDS) {
      let chainResult: ConnectorChainsServiceResult | null = null;
      for (let attempt = 0; attempt < MAX_RETRIES; ) {
        console.log(
          `Connector Chains Refinement: Round ${String(refineAttempts + 1)}/${String(MAX_CHAIN_REFINEMENT_ROUNDS)}, Attempt ${
            String(attempt + 1)
          }/${String(MAX_RETRIES)}`,
        );
        chainResult = await fetchConnectorChains_Service(chainRequests, chainContext);
        if (chainResult.debugInfo) {
          debugInfo.connectorChainsDebugInfo?.push({
            round: refineAttempts + 1,
            ...chainResult.debugInfo,
          });
        }
        if (chainResult.payload) {
          break;
        }
        console.warn(
          `Connector Chains Refinement (Round ${String(refineAttempts + 1)}, Attempt ${
            String(attempt + 1)
          }): invalid or empty response. Retrying.`,
        );
        attempt++;
      }
      if (chainResult?.payload) {
          chainRequests = [];
          (chainResult.payload.nodesToAdd ?? []).forEach(nAdd => {
          const nodeData = nAdd.data;
          const parent =
            nodeData.parentNodeId && nodeData.parentNodeId !== 'Universe'
              ? (findMapNodeByIdentifier(
                  nodeData.parentNodeId,
                  newMapData.nodes,
                  newMapData,
                  referenceMapNodeId
                ) as MapNode | undefined)
              : undefined;
          const parentId = parent ? parent.id : undefined;

          const existing = findMapNodeByIdentifier(
            nAdd.placeName,
            newMapData.nodes,
            newMapData,
            referenceMapNodeId,
          ) as MapNode | undefined;
          if (existing) {
            if (nodeData.aliases) {
              const aliasSet = new Set([...(existing.data.aliases ?? [])]);
              nodeData.aliases.forEach(a => aliasSet.add(a));
              existing.data.aliases = Array.from(aliasSet);
            }
            if (nodeData.description && existing.data.description.trim().length === 0) {
              existing.data.description = nodeData.description;
            }
            return;
          }

          const newId = generateUniqueId(`node_${nAdd.placeName}_`);
          const node: MapNode = {
            id: newId,
            themeName: currentTheme.name,
            placeName: nAdd.placeName,
            position: parent ? { ...parent.position } : { x: 0, y: 0 },
            data: { ...nodeData, parentNodeId: parentId },
          } as MapNode;
          newMapData.nodes.push(node);
          newlyAddedNodes.push(node);
          themeNodeIdMap.set(node.id, node);
          themeNodeNameMap.set(node.placeName, node);
        });
        (chainResult.payload.edgesToAdd ?? []).forEach(eAdd => {
          const src =
            (findMapNodeByIdentifier(
              eAdd.sourcePlaceName,
              newMapData.nodes,
              newMapData,
              referenceMapNodeId
            ) as MapNode | undefined);
          const tgt =
            (findMapNodeByIdentifier(
              eAdd.targetPlaceName,
              newMapData.nodes,
              newMapData,
              referenceMapNodeId
            ) as MapNode | undefined);
          if (src && tgt) {
            const pairKey = src.id < tgt.id
              ? `${src.id}|${tgt.id}|${eAdd.data.type ?? 'path'}`
              : `${tgt.id}|${src.id}|${eAdd.data.type ?? 'path'}`;
            if (processedChainKeys.has(pairKey)) return;
            processedChainKeys.add(pairKey);
            if (isEdgeConnectionAllowed(src, tgt, eAdd.data.type, themeNodeIdMap)) {
              addEdgeWithTracking(
                src,
                tgt,
                eAdd.data,
                newMapData.edges,
                themeEdgesMap,
              );
            } else {
              console.warn(
                `Connector chain edge between "${src.placeName}" and "${tgt.placeName}" violates hierarchy rules. Reprocessing.`,
              );
              chainRequests.push(buildChainRequest(src, tgt, eAdd.data, themeNodeIdMap));
            }
          }
        });
        chainContext.themeNodes = newMapData.nodes.filter(
          n => n.themeName === currentTheme.name,
        );
      } else {
        console.warn(
          `Connector Chains Refinement failed after ${String(MAX_RETRIES)} attempts for round ${
            String(refineAttempts + 1)
          }. Giving up on these chain requests.`,
        );
        break;
      }
      refineAttempts++;
  }

  if (debugInfo.connectorChainsDebugInfo && debugInfo.connectorChainsDebugInfo.length === 0) {
    debugInfo.connectorChainsDebugInfo = null;
  }

  if (payload.splitFamily) {
    const sf = payload.splitFamily;
    const originalParent = themeNodeIdMap.get(sf.originalNodeId);
    const newParent = themeNodeIdMap.get(sf.newNodeId);
    const connector = themeNodeIdMap.get(sf.newConnectorNodeId);
    if (originalParent && newParent && connector) {
      newParent.data.nodeType = sf.newNodeType;
      newParent.data.parentNodeId = originalParent.data.parentNodeId;
      connector.data.parentNodeId = newParent.id;
      newMapData.edges.forEach(edge => {
        if (edge.sourceNodeId === newParent.id) edge.sourceNodeId = connector.id;
        if (edge.targetNodeId === newParent.id) edge.targetNodeId = connector.id;
      });
      const originalSet = new Set(sf.originalChildren);
      const newSet = new Set(sf.newChildren);
      const orphans: Array<MapNode> = [];
      newMapData.nodes.forEach(n => {
        if (n.data.parentNodeId === originalParent.id && n.id !== newParent.id && n.id !== connector.id) {
          if (newSet.has(n.id)) {
            n.data.parentNodeId = newParent.id;
          } else if (originalSet.has(n.id)) {
            n.data.parentNodeId = originalParent.id;
          } else {
            orphans.push(n);
          }
        }
      });
      if (orphans.length > 0) {
        const resolution = await resolveSplitFamilyOrphans_Service({
          sceneDescription: sceneDesc,
          logMessage: logMsg,
          originalParent,
          newParent,
          orphanNodes: orphans,
          currentTheme,
        });
        resolution.originalChildren.forEach(id => {
          const node = themeNodeIdMap.get(id);
          if (node) node.data.parentNodeId = originalParent.id;
        });
        resolution.newChildren.forEach(id => {
          const node = themeNodeIdMap.get(id);
          if (node) node.data.parentNodeId = newParent.id;
        });
      }
    } else {
      console.warn('splitFamily references unknown node ids');
    }
  }

  // --- End of Temporary Feature Upgrade (parent-child edges cleaned up) ---


  return {
    updatedMapData: newMapData,
    newlyAddedNodes,
    newlyAddedEdges,
    debugInfo,
  };
};
