import type { MapNode, MapNodeData, MapEdgeData } from '../../types';
import { findMapNodeByIdentifier, buildNodeId } from '../../utils/entityUtils';
import { findClosestAllowedParent } from '../../utils/mapGraphUtils';
import { isEdgeConnectionAllowed, addEdgeWithTracking } from './edgeUtils';
import { buildChainRequest } from './connectorChains';
import { fetchLikelyParentNode_Service } from '../corrections/placeDetails';
import type { ApplyUpdatesContext } from './updateContext';

export async function processNodeAdds(context: ApplyUpdatesContext): Promise<void> {
  let nodesToAddOps_mut: typeof context.payload.nodesToAdd = [
    ...(context.payload.nodesToAdd ?? [])
  ];
  context.nodesToRemove_mut = [...(context.payload.nodesToRemove ?? [])];
  context.edgesToAdd_mut = [...(context.payload.edgesToAdd ?? [])];
  context.edgesToRemove_mut = [...(context.payload.edgesToRemove ?? [])];

  const finalNodesToAddOps: typeof nodesToAddOps_mut = [];
  const ignoredNodeNames = new Set<string>();
  for (const nodeAdd of nodesToAddOps_mut) {
    if (context.nameMatchesItemOrNPC(nodeAdd.placeName)) {
      console.warn(
        `MapUpdate: Skipping node add "${nodeAdd.placeName}" that resembles an item or NPC.`
      );
      ignoredNodeNames.add(nodeAdd.placeName);
      continue;
    }
    const removeIndex = context.nodesToRemove_mut.findIndex(
      nr => nr.nodeName && nr.nodeName.toLowerCase() === nodeAdd.placeName.toLowerCase()
    );
    if (removeIndex !== -1) {
      context.nodesToRemove_mut.splice(removeIndex, 1);
    } else {
      finalNodesToAddOps.push(nodeAdd);
    }
  }
  nodesToAddOps_mut = finalNodesToAddOps;

  const finalEdgesToAdd: typeof context.edgesToAdd_mut = [];
  for (const edgeAdd of context.edgesToAdd_mut) {
    finalEdgesToAdd.push(edgeAdd);
  }
  context.edgesToAdd_mut = finalEdgesToAdd;

  const dedupedEdges: typeof context.edgesToAdd_mut = [];
  const edgeKeySet = new Set<string>();
  for (const e of context.edgesToAdd_mut) {
    const src = e.sourcePlaceName.toLowerCase();
    const tgt = e.targetPlaceName.toLowerCase();
    const type = e.data.type ?? 'path';
    const key = src < tgt ? `${src}|${tgt}|${type}` : `${tgt}|${src}|${type}`;
    if (!edgeKeySet.has(key)) {
      edgeKeySet.add(key);
      dedupedEdges.push(e);
    }
  }
  context.edgesToAdd_mut = dedupedEdges;

  if (ignoredNodeNames.size > 0) {
    context.edgesToAdd_mut = context.edgesToAdd_mut.filter(
      e =>
        !ignoredNodeNames.has(e.sourcePlaceName) &&
        !ignoredNodeNames.has(e.targetPlaceName)
    );
  }

  (context.payload.nodesToUpdate ?? []).forEach(upd => {
    const updNames = [upd.placeName.toLowerCase()];
    if (upd.newData.placeName) updNames.push(upd.newData.placeName.toLowerCase());
    for (const name of updNames) {
      const idx = context.nodesToRemove_mut.findIndex(
        r => r.nodeName && r.nodeName.toLowerCase() === name
      );
      if (idx !== -1) context.nodesToRemove_mut.splice(idx, 1);
    }
  });

  let unresolvedQueue: typeof nodesToAddOps_mut = [...nodesToAddOps_mut];
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
            context.newMapData.nodes,
            context.newMapData,
            context.referenceMapNodeId
          ) as MapNode | undefined;
          if (parent) {
            const childType = nodeAddOp.data.nodeType ?? 'feature';
            if (parent.data.nodeType === childType) {
              sameTypeParent = parent;
            }
            resolvedParentId = findClosestAllowedParent(
              parent,
              childType,
              context.themeNodeIdMap
            );
          } else {
            nextQueue.push(nodeAddOp);
            continue;
          }
        }
      }

      const existingNode = findMapNodeByIdentifier(
        nodeAddOp.placeName,
        context.newMapData.nodes,
        context.newMapData,
        context.referenceMapNodeId
      ) as MapNode | undefined;

      const canReuseExisting =
        existingNode !== undefined &&
        existingNode.themeName === context.currentTheme.name &&
        ((resolvedParentId === undefined && !existingNode.data.parentNodeId) ||
          existingNode.data.parentNodeId === resolvedParentId) &&
        (existingNode.placeName.toLowerCase() === nodeAddOp.placeName.toLowerCase() ||
          (existingNode.data.aliases?.some(a => a.toLowerCase() === nodeAddOp.placeName.toLowerCase()) ??
            false) ||
          (nodeAddOp.data.aliases?.some(a => a.toLowerCase() === existingNode.placeName.toLowerCase()) ??
            false));

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

      const { description, aliases, parentNodeId: _ignoredParent, status, nodeType, visited: _ignoredVisited, ...rest } =
        nodeAddOp.data;
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
        themeName: context.currentTheme.name,
        placeName: nodeAddOp.placeName,
        position: nodeAddOp.initialPosition ?? { x: 0, y: 0 },
        data: newNodeData,
      };

      context.newMapData.nodes.push(newNode);
      context.newlyAddedNodes.push(newNode);
      context.themeNodeIdMap.set(newNodeId, newNode);
      context.themeNodeNameMap.set(nodeAddOp.placeName, newNode);
      if (newNode.data.aliases) {
        newNode.data.aliases.forEach(a => context.themeNodeAliasMap.set(a.toLowerCase(), newNode));
      }
      context.newNodesInBatchIdNameMap[nodeAddOp.placeName] = { id: newNodeId, name: nodeAddOp.placeName };

      if (sameTypeParent) {
        const edgeData: MapEdgeData = {
          type: 'path',
          status:
            newNode.data.status === 'rumored' || sameTypeParent.data.status === 'rumored'
              ? 'rumored'
              : 'open',
          description: `Path between ${nodeAddOp.placeName} and ${sameTypeParent.placeName}`,
        };
        if (isEdgeConnectionAllowed(newNode, sameTypeParent, 'path', context.themeNodeIdMap)) {
          addEdgeWithTracking(newNode, sameTypeParent, edgeData, context.newMapData.edges, context.themeEdgesMap);
        } else {
          context.pendingChainRequests.push(buildChainRequest(newNode, sameTypeParent, edgeData, context.themeNodeIdMap));
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
              sceneDescription: context.sceneDesc,
              logMessage: context.logMsg,
              localPlace: context.localPlace,
              currentTheme: context.currentTheme,
              currentMapNodeId: context.referenceMapNodeId,
              themeNodes: context.currentThemeNodesFromMapData,
              themeEdges: context.currentThemeEdgesFromMapData,
            },
            context.minimalModelCalls
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
}
