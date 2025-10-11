import type { MapNode, MapEdgeData, MapNodeData } from '../../types';
import { findMapNodeByIdentifier, buildNodeId } from '../../utils/entityUtils';
import { findClosestAllowedParent } from '../../utils/mapGraphUtils';
import { suggestNodeTypeDowngrade } from '../../utils/mapHierarchyUpgradeUtils';
import { isEdgeConnectionAllowed, addEdgeWithTracking } from './edgeUtils';
import { ROOT_MAP_NODE_ID, VALID_NODE_TYPE_VALUES } from '../../constants';
import { buildChainRequest } from './connectorChains';
import { fetchLikelyParentNode } from '../corrections/placeDetails';
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
      const normalizedDescription = typeof nodeAddOp.description === "string" ? nodeAddOp.description : "";
      if (typeof nodeAddOp.description !== "string") nodeAddOp.description = normalizedDescription;
      const normalizedAliases = Array.isArray(nodeAddOp.aliases)
        ? nodeAddOp.aliases.filter((alias): alias is string => typeof alias === "string")
        : [];
      nodeAddOp.aliases = normalizedAliases;
      const normalizedStatus: MapNodeData['status'] =
        typeof nodeAddOp.status === "string" ? nodeAddOp.status : ("discovered" as MapNodeData['status']);
      nodeAddOp.status = normalizedStatus;
      const legacyNodeType = (nodeAddOp as { nodeType?: unknown }).nodeType;
      const candidateType =
        isValidNodeType(nodeAddOp.type)
          ? nodeAddOp.type
          : isValidNodeType(legacyNodeType)
            ? legacyNodeType
            : 'feature';
      const childType: MapNodeData['type'] = candidateType;
      nodeAddOp.type = childType;
      (nodeAddOp as { nodeType?: MapNodeData['type'] }).nodeType = childType;

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
            let adjustedChildType = nodeAddOp.type;
            if (parent.type === adjustedChildType) {
              const downgraded = suggestNodeTypeDowngrade(
                {
                  id: 'temp',
                  placeName: nodeAddOp.placeName,
                  position: { x: 0, y: 0 },
                  description: nodeAddOp.description,
                  aliases: nodeAddOp.aliases,
                  status: normalizedStatus,
                  parentNodeId: parent.id,
                  type: adjustedChildType,
                },
                parent.type,
                context.newMapData.nodes,
              );
              if (downgraded) {
                nodeAddOp.type = downgraded;
                adjustedChildType = downgraded;
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
                adjustedChildType,
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
        ((resolvedParentId === undefined && !existingNode.parentNodeId) ||
          existingNode.parentNodeId === resolvedParentId) &&
        (existingNode.placeName.toLowerCase() === nodeAddOp.placeName.toLowerCase() ||
          (existingNode.aliases?.some(a => a.toLowerCase() === nodeAddOp.placeName.toLowerCase()) ?? false) ||
          nodeAddOp.aliases.some(a => a.toLowerCase() === existingNode.placeName.toLowerCase()))
          ? existingNode
          : null;

      if (reusableNode) {
        const aliasSet = new Set([...(reusableNode.aliases ?? [])]);
        nodeAddOp.aliases.forEach(a => aliasSet.add(a));
        reusableNode.aliases = Array.from(aliasSet);
        if (nodeAddOp.description && reusableNode.description.trim().length === 0) {
          reusableNode.description = nodeAddOp.description;
        }
        Reflect.deleteProperty(
          context.newNodesInBatchIdNameMap,
          nodeAddOp.placeName,
        );
        continue;
      }

      const preId = context.newNodesInBatchIdNameMap[nodeAddOp.placeName]?.id;
      const newNodeId = preId ?? buildNodeId(nodeAddOp.placeName);

      const additionalFields: Record<string, unknown> = {};
      const nodeAddRecord = nodeAddOp as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(nodeAddRecord)) {
        if (!['placeName', 'description', 'aliases', 'status', 'parentNodeId', 'type', 'nodeType'].includes(key)) {
          additionalFields[key] = value;
        }
      }

      const newNode: MapNode = {
        id: newNodeId,
        placeName: nodeAddOp.placeName,
        position: { x: 0, y: 0 },
        description: normalizedDescription,
        aliases: normalizedAliases,
        status: normalizedStatus,
        parentNodeId: resolvedParentId,
        type: nodeAddOp.type,
        ...additionalFields,
      };

      context.newMapData.nodes.push(newNode);
      context.newlyAddedNodes.push(newNode);
      context.nodeIdMap.set(newNodeId, newNode);
      context.nodeNameMap.set(nodeAddOp.placeName, newNode);
      if (newNode.aliases) {
        newNode.aliases.forEach(a => context.nodeAliasMap.set(a.toLowerCase(), newNode));
      }
      context.newNodesInBatchIdNameMap[nodeAddOp.placeName] = { id: newNodeId, name: nodeAddOp.placeName };

      if (sameTypeParent) {
        const edgeData: MapEdgeData = {
          type: 'path',
          status:
            newNode.status === 'rumored' || sameTypeParent.status === 'rumored'
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
          const guessed = await fetchLikelyParentNode(
            {
              placeName: unresolved.placeName,
              description: unresolved.description,
              type: unresolved.type,
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
const isValidNodeType = (value: unknown): value is MapNodeData['type'] =>
  typeof value === 'string' && (VALID_NODE_TYPE_VALUES as ReadonlyArray<string>).includes(value);
