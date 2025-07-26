import { isEdgeConnectionAllowed, addEdgeWithTracking } from './edgeUtils';
import { buildChainRequest } from './connectorChains';
import type { ApplyUpdatesContext } from './updateContext';

export async function processEdgeUpdates(ctx: ApplyUpdatesContext): Promise<void> {
  for (const edgeAddOp of ctx.edgesToAdd_mut) {
    const sourceNodeRef = await ctx.resolveNodeReference(edgeAddOp.sourcePlaceName);
    const targetNodeRef = await ctx.resolveNodeReference(edgeAddOp.targetPlaceName);

    if (!sourceNodeRef || !targetNodeRef) {
      console.warn(
        `MapUpdate: Skipping edge add due to missing source ("${edgeAddOp.sourcePlaceName}") or target ("${edgeAddOp.targetPlaceName}") node.`
      );
      continue;
    }

    const sourceNode = ctx.themeNodeIdMap.get(sourceNodeRef.id);
    const targetNode = ctx.themeNodeIdMap.get(targetNodeRef.id);
    if (!sourceNode || !targetNode) {
      console.warn('MapUpdate: Failed to resolve edge nodes after lookup.');
      continue;
    }

    const pairKey =
      sourceNode.id < targetNode.id
        ? `${sourceNode.id}|${targetNode.id}|${edgeAddOp.type ?? 'path'}`
        : `${targetNode.id}|${sourceNode.id}|${edgeAddOp.type ?? 'path'}`;
    if (ctx.processedChainKeys.has(pairKey)) continue;
    ctx.processedChainKeys.add(pairKey);

    const chainReq = buildChainRequest(
      sourceNode,
      targetNode,
      {
        description: edgeAddOp.description,
        status: edgeAddOp.status,
        travelTime: edgeAddOp.travelTime,
        type: edgeAddOp.type,
      },
      ctx.themeNodeIdMap,
    );
    if (!isEdgeConnectionAllowed(sourceNode, targetNode, edgeAddOp.type, ctx.themeNodeIdMap)) {
      ctx.pendingChainRequests.push(chainReq);
      continue;
    }

    addEdgeWithTracking(
      sourceNode,
      targetNode,
      {
        description: edgeAddOp.description,
        type: edgeAddOp.type,
        travelTime: edgeAddOp.travelTime,
        status:
          edgeAddOp.status ??
          (sourceNode.data.status === 'rumored' || targetNode.data.status === 'rumored'
            ? 'rumored'
            : 'open'),
      },
      ctx.newMapData.edges,
      ctx.themeEdgesMap
    );
  }

  for (const edgeUpdateOp of ctx.payload.edgesToUpdate ?? []) {
    const sourceNodeRef = await ctx.resolveNodeReference(edgeUpdateOp.sourcePlaceName);
    const targetNodeRef = await ctx.resolveNodeReference(edgeUpdateOp.targetPlaceName);
    if (!sourceNodeRef || !targetNodeRef) {
      console.warn(
        `MapUpdate: Skipping edge update due to missing source ("${edgeUpdateOp.sourcePlaceName}") or target ("${edgeUpdateOp.targetPlaceName}") node.`
      );
      continue;
    }
    const sourceNodeId = sourceNodeRef.id;
    const targetNodeId = targetNodeRef.id;
    const sourceNode = ctx.themeNodeIdMap.get(sourceNodeId);
    const targetNode = ctx.themeNodeIdMap.get(targetNodeId);
    if (!sourceNode || !targetNode) continue;

    const candidateEdges = (ctx.themeEdgesMap.get(sourceNodeId) ?? []).filter(
      e =>
        (e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId) ||
        (e.sourceNodeId === targetNodeId && e.targetNodeId === sourceNodeId)
    );

    const checkType = edgeUpdateOp.type ?? candidateEdges[0]?.data.type;
    if (!isEdgeConnectionAllowed(sourceNode, targetNode, checkType, ctx.themeNodeIdMap)) {
      console.warn(
        `MapUpdate: Edge update between "${sourceNode.placeName}" and "${targetNode.placeName}" violates hierarchy rules. Skipping update.`
      );
      continue;
    }
    const edgeToUpdate = candidateEdges.find(e =>
      edgeUpdateOp.type ? e.data.type === edgeUpdateOp.type : true
    );

    if (!edgeToUpdate) {
      console.warn(
        `MapUpdate (edgesToUpdate): Edge between "${edgeUpdateOp.sourcePlaceName}" and "${edgeUpdateOp.targetPlaceName}" not found for update.`
      );
      continue;
    }

    edgeToUpdate.data = {
      ...edgeToUpdate.data,
      description: edgeUpdateOp.description ?? edgeToUpdate.data.description,
      status: edgeUpdateOp.status ?? edgeToUpdate.data.status,
      travelTime: edgeUpdateOp.travelTime ?? edgeToUpdate.data.travelTime,
      type: edgeUpdateOp.type ?? edgeToUpdate.data.type,
    };
  }

  for (const edgeRemoveOp of ctx.edgesToRemove_mut) {
    let edge =
      ctx.newMapData.edges.find(e => e.id === edgeRemoveOp.edgeId) ??
      ctx.newMapData.edges.find(e => e.id.toLowerCase().includes(edgeRemoveOp.edgeId.toLowerCase()));
    if (!edge && edgeRemoveOp.sourceId && edgeRemoveOp.targetId) {
      const sourceNodeRef = await ctx.resolveNodeReference(edgeRemoveOp.sourceId);
      const targetNodeRef = await ctx.resolveNodeReference(edgeRemoveOp.targetId);
      if (!sourceNodeRef || !targetNodeRef) {
        console.warn(
          `MapUpdate: Skipping edge removal due to missing source ("${edgeRemoveOp.sourceId}") or target ("${edgeRemoveOp.targetId}") node.`
        );
        continue;
      }
      edge =
        ctx.newMapData.edges.find(e => {
          const matchesNodes =
            (e.sourceNodeId === sourceNodeRef.id && e.targetNodeId === targetNodeRef.id) ||
            (e.sourceNodeId === targetNodeRef.id && e.targetNodeId === sourceNodeRef.id);
          return matchesNodes;
        }) ?? undefined;
    } else if (edge) {
      if (
        (edgeRemoveOp.sourceId &&
          edge.sourceNodeId !== edgeRemoveOp.sourceId &&
          edge.targetNodeId !== edgeRemoveOp.sourceId) ||
        (edgeRemoveOp.targetId &&
          edge.sourceNodeId !== edgeRemoveOp.targetId &&
          edge.targetNodeId !== edgeRemoveOp.targetId)
      ) {
        console.warn(
          `MapUpdate (edgesToRemove): edgeId "${edgeRemoveOp.edgeId}" does not match provided sourceId/targetId.`
        );
      }
    }
    if (!edge) {
      console.warn(`MapUpdate (edgesToRemove): Edge "${edgeRemoveOp.edgeId}" not found for removal.`);
      continue;
    }
    ctx.newMapData.edges = ctx.newMapData.edges.filter(e => e !== edge);
    const arr1 = ctx.themeEdgesMap.get(edge.sourceNodeId);
    if (arr1) ctx.themeEdgesMap.set(edge.sourceNodeId, arr1.filter(e2 => e2 !== edge));
    const arr2 = ctx.themeEdgesMap.get(edge.targetNodeId);
    if (arr2) ctx.themeEdgesMap.set(edge.targetNodeId, arr2.filter(e2 => e2 !== edge));
  }
}
