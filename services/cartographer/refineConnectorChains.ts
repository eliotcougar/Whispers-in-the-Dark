import { generateUniqueId, findMapNodeByIdentifier } from '../../utils/entityUtils';
import { isEdgeConnectionAllowed, addEdgeWithTracking } from './edgeUtils';
import { buildChainRequest } from './connectorChains';
import { fetchConnectorChains_Service } from '../corrections/edgeFixes';
import { resolveSplitFamilyOrphans_Service } from '../corrections/hierarchyUpgrade';
import { MAX_RETRIES } from '../../constants';
import type { MapNode } from '../../types';
import type { ConnectorChainsServiceResult, EdgeChainRequest } from '../corrections/edgeFixes';
import type { ApplyUpdatesContext } from './updateContext';

const MAX_CHAIN_REFINEMENT_ROUNDS = 2;

export async function refineConnectorChains(ctx: ApplyUpdatesContext): Promise<void> {
  let chainRequests: Array<EdgeChainRequest> = ctx.pendingChainRequests.splice(0);
  let refineAttempts = 0;
  const chainContext = {
    sceneDescription: ctx.sceneDesc,
    logMessage: ctx.logMsg,
    currentTheme: ctx.currentTheme,
    themeNodes: ctx.newMapData.nodes.filter(n => n.themeName === ctx.currentTheme.name),
  };

  while (chainRequests.length > 0 && refineAttempts < MAX_CHAIN_REFINEMENT_ROUNDS) {
    let chainResult: ConnectorChainsServiceResult | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; ) {
      console.log(
        `Connector Chains Refinement: Round ${String(refineAttempts + 1)}/${String(
          MAX_CHAIN_REFINEMENT_ROUNDS
        )}, Attempt ${String(attempt + 1)}/${String(MAX_RETRIES)}`
      );
      chainResult = await fetchConnectorChains_Service(chainRequests, chainContext);
      if (chainResult.debugInfo) {
        ctx.debugInfo.connectorChainsDebugInfo?.push({
          round: refineAttempts + 1,
          ...chainResult.debugInfo,
        });
      }
      if (chainResult.payload) {
        break;
      }
      console.warn(
        `Connector Chains Refinement (Round ${String(refineAttempts + 1)}, Attempt ${String(
          attempt + 1
        )}): invalid or empty response. Retrying.`
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
                ctx.newMapData.nodes,
                ctx.newMapData,
                ctx.referenceMapNodeId
              ) as MapNode | undefined)
            : undefined;
        const parentId = parent ? parent.id : undefined;

        const existing = findMapNodeByIdentifier(
          nAdd.placeName,
          ctx.newMapData.nodes,
          ctx.newMapData,
          ctx.referenceMapNodeId
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
          themeName: ctx.currentTheme.name,
          placeName: nAdd.placeName,
          position: parent ? { ...parent.position } : { x: 0, y: 0 },
          data: { ...nodeData, parentNodeId: parentId },
        } as MapNode;
        ctx.newMapData.nodes.push(node);
        ctx.newlyAddedNodes.push(node);
        ctx.themeNodeIdMap.set(node.id, node);
        ctx.themeNodeNameMap.set(node.placeName, node);
      });
      (chainResult.payload.edgesToAdd ?? []).forEach(eAdd => {
        const src = findMapNodeByIdentifier(
          eAdd.sourcePlaceName,
          ctx.newMapData.nodes,
          ctx.newMapData,
          ctx.referenceMapNodeId
        ) as MapNode | undefined;
        const tgt = findMapNodeByIdentifier(
          eAdd.targetPlaceName,
          ctx.newMapData.nodes,
          ctx.newMapData,
          ctx.referenceMapNodeId
        ) as MapNode | undefined;
        if (src && tgt) {
          const pairKey =
            src.id < tgt.id
              ? `${src.id}|${tgt.id}|${eAdd.data.type ?? 'path'}`
              : `${tgt.id}|${src.id}|${eAdd.data.type ?? 'path'}`;
          if (ctx.processedChainKeys.has(pairKey)) return;
          ctx.processedChainKeys.add(pairKey);
          if (isEdgeConnectionAllowed(src, tgt, eAdd.data.type, ctx.themeNodeIdMap)) {
            addEdgeWithTracking(src, tgt, eAdd.data, ctx.newMapData.edges, ctx.themeEdgesMap);
          } else {
            console.warn(
              `Connector chain edge between "${src.placeName}" and "${tgt.placeName}" violates hierarchy rules. Reprocessing.`
            );
            chainRequests.push(buildChainRequest(src, tgt, eAdd.data, ctx.themeNodeIdMap));
          }
        }
      });
      chainContext.themeNodes = ctx.newMapData.nodes.filter(
        n => n.themeName === ctx.currentTheme.name
      );
    } else {
      console.warn(
        `Connector Chains Refinement failed after ${String(MAX_RETRIES)} attempts for round ${String(
          refineAttempts + 1
        )}. Giving up on these chain requests.`
      );
      break;
    }
    refineAttempts++;
  }

  if (ctx.debugInfo.connectorChainsDebugInfo && ctx.debugInfo.connectorChainsDebugInfo.length === 0) {
    ctx.debugInfo.connectorChainsDebugInfo = null;
  }

  if (ctx.payload.splitFamily) {
    const sf = ctx.payload.splitFamily;
    const originalParent = ctx.themeNodeIdMap.get(sf.originalNodeId);
    const newParent = ctx.themeNodeIdMap.get(sf.newNodeId);
    const connector = ctx.themeNodeIdMap.get(sf.newConnectorNodeId);
    if (originalParent && newParent && connector) {
      newParent.data.nodeType = sf.newNodeType;
      newParent.data.parentNodeId = originalParent.data.parentNodeId;
      connector.data.parentNodeId = newParent.id;
      ctx.newMapData.edges.forEach(edge => {
        if (edge.sourceNodeId === newParent.id) edge.sourceNodeId = connector.id;
        if (edge.targetNodeId === newParent.id) edge.targetNodeId = connector.id;
      });
      const originalSet = new Set(sf.originalChildren);
      const newSet = new Set(sf.newChildren);
      const orphans: Array<MapNode> = [];
      ctx.newMapData.nodes.forEach(n => {
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
          sceneDescription: ctx.sceneDesc,
          logMessage: ctx.logMsg,
          originalParent,
          newParent,
          orphanNodes: orphans,
          currentTheme: ctx.currentTheme,
        });
        resolution.originalChildren.forEach(id => {
          const node = ctx.themeNodeIdMap.get(id);
          if (node) node.data.parentNodeId = originalParent.id;
        });
        resolution.newChildren.forEach(id => {
          const node = ctx.themeNodeIdMap.get(id);
          if (node) node.data.parentNodeId = newParent.id;
        });
      }
    } else {
      console.warn('splitFamily references unknown node ids');
    }
  }
}
