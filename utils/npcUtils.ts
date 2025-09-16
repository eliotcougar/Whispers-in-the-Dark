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
import { DEFAULT_NPC_ATTITUDE } from '../constants';
import { buildNPCId } from './entityUtils';

const normalizeAttitude = (attitude?: string | null): string => {
  const trimmed = (attitude ?? '').trim();
  if (trimmed.length === 0) return DEFAULT_NPC_ATTITUDE;
  return trimmed;
};

const normalizeKnownPlayerNames = (names?: Array<string> | string | null): Array<string> => {
  if (names === undefined || names === null) return [];
  const source = Array.isArray(names) ? names : [names];
  const sanitized: Array<string> = [];
  for (const entry of source) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;
    if (!sanitized.includes(trimmed)) {
      sanitized.push(trimmed);
    }
  }
  return sanitized;
};

export const buildNPCChangeRecords = (
  npcsAddedFromAI: Array<ValidNewNPCPayload>,
  npcsUpdatedFromAI: Array<ValidNPCUpdatePayload>,
  currentAllNPCs: Array<NPC>,
): Array<NPCChangeRecord> => {
  const records: Array<NPCChangeRecord> = [];
  npcsAddedFromAI.forEach(npcAdd => {
    const newNPC: NPC = {
      ...npcAdd,
      id: buildNPCId(npcAdd.name),
      aliases: npcAdd.aliases ?? [],
      presenceStatus: npcAdd.presenceStatus ?? 'unknown',
      attitudeTowardPlayer: normalizeAttitude(npcAdd.attitudeTowardPlayer),
      knownPlayerNames: normalizeKnownPlayerNames(npcAdd.knownPlayerNames),
      lastKnownLocation: npcAdd.lastKnownLocation ?? null,
      preciseLocation: npcAdd.preciseLocation ?? null,
      dialogueSummaries: [],
    };
    records.push({ type: 'add', npcName: newNPC.name, addedNPC: newNPC });
  });

  npcsUpdatedFromAI.forEach(npcUpdate => {
    const oldNPC = currentAllNPCs.find(
      npc => npc.name === npcUpdate.name,
    );
    if (oldNPC) {
      const newNPCData: NPC = { ...oldNPC, dialogueSummaries: oldNPC.dialogueSummaries ?? [] };
      if (npcUpdate.newDescription !== undefined) newNPCData.description = npcUpdate.newDescription;
      if (npcUpdate.newAliases !== undefined) newNPCData.aliases = npcUpdate.newAliases;
      if (npcUpdate.addAlias) {
        newNPCData.aliases = Array.from(new Set([...(newNPCData.aliases ?? []), npcUpdate.addAlias]));
      }
      if (npcUpdate.newPresenceStatus !== undefined) newNPCData.presenceStatus = npcUpdate.newPresenceStatus;
      if (npcUpdate.newAttitudeTowardPlayer !== undefined) newNPCData.attitudeTowardPlayer = normalizeAttitude(npcUpdate.newAttitudeTowardPlayer);
      if (npcUpdate.newKnownPlayerNames !== undefined) newNPCData.knownPlayerNames = normalizeKnownPlayerNames(npcUpdate.newKnownPlayerNames);
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
  currentAllNPCs: Array<NPC>,
): Array<NPC> => {
  const newAllNPCs = [...currentAllNPCs];
  npcsAddedFromAI.forEach(npcAdd => {
    if (!newAllNPCs.some(npc => npc.name === npcAdd.name)) {
      const newNPC: NPC = {
        ...npcAdd,
        id: buildNPCId(npcAdd.name),
        aliases: npcAdd.aliases ?? [],
        presenceStatus: npcAdd.presenceStatus ?? 'unknown',
        attitudeTowardPlayer: normalizeAttitude(npcAdd.attitudeTowardPlayer),
        knownPlayerNames: normalizeKnownPlayerNames(npcAdd.knownPlayerNames),
        lastKnownLocation: npcAdd.lastKnownLocation ?? null,
        preciseLocation: npcAdd.preciseLocation ?? null,
        dialogueSummaries: [],
      };
      if (newNPC.presenceStatus === 'distant' || newNPC.presenceStatus === 'unknown') {
        newNPC.preciseLocation = null;
      }
      newAllNPCs.push(newNPC);
    }
  });

  npcsUpdatedFromAI.forEach(npcUpdate => {
    const idx = newAllNPCs.findIndex(
      npc => npc.name === npcUpdate.name,
    );
    if (idx !== -1) {
      const npcToUpdate: NPC = {
        ...newAllNPCs[idx],
        dialogueSummaries: newAllNPCs[idx].dialogueSummaries ?? [],
      };
      if (npcUpdate.newDescription !== undefined) npcToUpdate.description = npcUpdate.newDescription;
      if (npcUpdate.newAliases !== undefined) npcToUpdate.aliases = npcUpdate.newAliases;
      if (npcUpdate.addAlias) {
        npcToUpdate.aliases = Array.from(
          new Set([...(npcToUpdate.aliases ?? []), npcUpdate.addAlias]),
        );
      }
      if (npcUpdate.newPresenceStatus !== undefined) npcToUpdate.presenceStatus = npcUpdate.newPresenceStatus;
      if (npcUpdate.newAttitudeTowardPlayer !== undefined) npcToUpdate.attitudeTowardPlayer = normalizeAttitude(npcUpdate.newAttitudeTowardPlayer);
      if (npcUpdate.newKnownPlayerNames !== undefined) npcToUpdate.knownPlayerNames = normalizeKnownPlayerNames(npcUpdate.newKnownPlayerNames);
      if (npcUpdate.newLastKnownLocation !== undefined) npcToUpdate.lastKnownLocation = npcUpdate.newLastKnownLocation;
      if (npcUpdate.newPreciseLocation !== undefined) npcToUpdate.preciseLocation = npcUpdate.newPreciseLocation;

      if (npcToUpdate.presenceStatus === 'distant' || npcToUpdate.presenceStatus === 'unknown') {
        npcToUpdate.preciseLocation = null;
      } else {
        npcToUpdate.preciseLocation ??=
          npcToUpdate.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
      }
      newAllNPCs[idx] = npcToUpdate;
    }
  });
  return newAllNPCs;
};
