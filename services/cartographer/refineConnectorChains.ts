import { generateUniqueId, findMapNodeByIdentifier } from '../../utils/entityUtils';
import { isEdgeConnectionAllowed, addEdgeWithTracking } from './edgeUtils';
import { buildChainRequest, filterEdgeChainRequests } from './connectorChains';
import { fetchConnectorChains_Service } from '../corrections/edgeFixes';
import { MAX_RETRIES, MAX_CHAIN_REFINEMENT_ROUNDS, ROOT_MAP_NODE_ID } from '../../constants';
import type { MapNode, AINodeAdd, AIEdgeAdd } from '../../types';
import type { ConnectorChainsServiceResult, EdgeChainRequest } from '../corrections/edgeFixes';
import type { ApplyUpdatesContext } from './updateContext';

export async function refineConnectorChains(ctx: ApplyUpdatesContext): Promise<void> {
  let chainRequests: Array<EdgeChainRequest> = filterEdgeChainRequests(
    ctx.pendingChainRequests.splice(0),
  );
  let refineAttempts = 0;
  const chainContext = {
    sceneDescription: ctx.sceneDesc,
    logMessage: ctx.logMsg,
    theme: ctx.theme,
    themeNodes: ctx.newMapData.nodes,
  };

  while (chainRequests.length > 0 && refineAttempts < MAX_CHAIN_REFINEMENT_ROUNDS) {
    chainRequests = filterEdgeChainRequests(chainRequests);
    let chainResult: ConnectorChainsServiceResult | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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
    }
    if (chainResult?.payload) {
      chainRequests = [];
      (chainResult.payload.nodesToAdd ?? []).forEach(nAdd => {
        const nodeData = nAdd as Partial<AINodeAdd>;
        const parent =
          nodeData.parentNodeId && nodeData.parentNodeId !== ROOT_MAP_NODE_ID
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
          if (Array.isArray(nodeData.aliases) && nodeData.aliases.length > 0) {
            const aliasSet = new Set([...(existing.data.aliases ?? [])]);
            nodeData.aliases.forEach(a => aliasSet.add(a));
            existing.data.aliases = Array.from(aliasSet);
          }
          if (nodeData.description && existing.data.description.trim().length === 0) {
            existing.data.description = nodeData.description;
          }
          return;
        }

        const newId = generateUniqueId(`node-${nAdd.placeName}-`);
        const node: MapNode = {
          id: newId,
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
        const edgeData = eAdd as Partial<AIEdgeAdd>;
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
              ? `${src.id}|${tgt.id}|${edgeData.type ?? 'path'}`
              : `${tgt.id}|${src.id}|${edgeData.type ?? 'path'}`;
          if (ctx.processedChainKeys.has(pairKey)) return;
          ctx.processedChainKeys.add(pairKey);
          if (isEdgeConnectionAllowed(src, tgt, edgeData.type, ctx.themeNodeIdMap)) {
            addEdgeWithTracking(
              src,
              tgt,
              {
                description: edgeData.description,
                status: edgeData.status,
                travelTime: edgeData.travelTime,
                type: edgeData.type,
              },
              ctx.newMapData.edges,
              ctx.themeEdgesMap
            );
          } else {
            console.warn(
              `Connector chain edge between "${src.placeName}" and "${tgt.placeName}" violates hierarchy rules. Reprocessing.`
            );
            chainRequests.push(
              buildChainRequest(
                src,
                tgt,
                {
                  description: edgeData.description,
                  status: edgeData.status,
                  travelTime: edgeData.travelTime,
                  type: edgeData.type,
                },
                ctx.themeNodeIdMap,
              ),
            );
          }
        }
      });
      chainContext.themeNodes = ctx.newMapData.nodes;
    } else {
      console.warn(
        `Connector Chains Refinement failed after ${String(MAX_RETRIES)} attempts for round ${String(
          refineAttempts + 1
        )}. Giving up on these chain requests.`
      );
      break;
    }
    chainRequests = filterEdgeChainRequests(chainRequests);
    refineAttempts++;
  }

  if (ctx.debugInfo.connectorChainsDebugInfo && ctx.debugInfo.connectorChainsDebugInfo.length === 0) {
    ctx.debugInfo.connectorChainsDebugInfo = null;
  }

}
