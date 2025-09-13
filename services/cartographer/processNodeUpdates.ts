import type { Item, MapEdge } from '../../types';
import { suggestNodeTypeDowngrade } from '../../utils/mapHierarchyUpgradeUtils';
import type { ApplyUpdatesContext } from './updateContext';
import { ROOT_MAP_NODE_ID } from '../../constants';

export async function processNodeUpdates(ctx: ApplyUpdatesContext): Promise<void> {
  for (const nodeUpdateOp of ctx.payload.nodesToUpdate ?? []) {
    const node = await ctx.resolveNodeReference(nodeUpdateOp.placeName);

    if (node) {
      let resolvedParentIdOnUpdate: string | undefined = node.data.parentNodeId ?? undefined;

      if (nodeUpdateOp.parentNodeId !== undefined) {
        const parentField = nodeUpdateOp.parentNodeId;
        if (parentField === ROOT_MAP_NODE_ID) {
          resolvedParentIdOnUpdate = undefined;
        } else {
          const parentNode = await ctx.resolveNodeReference(parentField);
          if (parentNode) {
            resolvedParentIdOnUpdate = parentNode.id;
            let finalType = nodeUpdateOp.nodeType ?? node.data.nodeType;
            if (parentNode.data.nodeType === finalType) {
              const downgraded = suggestNodeTypeDowngrade(
                node,
                parentNode.data.nodeType,
                ctx.newMapData.nodes,
              );
              if (downgraded) {
                finalType = downgraded;
                resolvedParentIdOnUpdate = parentNode.id;
              } else {
                resolvedParentIdOnUpdate = parentNode.data.parentNodeId;
              }
            }
            node.data.nodeType = finalType;
          } else {
            console.warn(
              `MapUpdate (nodesToUpdate): Feature node "${nodeUpdateOp.placeName}" trying to update parentNodeId to NAME "${nodeUpdateOp.parentNodeId}" which was not found.`
            );
            resolvedParentIdOnUpdate = undefined;
          }
        }
      }
      if (nodeUpdateOp.parentNodeId === undefined && nodeUpdateOp.nodeType !== undefined) {
        node.data.nodeType = nodeUpdateOp.nodeType;
      }

      if (nodeUpdateOp.description !== undefined)
        node.data.description = nodeUpdateOp.description;
      if (nodeUpdateOp.aliases !== undefined) {
        node.data.aliases = nodeUpdateOp.aliases;
        for (const [k, v] of Array.from(ctx.themeNodeAliasMap.entries())) {
          if (v.id === node.id) ctx.themeNodeAliasMap.delete(k);
        }
        node.data.aliases.forEach(a => ctx.themeNodeAliasMap.set(a.toLowerCase(), node));
      }
      if (nodeUpdateOp.status !== undefined) node.data.status = nodeUpdateOp.status;
      node.data.parentNodeId = resolvedParentIdOnUpdate;
      for (const key in nodeUpdateOp) {
        if (!['description', 'aliases', 'status', 'parentNodeId', 'nodeType', 'placeName', 'visited', 'newPlaceName'].includes(key)) {
          (node.data as Record<string, unknown>)[key] = (nodeUpdateOp as unknown as Record<string, unknown>)[key];
        }
      }
      if (nodeUpdateOp.newPlaceName && nodeUpdateOp.newPlaceName !== node.placeName) {
        const oldBatchEntryKey = Object.keys(ctx.newNodesInBatchIdNameMap).find(
          key => ctx.newNodesInBatchIdNameMap[key].id === node.id
        );
        if (oldBatchEntryKey) {
          Reflect.deleteProperty(ctx.newNodesInBatchIdNameMap, oldBatchEntryKey);
          ctx.newNodesInBatchIdNameMap[nodeUpdateOp.newPlaceName] = {
            id: node.id,
            name: nodeUpdateOp.newPlaceName,
          };
        }
        ctx.themeNodeNameMap.delete(node.placeName);
        const oldName = node.placeName;
        node.placeName = nodeUpdateOp.newPlaceName;
        ctx.themeNodeNameMap.set(node.placeName, node);
        node.data.aliases ??= [];
        if (!node.data.aliases.includes(oldName)) node.data.aliases.push(oldName);
        for (const [k, v] of Array.from(ctx.themeNodeAliasMap.entries())) {
          if (v.id === node.id) ctx.themeNodeAliasMap.delete(k);
        }
        node.data.aliases.forEach(a => ctx.themeNodeAliasMap.set(a.toLowerCase(), node));
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
      ctx.themeNodeNameMap.delete(node.placeName);
      ctx.themeNodeIdMap.delete(removedNodeId);
      ctx.newMapData.edges = ctx.newMapData.edges.filter(
        edge => edge.sourceNodeId !== removedNodeId && edge.targetNodeId !== removedNodeId
      );
      ctx.themeEdgesMap.forEach((edgesArr: Array<MapEdge>, nid: string) => {
        ctx.themeEdgesMap.set(
          nid,
          edgesArr.filter(e => e.sourceNodeId !== removedNodeId && e.targetNodeId !== removedNodeId)
        );
      });
      ctx.themeEdgesMap.delete(removedNodeId);
      for (const [k, v] of Array.from(ctx.themeNodeAliasMap.entries())) {
        if (v.id === removedNodeId) ctx.themeNodeAliasMap.delete(k);
      }
      const batchKey = Object.keys(ctx.newNodesInBatchIdNameMap).find(
        k => ctx.newNodesInBatchIdNameMap[k].id === removedNodeId || k === nodeRemoveOp.nodeName
      );
      if (batchKey) Reflect.deleteProperty(ctx.newNodesInBatchIdNameMap, batchKey);
    } else {
      console.warn(`MapUpdate (nodesToRemove): Node "${nodeRemoveOp.nodeId}" not found for removal.`);
    }
  }
}
