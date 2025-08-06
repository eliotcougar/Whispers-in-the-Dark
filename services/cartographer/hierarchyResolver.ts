import type { MapNode } from '../../types';
import { findClosestAllowedParent } from '../../utils/mapGraphUtils';
import {
  suggestNodeTypeDowngrade,
  suggestNodeTypeUpgrade,
  mapHasHierarchyConflict,
} from '../../utils/mapHierarchyUpgradeUtils';
import { chooseHierarchyResolution_Service } from '../corrections/hierarchyUpgrade';
import type { ApplyUpdatesContext } from './updateContext';

interface Net {
  desc: string;
  apply: () => void;
  cloneApply: (nodes: Array<MapNode>) => void;
}

export async function resolveHierarchyConflicts(ctx: ApplyUpdatesContext): Promise<void> {
  for (const node of ctx.newMapData.nodes) {
    const parentId = node.data.parentNodeId;
    if (!parentId || parentId === 'Universe') continue;
    const parent = ctx.themeNodeIdMap.get(parentId);
    if (!parent) continue;
    if (parent.data.nodeType !== node.data.nodeType) continue;
    await resolvePair(ctx, node, parent);
  }
}

async function resolvePair(ctx: ApplyUpdatesContext, child: MapNode, parent: MapNode): Promise<void> {
  const nets: Array<Net> = [];
  const downgrade = suggestNodeTypeDowngrade(child, parent.data.nodeType, ctx.newMapData.nodes);
  if (downgrade) {
    nets.push({
      desc: `Downgrade ${child.placeName} to ${downgrade}`,
      apply: () => { child.data.nodeType = downgrade; },
      cloneApply: nodes => {
        const c = nodes.find(n => n.id === child.id);
        if (c) c.data.nodeType = downgrade;
      },
    });
  }

  if (parent.data.parentNodeId !== undefined) {
    const candidateParentId = findClosestAllowedParent(
      parent.data.parentNodeId === 'Universe' ? undefined : ctx.themeNodeIdMap.get(parent.data.parentNodeId),
      child.data.nodeType,
      ctx.themeNodeIdMap,
    );
    if (candidateParentId !== undefined && candidateParentId !== child.data.parentNodeId) {
      const parentName = ctx.themeNodeIdMap.get(candidateParentId)?.placeName ?? 'Unknown';
      nets.push({
        desc: `Reparent ${child.placeName} under ${parentName}`,
        apply: () => {
          child.data.parentNodeId = candidateParentId;
        },
        cloneApply: nodes => {
          const c = nodes.find(n => n.id === child.id);
          if (c) c.data.parentNodeId = candidateParentId;
        },
      });
    }
  }

  const upgrade = suggestNodeTypeUpgrade(parent, ctx.newMapData.nodes);
  if (upgrade) {
    nets.push({
      desc: `Upgrade ${parent.placeName} to ${upgrade}`,
      apply: () => {
        parent.data.nodeType = upgrade;
      },
      cloneApply: nodes => {
        const p = nodes.find(n => n.id === parent.id);
        if (p) p.data.nodeType = upgrade;
      },
    });
  }

  const validNets = nets.filter(net => {
    const clone = ctx.newMapData.nodes.map(n => ({ ...n, data: { ...n.data } }));
    net.cloneApply(clone);
    return !mapHasHierarchyConflict(clone);
  });

  if (validNets.length === 0) return;

  let chosen = validNets[0];
  if (validNets.length > 1) {
    const choice = await chooseHierarchyResolution_Service(
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
