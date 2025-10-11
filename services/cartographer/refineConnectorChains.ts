import { generateUniqueId, findMapNodeByIdentifier } from '../../utils/entityUtils';
import { isEdgeConnectionAllowed, addEdgeWithTracking } from './edgeUtils';
import { buildChainRequest, filterEdgeChainRequests } from './connectorChains';
import { fetchConnectorChains } from '../corrections/edgeFixes';
import { MAX_RETRIES, MAX_CHAIN_REFINEMENT_ROUNDS, ROOT_MAP_NODE_ID } from '../../constants';
import type { MapNode, AINodeAdd, AIEdgeAdd, MapNodeData } from '../../types';
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
    mapNodes: ctx.newMapData.nodes,
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
      chainResult = await fetchConnectorChains(chainRequests, chainContext);
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
        const description = typeof nodeData.description === "string" ? nodeData.description : "Connector node";
        const status: MapNodeData['status'] =
          typeof nodeData.status === "string" ? (nodeData.status) : ("discovered" as MapNodeData['status']);
        const type: MapNodeData['type'] =
          typeof nodeData.type === "string" ? (nodeData.type) : 'feature';
        const aliases = Array.isArray(nodeData.aliases)
          ? nodeData.aliases.filter((alias): alias is string => typeof alias === "string")
          : undefined;
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
            const aliasSet = new Set([...(existing.aliases ?? [])]);
            nodeData.aliases.forEach(a => aliasSet.add(a));
            existing.aliases = Array.from(aliasSet);
            existing.aliases.forEach(a => ctx.nodeAliasMap.set(a.toLowerCase(), existing));
          }
          if (nodeData.description && existing.description.trim().length === 0) {
            existing.description = nodeData.description;
          }
          return;
        }

        const newId = generateUniqueId(`node-${nAdd.placeName}-`);
        const node: MapNode = {
          id: newId,
          placeName: nAdd.placeName,
          position: parent ? { ...parent.position } : { x: 0, y: 0 },
          description,
          aliases,
          status,
          parentNodeId: parentId,
          type,
        };
        const nodeRecord = node as Record<string, unknown>;
        for (const key of Object.keys(nodeData) as Array<keyof typeof nodeData>) {
          if (['description', 'aliases', 'status', 'parentNodeId', 'type', 'placeName'].includes(key)) continue;
          const typedValue = nodeData[key];
          if (typedValue === undefined) continue;
          const keyName = key as string;
          nodeRecord[keyName] = typedValue;
        }
        ctx.newMapData.nodes.push(node);
        ctx.newlyAddedNodes.push(node);
        ctx.nodeIdMap.set(node.id, node);
        ctx.nodeNameMap.set(node.placeName, node);
        if (node.aliases) {
          node.aliases.forEach(a => ctx.nodeAliasMap.set(a.toLowerCase(), node));
        }
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
          const normalizedType = edgeData.type ?? 'path';
          const pairKey =
            src.id < tgt.id
              ? `${src.id}|${tgt.id}|${normalizedType}`
              : `${tgt.id}|${src.id}|${normalizedType}`;
          if (ctx.processedChainKeys.has(pairKey)) return;
          ctx.processedChainKeys.add(pairKey);
          const normalizedStatus = edgeData.status ?? 'open';
          if (isEdgeConnectionAllowed(src, tgt, normalizedType, ctx.nodeIdMap)) {
            addEdgeWithTracking(
              src,
              tgt,
              {
                description: edgeData.description,
                status: normalizedStatus,
                travelTime: edgeData.travelTime,
                type: normalizedType,
              },
              ctx.newMapData.edges,
              ctx.edgesMap
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
                  status: normalizedStatus,
                  travelTime: edgeData.travelTime,
                  type: normalizedType,
                },
                ctx.nodeIdMap,
              ),
            );
          }
        }
      });
      chainContext.mapNodes = ctx.newMapData.nodes;
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
