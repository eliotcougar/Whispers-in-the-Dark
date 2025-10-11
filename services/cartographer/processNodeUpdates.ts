import type { Item, MapEdge, MapNodeData } from '../../types';
import { suggestNodeTypeDowngrade } from '../../utils/mapHierarchyUpgradeUtils';
import type { ApplyUpdatesContext } from './updateContext';
import { ROOT_MAP_NODE_ID } from '../../constants';

export async function processNodeUpdates(ctx: ApplyUpdatesContext): Promise<void> {
  for (const nodeUpdateOp of ctx.payload.nodesToUpdate ?? []) {
    const node = await ctx.resolveNodeReference(nodeUpdateOp.placeName);

    if (node) {
      let resolvedParentIdOnUpdate: string | undefined = node.parentNodeId ?? undefined;

      if (nodeUpdateOp.parentNodeId !== undefined) {
        const parentField = nodeUpdateOp.parentNodeId;
        if (parentField === ROOT_MAP_NODE_ID) {
          resolvedParentIdOnUpdate = undefined;
        } else {
          const parentNode = await ctx.resolveNodeReference(parentField);
          if (parentNode) {
            resolvedParentIdOnUpdate = parentNode.id;
            let finalType: MapNodeData['type'] =
              typeof nodeUpdateOp.type === "string"
                ? (nodeUpdateOp.type)
                : node.type;
            if (parentNode.type === finalType) {
              const downgraded = suggestNodeTypeDowngrade(
                node,
                parentNode.type,
                ctx.newMapData.nodes,
              );
              if (downgraded) {
                finalType = downgraded;
                resolvedParentIdOnUpdate = parentNode.id;
              } else {
                resolvedParentIdOnUpdate = parentNode.parentNodeId;
              }
            }
            node.type = finalType;
          } else {
            console.warn(
              `MapUpdate (nodesToUpdate): Feature node "${nodeUpdateOp.placeName}" trying to update parentNodeId to NAME "${nodeUpdateOp.parentNodeId}" which was not found.`
            );
            resolvedParentIdOnUpdate = undefined;
          }
        }
      }
      if (nodeUpdateOp.parentNodeId === undefined && typeof nodeUpdateOp.type === "string") {
        node.type = nodeUpdateOp.type;
      }

      if (typeof nodeUpdateOp.description === "string")
        node.description = nodeUpdateOp.description;
      if (Array.isArray(nodeUpdateOp.aliases)) {
        node.aliases = nodeUpdateOp.aliases.filter((alias): alias is string => typeof alias === "string");
        for (const [k, v] of Array.from(ctx.nodeAliasMap.entries())) {
          if (v.id === node.id) ctx.nodeAliasMap.delete(k);
        }
        node.aliases.forEach(a => ctx.nodeAliasMap.set(a.toLowerCase(), node));
      }
      if (typeof nodeUpdateOp.status === "string") node.status = nodeUpdateOp.status;
      node.parentNodeId = resolvedParentIdOnUpdate;
      if ('nodeType' in (node as unknown as Record<string, unknown>)) {
        delete (node as unknown as Record<string, unknown>).nodeType;
      }
      for (const key in nodeUpdateOp) {
        if (!['description', 'aliases', 'status', 'parentNodeId', 'type', 'nodeType', 'placeName', 'visited', 'newPlaceName'].includes(key)) {
          (node as Record<string, unknown>)[key] = (nodeUpdateOp as unknown as Record<string, unknown>)[key];
        }
      }
      if (nodeUpdateOp.newPlaceName && nodeUpdateOp.newPlaceName !== node.placeName) {
        const oldBatchEntryKey = Object.keys(ctx.newNodesInBatchIdNameMap).find(
          key => {
            const entry = ctx.newNodesInBatchIdNameMap[key];
            return entry != null && entry.id === node.id;
          }
        );
        if (oldBatchEntryKey) {
          Reflect.deleteProperty(ctx.newNodesInBatchIdNameMap, oldBatchEntryKey);
          ctx.newNodesInBatchIdNameMap[nodeUpdateOp.newPlaceName] = {
            id: node.id,
            name: nodeUpdateOp.newPlaceName,
          };
        }
        ctx.nodeNameMap.delete(node.placeName);
        const oldName = node.placeName;
        node.placeName = nodeUpdateOp.newPlaceName;
        ctx.nodeNameMap.set(node.placeName, node);
        node.aliases ??= [];
        if (!node.aliases.includes(oldName)) node.aliases.push(oldName);
        for (const [k, v] of Array.from(ctx.nodeAliasMap.entries())) {
          if (v.id === node.id) ctx.nodeAliasMap.delete(k);
        }
        node.aliases.forEach(a => ctx.nodeAliasMap.set(a.toLowerCase(), node));
      }
    } else {
      console.warn(
        `MapUpdate (nodesToUpdate): Node with original name "${nodeUpdateOp.placeName}" not found for update.`
      );
    }
  }

  for (const nodeRemoveOp of ctx.nodesToRemove_mut) {
    let node = await ctx.resolveNodeReference(nodeRemoveOp.nodeId);
    if (!node && nodeRemoveOp.nodeName) {
      node = await ctx.resolveNodeReference(nodeRemoveOp.nodeName);
    }
    if (node) {
      if (
        nodeRemoveOp.nodeName &&
        node.placeName.toLowerCase() !== nodeRemoveOp.nodeName.toLowerCase()
      ) {
        console.warn(
          `MapUpdate (nodesToRemove): nodeId "${nodeRemoveOp.nodeId}" resolves to "${node.placeName}" which mismatches provided nodeName "${nodeRemoveOp.nodeName}".`
        );
      }
      const hasNonTrashItems = ctx.inventoryItems.some(
        (it: Item) => it.holderId === node.id && !it.tags?.includes('junk'),
      );
      if (hasNonTrashItems) {
        console.warn(
          `MapUpdate (nodesToRemove): Skipping removal of "${node.placeName}" because it contains non-junk items.`,
        );
        continue;
      }
      const removedNodeId = node.id;
      const index = ctx.newMapData.nodes.findIndex(n => n.id === removedNodeId);
      if (index !== -1) ctx.newMapData.nodes.splice(index, 1);
      ctx.nodeNameMap.delete(node.placeName);
      ctx.nodeIdMap.delete(removedNodeId);
      ctx.newMapData.edges = ctx.newMapData.edges.filter(
        edge => edge.sourceNodeId !== removedNodeId && edge.targetNodeId !== removedNodeId
      );
      ctx.edgesMap.forEach((edgesArr: Array<MapEdge>, nid: string) => {
        ctx.edgesMap.set(
          nid,
          edgesArr.filter(e => e.sourceNodeId !== removedNodeId && e.targetNodeId !== removedNodeId)
        );
      });
      ctx.edgesMap.delete(removedNodeId);
      for (const [k, v] of Array.from(ctx.nodeAliasMap.entries())) {
        if (v.id === removedNodeId) ctx.nodeAliasMap.delete(k);
      }
      const batchKey = Object.keys(ctx.newNodesInBatchIdNameMap).find(
        k => {
          const entry = ctx.newNodesInBatchIdNameMap[k];
          return (entry != null && entry.id === removedNodeId) || k === nodeRemoveOp.nodeName;
        }
      );
      if (batchKey) Reflect.deleteProperty(ctx.newNodesInBatchIdNameMap, batchKey);
    } else {
      console.warn(`MapUpdate (nodesToRemove): Node "${nodeRemoveOp.nodeId}" not found for removal.`);
    }
  }
}
