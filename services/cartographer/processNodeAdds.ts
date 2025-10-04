import type { MapNode, MapNodeData, MapEdgeData } from '../../types';
import { findMapNodeByIdentifier, buildNodeId } from '../../utils/entityUtils';
import { findClosestAllowedParent } from '../../utils/mapGraphUtils';
import { suggestNodeTypeDowngrade } from '../../utils/mapHierarchyUpgradeUtils';
import { isEdgeConnectionAllowed, addEdgeWithTracking } from './edgeUtils';
import { ROOT_MAP_NODE_ID } from '../../constants';
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
    const type = e.type;
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

  nodesToAddOps_mut.forEach(nAdd => {
    const id = buildNodeId(nAdd.placeName);
    (nAdd as unknown as Record<string, unknown>).__generatedId = id;
    context.newNodesInBatchIdNameMap[nAdd.placeName] = { id, name: nAdd.placeName };
  });

  (context.payload.nodesToUpdate ?? []).forEach(upd => {
    const updNames = [upd.placeName.toLowerCase()];
    if (upd.newPlaceName) updNames.push(upd.newPlaceName.toLowerCase());
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
      if (nodeAddOp.parentNodeId) {
        if (nodeAddOp.parentNodeId === ROOT_MAP_NODE_ID) {
          resolvedParentId = undefined;
        } else {
          const parent = findMapNodeByIdentifier(
            nodeAddOp.parentNodeId,
            context.newMapData.nodes,
            context.newMapData,
            context.referenceMapNodeId,
          ) as MapNode | undefined;
          if (parent) {
            let childType = nodeAddOp.nodeType;
            if (parent.data.nodeType === childType) {
              const downgraded = suggestNodeTypeDowngrade(
                {
                  id: 'temp',
                  placeName: nodeAddOp.placeName,
                  position: { x: 0, y: 0 },
                  data: {
                    description: nodeAddOp.description,
                    aliases: nodeAddOp.aliases,
                    status: nodeAddOp.status,
                    parentNodeId: parent.id,
                    nodeType: childType,
                  },
                },
                parent.data.nodeType,
                context.newMapData.nodes,
              );
              if (downgraded) {
                nodeAddOp.nodeType = downgraded;
                childType = downgraded;
                resolvedParentId = parent.id;
              } else {
                sameTypeParent = parent;
                // Temporarily allow the invalid hierarchy; it will be
                // corrected during conflict resolution.
                resolvedParentId = parent.id;
              }
            } else {
              resolvedParentId = findClosestAllowedParent(
                parent,
                childType,
                context.nodeIdMap,
              );
            }
          } else {
            // Fallback: resolve pseudo IDs like "node-side-tunnel-fake" to newly created IDs
            const m = /^(.*)_([a-zA-Z0-9]{4})$/.exec(nodeAddOp.parentNodeId);
            if (m) {
              const rawBase = m[1].toLowerCase();
              const baseHyphen = rawBase.replace(/_/g, '-');
              const candidates = Object.values(context.newNodesInBatchIdNameMap).filter(entry =>
                entry.id.toLowerCase().startsWith(`${baseHyphen}-`)
              );
              if (candidates.length === 1) {
                resolvedParentId = candidates[0].id;
              }
            }
            if (resolvedParentId === undefined) {
              nextQueue.push(nodeAddOp);
              continue;
            }
          }
        }
      }

      const existingNode = findMapNodeByIdentifier(
        nodeAddOp.placeName,
        context.newMapData.nodes,
        context.newMapData,
        context.referenceMapNodeId
      ) as MapNode | undefined;

      const reusableNode =
        existingNode &&
        ((resolvedParentId === undefined && !existingNode.data.parentNodeId) ||
          existingNode.data.parentNodeId === resolvedParentId) &&
        (existingNode.placeName.toLowerCase() === nodeAddOp.placeName.toLowerCase() ||
          (existingNode.data.aliases?.some(a => a.toLowerCase() === nodeAddOp.placeName.toLowerCase()) ?? false) ||
          nodeAddOp.aliases.some(a => a.toLowerCase() === existingNode.placeName.toLowerCase()))
          ? existingNode
          : null;

      if (reusableNode) {
        const aliasSet = new Set([...(reusableNode.data.aliases ?? [])]);
        nodeAddOp.aliases.forEach(a => aliasSet.add(a));
        reusableNode.data.aliases = Array.from(aliasSet);
        if (nodeAddOp.description && reusableNode.data.description.trim().length === 0) {
          reusableNode.data.description = nodeAddOp.description;
        }
        Reflect.deleteProperty(
          context.newNodesInBatchIdNameMap,
          nodeAddOp.placeName,
        );
        continue;
      }

      const preId = (nodeAddOp as unknown as Record<string, unknown>).__generatedId as
        string | undefined;
      const newNodeId = preId ?? buildNodeId(nodeAddOp.placeName);

      const { description, aliases, status, nodeType, parentNodeId: _unused, ...rest } = nodeAddOp;
      void _unused;

      const newNodeData: MapNodeData = {
        description,
        aliases,
        status,
        parentNodeId: resolvedParentId,
        nodeType,
        ...rest,
      };

      const newNode: MapNode = {
        id: newNodeId,
        placeName: nodeAddOp.placeName,
        position: { x: 0, y: 0 },
        data: newNodeData,
      };

      context.newMapData.nodes.push(newNode);
      context.newlyAddedNodes.push(newNode);
      context.nodeIdMap.set(newNodeId, newNode);
      context.nodeNameMap.set(nodeAddOp.placeName, newNode);
      if (newNode.data.aliases) {
        newNode.data.aliases.forEach(a => context.nodeAliasMap.set(a.toLowerCase(), newNode));
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
        if (isEdgeConnectionAllowed(newNode, sameTypeParent, 'path', context.nodeIdMap)) {
          addEdgeWithTracking(newNode, sameTypeParent, edgeData, context.newMapData.edges, context.edgesMap);
        } else {
          context.pendingChainRequests.push(buildChainRequest(newNode, sameTypeParent, edgeData, context.nodeIdMap));
        }
      }
    }

    if (nextQueue.length === unresolvedQueue.length) {
      if (!triedParentInference) {
        for (const unresolved of nextQueue) {
          const guessed = await fetchLikelyParentNode_Service(
            {
              placeName: unresolved.placeName,
              description: unresolved.description,
              nodeType: unresolved.nodeType,
              status: unresolved.status,
              aliases: unresolved.aliases,
            },
            {
              sceneDescription: context.sceneDesc,
              logMessage: context.logMsg,
              localPlace: context.localPlace,
              theme: context.theme,
              currentMapNodeId: context.referenceMapNodeId,
              mapNodes: context.nodesFromMapData,
              mapEdges: context.edgesFromMapData,
            },
            context.minimalModelCalls
          );
          unresolved.parentNodeId = guessed ?? ROOT_MAP_NODE_ID;
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
