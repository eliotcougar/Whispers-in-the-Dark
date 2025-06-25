/**
 * @file npcUtils.ts
 * @description Helper functions for NPC change tracking.
 */

import {
  NPC,
  NPCChangeRecord,
  ValidNPCUpdatePayload,
  ValidNewNPCPayload,
} from '../types';
import { buildNPCId } from './entityUtils';

export const buildNPCChangeRecords = (
  npcsAddedFromAI: Array<ValidNewNPCPayload>,
  npcsUpdatedFromAI: Array<ValidNPCUpdatePayload>,
  currentThemeName: string,
  currentAllNPCs: Array<NPC>,
): Array<NPCChangeRecord> => {
  const records: Array<NPCChangeRecord> = [];
  npcsAddedFromAI.forEach(npcAdd => {
    const newNPC: NPC = {
      ...npcAdd,
      id: buildNPCId(npcAdd.name),
      themeName: currentThemeName,
      aliases: npcAdd.aliases ?? [],
      presenceStatus: npcAdd.presenceStatus ?? 'unknown',
      lastKnownLocation: npcAdd.lastKnownLocation ?? null,
      preciseLocation: npcAdd.preciseLocation ?? null,
      dialogueSummaries: [],
    };
    records.push({ type: 'add', npcName: newNPC.name, addedNPC: newNPC });
  });

  npcsUpdatedFromAI.forEach(npcUpdate => {
    const oldNPC = currentAllNPCs.find(
      npc => npc.name === npcUpdate.name && npc.themeName === currentThemeName,
    );
    if (oldNPC) {
      const newNPCData: NPC = { ...oldNPC, dialogueSummaries: oldNPC.dialogueSummaries ?? [] };
      if (npcUpdate.newDescription !== undefined) newNPCData.description = npcUpdate.newDescription;
      if (npcUpdate.newAliases !== undefined) newNPCData.aliases = npcUpdate.newAliases;
      if (npcUpdate.addAlias) {
        newNPCData.aliases = Array.from(new Set([...(newNPCData.aliases ?? []), npcUpdate.addAlias]));
      }
      if (npcUpdate.newPresenceStatus !== undefined) newNPCData.presenceStatus = npcUpdate.newPresenceStatus;
      if (npcUpdate.newLastKnownLocation !== undefined) newNPCData.lastKnownLocation = npcUpdate.newLastKnownLocation;
      if (npcUpdate.newPreciseLocation !== undefined) newNPCData.preciseLocation = npcUpdate.newPreciseLocation;

      if (newNPCData.presenceStatus === 'distant' || newNPCData.presenceStatus === 'unknown') {
        newNPCData.preciseLocation = null;
      } else {
        newNPCData.preciseLocation ??=
          newNPCData.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
      }
      records.push({
        type: 'update',
        npcName: npcUpdate.name,
        oldNPC: { ...oldNPC },
        newNPC: newNPCData,
      });
    }
  });
  return records;
};

export const applyAllNPCChanges = (
  npcsAddedFromAI: Array<ValidNewNPCPayload>,
  npcsUpdatedFromAI: Array<ValidNPCUpdatePayload>,
  currentThemeName: string,
  currentallNPCs: Array<NPC>,
): Array<NPC> => {
  const newallNPCs = [...currentallNPCs];
  npcsAddedFromAI.forEach(npcAdd => {
    if (!newallNPCs.some(npc => npc.name === npcAdd.name && npc.themeName === currentThemeName)) {
      const newNPC: NPC = {
        ...npcAdd,
        id: buildNPCId(npcAdd.name),
        themeName: currentThemeName,
        aliases: npcAdd.aliases ?? [],
        presenceStatus: npcAdd.presenceStatus ?? 'unknown',
        lastKnownLocation: npcAdd.lastKnownLocation ?? null,
        preciseLocation: npcAdd.preciseLocation ?? null,
        dialogueSummaries: [],
      };
      if (newNPC.presenceStatus === 'distant' || newNPC.presenceStatus === 'unknown') {
        newNPC.preciseLocation = null;
      }
      newallNPCs.push(newNPC);
    }
  });

  npcsUpdatedFromAI.forEach(npcUpdate => {
    const idx = newallNPCs.findIndex(
      npc => npc.name === npcUpdate.name && npc.themeName === currentThemeName,
    );
    if (idx !== -1) {
      const npcToUpdate: NPC = {
        ...newallNPCs[idx],
        dialogueSummaries: newallNPCs[idx].dialogueSummaries ?? [],
      };
      if (npcUpdate.newDescription !== undefined) npcToUpdate.description = npcUpdate.newDescription;
      if (npcUpdate.newAliases !== undefined) npcToUpdate.aliases = npcUpdate.newAliases;
      if (npcUpdate.addAlias) {
        npcToUpdate.aliases = Array.from(
          new Set([...(npcToUpdate.aliases ?? []), npcUpdate.addAlias]),
        );
      }
      if (npcUpdate.newPresenceStatus !== undefined) npcToUpdate.presenceStatus = npcUpdate.newPresenceStatus;
      if (npcUpdate.newLastKnownLocation !== undefined) npcToUpdate.lastKnownLocation = npcUpdate.newLastKnownLocation;
      if (npcUpdate.newPreciseLocation !== undefined) npcToUpdate.preciseLocation = npcUpdate.newPreciseLocation;

      if (npcToUpdate.presenceStatus === 'distant' || npcToUpdate.presenceStatus === 'unknown') {
        npcToUpdate.preciseLocation = null;
      } else {
        npcToUpdate.preciseLocation ??=
          npcToUpdate.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
      }
      newallNPCs[idx] = npcToUpdate;
    }
  });
  return newallNPCs;
};
