import type { MapNode } from '../../types';
import { ROOT_MAP_NODE_ID } from '../../constants';
import { findClosestAllowedParent } from '../../utils/mapGraphUtils';
import {
  suggestNodeTypeDowngrade,
  suggestNodeTypeUpgrade,
  mapHasHierarchyConflict,
} from '../../utils/mapHierarchyUpgradeUtils';
import { chooseHierarchyResolution } from '../corrections/hierarchyUpgrade';
import type { ApplyUpdatesContext } from './updateContext';

interface Net {
  desc: string;
  apply: () => void;
  cloneApply: (nodes: Array<MapNode>) => void;
}

export async function resolveHierarchyConflicts(ctx: ApplyUpdatesContext): Promise<void> {
  for (const node of ctx.newMapData.nodes) {
    const parentId = node.parentNodeId;
    if (!parentId || parentId === ROOT_MAP_NODE_ID) continue;
    const parent = ctx.nodeIdMap.get(parentId);
    if (!parent) continue;
    if (parent.type !== node.type) continue;
    await resolvePair(ctx, node, parent);
  }
}

async function resolvePair(ctx: ApplyUpdatesContext, child: MapNode, parent: MapNode): Promise<void> {
  const nets: Array<Net> = [];
  const downgrade = suggestNodeTypeDowngrade(child, parent.type, ctx.newMapData.nodes);
  if (downgrade) {
    nets.push({
      desc: `Downgrade ${child.placeName} to ${downgrade}`,
      apply: () => { child.type = downgrade; },
      cloneApply: nodes => {
        const c = nodes.find(n => n.id === child.id);
        if (c) c.type = downgrade;
      },
    });
  }

  if (parent.parentNodeId !== undefined) {
    const candidateParentId = findClosestAllowedParent(
      parent.parentNodeId === ROOT_MAP_NODE_ID ? undefined : ctx.nodeIdMap.get(parent.parentNodeId),
      child.type,
      ctx.nodeIdMap,
    );
    if (candidateParentId !== undefined && candidateParentId !== child.parentNodeId) {
      const parentName = ctx.nodeIdMap.get(candidateParentId)?.placeName ?? 'Unknown';
      nets.push({
        desc: `Reparent ${child.placeName} under ${parentName}`,
        apply: () => {
          child.parentNodeId = candidateParentId;
        },
        cloneApply: nodes => {
          const c = nodes.find(n => n.id === child.id);
          if (c) c.parentNodeId = candidateParentId;
        },
      });
    }
  }

  const upgrade = suggestNodeTypeUpgrade(parent, ctx.newMapData.nodes);
  if (upgrade) {
    nets.push({
      desc: `Upgrade ${parent.placeName} to ${upgrade}`,
      apply: () => {
        parent.type = upgrade;
      },
      cloneApply: nodes => {
        const p = nodes.find(n => n.id === parent.id);
        if (p) p.type = upgrade;
      },
    });
  }

  const validNets = nets.filter(net => {
    const clone = ctx.newMapData.nodes.map(n => ({ ...n }));
    net.cloneApply(clone);
    return !mapHasHierarchyConflict(clone);
  });

  if (validNets.length === 0) return;

  let chosen = validNets[0];
  if (validNets.length > 1) {
    const choice = await chooseHierarchyResolution(
      {
        sceneDescription: ctx.sceneDesc,
        parent,
        child,
        options: validNets.map(n => n.desc),
      },
      ctx.minimalModelCalls,
    );
    if (choice && choice >= 1 && choice <= validNets.length) {
      chosen = validNets[choice - 1];
    }
  }

  chosen.apply();
}
