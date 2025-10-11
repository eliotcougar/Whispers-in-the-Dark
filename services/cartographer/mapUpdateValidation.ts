/**
 * @file mapUpdateValidation.ts
 * @description Utilities for validating the AIMapUpdatePayload structure from the map update AI.
 */
import {
  AIMapUpdatePayload,
  AINodeAdd,
  AINodeUpdate,
  AIEdgeAdd,
  AIEdgeUpdate,
  MapNodeType,
  MapNodeStatus,
  MapEdgeType,
  MapEdgeStatus,
} from '../../types';
import {
  VALID_NODE_STATUS_VALUES,
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
  VALID_EDGE_TYPE_VALUES,
} from '../../constants';

function isValidAINodeAdd(op: unknown): op is AINodeAdd {
  if (typeof op !== 'object' || op === null) return false;
  const n = op as Record<string, unknown>;
  if (typeof n.placeName !== 'string' || n.placeName.trim() === '') {
    console.warn("Validation Error (NodeAdd): 'placeName' is required. Value:", n.placeName);
    return false;
  }
  if (!Array.isArray(n.aliases) || !n.aliases.every(a => typeof a === 'string')) {
    console.warn("Validation Error (NodeAdd): 'aliases' must be an array of strings. Value:", n.aliases);
    return false;
  }
  if (typeof n.description !== 'string' || n.description.trim() === '') {
    console.warn("Validation Error (NodeAdd): 'description' is required and must be a non-empty string. Value:", n.description);
    return false;
  }
  if (typeof n.type !== 'string' || !VALID_NODE_TYPE_VALUES.includes(n.type as MapNodeType)) {
    console.warn("Validation Error (NodeAdd): 'type' is invalid. Value:", n.type);
    return false;
  }
  if (typeof n.parentNodeId !== 'string' || n.parentNodeId.trim() === '') {
    console.warn("Validation Error (NodeAdd): 'parentNodeId' is required. Value:", n.parentNodeId);
    return false;
  }
  if (typeof n.status !== 'string' || !VALID_NODE_STATUS_VALUES.includes(n.status as MapNodeStatus)) {
    console.warn("Validation Error (NodeAdd): 'status' is invalid. Value:", n.status);
    return false;
  }
  return true;
}

function isValidAINodeUpdate(op: unknown): op is AINodeUpdate {
  if (typeof op !== 'object' || op === null) return false;
  const n = op as Record<string, unknown>;
  if (typeof n.placeName !== 'string' || n.placeName.trim() === '') {
    console.warn("Validation Error (NodeUpdate): 'placeName' is required. Value:", n.placeName);
    return false;
  }
  if (n.aliases !== undefined && !(Array.isArray(n.aliases) && n.aliases.every(a => typeof a === 'string'))) {
    console.warn("Validation Error (NodeUpdate): 'aliases' must be an array of strings if provided. Value:", n.aliases);
    return false;
  }
  if (n.description !== undefined && typeof n.description !== 'string') {
    console.warn("Validation Error (NodeUpdate): 'description' must be a string if provided. Value:", n.description);
    return false;
  }
  if (n.type !== undefined && (typeof n.type !== 'string' || !VALID_NODE_TYPE_VALUES.includes(n.type as MapNodeType))) {
    console.warn("Validation Error (NodeUpdate): 'type' is invalid. Value:", n.type);
    return false;
  }
  if (n.parentNodeId !== undefined && typeof n.parentNodeId !== 'string') {
    console.warn("Validation Error (NodeUpdate): 'parentNodeId' must be a string if provided. Value:", n.parentNodeId);
    return false;
  }
  if (n.status !== undefined && (typeof n.status !== 'string' || !VALID_NODE_STATUS_VALUES.includes(n.status as MapNodeStatus))) {
    console.warn("Validation Error (NodeUpdate): 'status' is invalid. Value:", n.status);
    return false;
  }
  if (n.newPlaceName !== undefined && (typeof n.newPlaceName !== 'string' || n.newPlaceName.trim() === '')) {
    console.warn("Validation Error (NodeUpdate): 'newPlaceName' must be a non-empty string if provided. Value:", n.newPlaceName);
    return false;
  }
  return true;
}

function isValidAIEdgeAdd(op: unknown): op is AIEdgeAdd {
  if (typeof op !== 'object' || op === null) return false;
  const e = op as Record<string, unknown>;
  if (typeof e.sourcePlaceName !== 'string' || e.sourcePlaceName.trim() === '') {
    console.warn("Validation Error (EdgeAdd): 'sourcePlaceName' is required. Value:", e.sourcePlaceName);
    return false;
  }
  if (typeof e.targetPlaceName !== 'string' || e.targetPlaceName.trim() === '') {
    console.warn("Validation Error (EdgeAdd): 'targetPlaceName' is required. Value:", e.targetPlaceName);
    return false;
  }
  if (typeof e.type !== 'string') {
    console.warn("Validation Error (EdgeAdd): 'type' is invalid. Value:", e.type);
    return false;
  }
  if (!VALID_EDGE_TYPE_VALUES.includes(e.type as MapEdgeType)) {
    console.warn("Validation Error (EdgeAdd): 'type' is invalid. Value:", e.type);
    return false;
  }
  if (typeof e.status !== 'string') {
    console.warn("Validation Error (EdgeAdd): 'status' is invalid. Value:", e.status);
    return false;
  }
  if (!VALID_EDGE_STATUS_VALUES.includes(e.status as MapEdgeStatus)) {
    console.warn("Validation Error (EdgeAdd): 'status' is invalid. Value:", e.status);
    return false;
  }
  if (e.description !== undefined && typeof e.description !== 'string') {
    console.warn("Validation Error (EdgeAdd): 'description' must be a string if provided. Value:", e.description);
    return false;
  }
  if (e.travelTime !== undefined && typeof e.travelTime !== 'string') {
    console.warn("Validation Error (EdgeAdd): 'travelTime' must be a string if provided. Value:", e.travelTime);
    return false;
  }
  return true;
}

function isValidAIEdgeUpdate(op: unknown): op is AIEdgeUpdate {
  if (typeof op !== 'object' || op === null) return false;
  const e = op as Record<string, unknown>;
  if (typeof e.sourcePlaceName !== 'string' || e.sourcePlaceName.trim() === '') {
    console.warn("Validation Error (EdgeUpdate): 'sourcePlaceName' is required. Value:", e.sourcePlaceName);
    return false;
  }
  if (typeof e.targetPlaceName !== 'string' || e.targetPlaceName.trim() === '') {
    console.warn("Validation Error (EdgeUpdate): 'targetPlaceName' is required. Value:", e.targetPlaceName);
    return false;
  }
  if (e.type !== undefined) {
    if (typeof e.type !== 'string') {
      console.warn("Validation Error (EdgeUpdate): 'type' is invalid. Value:", e.type);
      return false;
    }
    if (!VALID_EDGE_TYPE_VALUES.includes(e.type as MapEdgeType)) {
      console.warn("Validation Error (EdgeUpdate): 'type' is invalid. Value:", e.type);
      return false;
    }
  }
  if (e.status !== undefined) {
    if (typeof e.status !== 'string') {
      console.warn("Validation Error (EdgeUpdate): 'status' is invalid. Value:", e.status);
      return false;
    }
    if (!VALID_EDGE_STATUS_VALUES.includes(e.status as MapEdgeStatus)) {
      console.warn("Validation Error (EdgeUpdate): 'status' is invalid. Value:", e.status);
      return false;
    }
  }
  if (e.description !== undefined && typeof e.description !== 'string') {
    console.warn("Validation Error (EdgeUpdate): 'description' must be a string if provided. Value:", e.description);
    return false;
  }
  if (e.travelTime !== undefined && typeof e.travelTime !== 'string') {
    console.warn("Validation Error (EdgeUpdate): 'travelTime' must be a string if provided. Value:", e.travelTime);
    return false;
  }
  return true;
}

export function isValidAIMapUpdatePayload(payload: AIMapUpdatePayload | null): payload is AIMapUpdatePayload {
  if (typeof payload !== 'object' || payload === null) {
    console.warn('Validation Error (AIMapUpdatePayload): Payload is not an object or is null.');
    return false;
  }
  if (payload.nodesToAdd != null) {
    if (!Array.isArray(payload.nodesToAdd) || !payload.nodesToAdd.every(isValidAINodeAdd)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToAdd' is invalid.");
      return false;
    }
  }
  if (payload.nodesToUpdate != null) {
    if (!Array.isArray(payload.nodesToUpdate) || !payload.nodesToUpdate.every(isValidAINodeUpdate)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToUpdate' is invalid.");
      return false;
    }
  }
  if (payload.nodesToRemove != null) {
    if (!Array.isArray(payload.nodesToRemove) || !payload.nodesToRemove.every(isValidAINodeRemovalInternal)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToRemove' is invalid.");
      return false;
    }
  }
  if (payload.edgesToAdd != null) {
    if (!Array.isArray(payload.edgesToAdd) || !payload.edgesToAdd.every(isValidAIEdgeAdd)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToAdd' is invalid.");
      return false;
    }
  }
  if (payload.edgesToUpdate != null) {
    if (!Array.isArray(payload.edgesToUpdate) || !payload.edgesToUpdate.every(isValidAIEdgeUpdate)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToUpdate' is invalid.");
      return false;
    }
  }
  if (payload.edgesToRemove != null) {
    if (!Array.isArray(payload.edgesToRemove) || !payload.edgesToRemove.every(isValidAIEdgeRemovalInternal)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToRemove' is invalid.");
      return false;
    }
  }
  if (payload.suggestedCurrentMapNodeId != null && typeof payload.suggestedCurrentMapNodeId !== 'string') {
    console.warn("Validation Error (AIMapUpdatePayload): 'suggestedCurrentMapNodeId' must be a string or null if present. Value:", payload.suggestedCurrentMapNodeId);
    return false;
  }
  return true;
}

function isValidAINodeRemovalInternal(nodeRemove: unknown): boolean {
  if (typeof nodeRemove !== 'object' || nodeRemove === null) return false;
  const rem = nodeRemove as Record<string, unknown>;
  if (typeof rem.nodeId !== 'string' || rem.nodeId.trim() === '') {
    console.warn("Validation Error (NodeRemove): 'nodeId' is required. Value:", rem.nodeId);
    return false;
  }
  if (rem.nodeName !== undefined && (typeof rem.nodeName !== 'string' || rem.nodeName.trim() === '')) {
    console.warn("Validation Error (NodeRemove): 'nodeName' must be a non-empty string if provided. Value:", rem.nodeName);
    return false;
  }
  return true;
}

function isValidAIEdgeRemovalInternal(edgeRemove: unknown): boolean {
  if (typeof edgeRemove !== 'object' || edgeRemove === null) return false;
  const rem = edgeRemove as Record<string, unknown>;
  if (typeof rem.edgeId !== 'string' || rem.edgeId.trim() === '') {
    console.warn("Validation Error (EdgeRemove): 'edgeId' is required. Value:", rem.edgeId);
    return false;
  }
  if (rem.sourceId !== undefined && (typeof rem.sourceId !== 'string' || rem.sourceId.trim() === '')) {
    console.warn("Validation Error (EdgeRemove): 'sourceId' must be a non-empty string if provided. Value:", rem.sourceId);
    return false;
  }
  if (rem.targetId !== undefined && (typeof rem.targetId !== 'string' || rem.targetId.trim() === '')) {
    console.warn("Validation Error (EdgeRemove): 'targetId' must be a non-empty string if provided. Value:", rem.targetId);
    return false;
  }
  return true;
}
