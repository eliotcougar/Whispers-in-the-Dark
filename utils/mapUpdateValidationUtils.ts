
/**
 * @file mapUpdateValidationUtils.ts
 * @description Utilities for validating the AIMapUpdatePayload structure from the map update AI.
 */
import { AIMapUpdatePayload, MapNodeData, MapEdgeData } from '../types'; // AINodeUpdate is implicitly part of AIMapUpdatePayload

export const VALID_NODE_STATUS_VALUES: ReadonlyArray<MapNodeData['status']> = ['undiscovered', 'discovered', 'rumored', 'quest_target'];
export const VALID_EDGE_TYPE_VALUES: ReadonlyArray<MapEdgeData['type']> = ['path', 'road', 'sea route', 'door', 'teleporter', 'secret_passage', 'river_crossing', 'temporary_bridge', 'boarding_hook', 'containment'];
export const VALID_EDGE_STATUS_VALUES: ReadonlyArray<MapEdgeData['status']> = ['open', 'accessible', 'closed', 'locked', 'blocked', 'hidden', 'rumored', 'one_way', 'collapsed', 'removed', 'active', 'inactive'];

function isValidAINodeDataInternal(data: any, isNodeAddContext: boolean): boolean {
  if (typeof data !== 'object' || data === null) {
    console.warn("Validation Error (NodeData): Data is not an object. Value:", data);
    return false;
  }

  // Status: Required for Add, Optional for Update. Must be valid if present.
  if (isNodeAddContext) {
    if (typeof data.status !== 'string' || !VALID_NODE_STATUS_VALUES.includes(data.status as any)) {
      console.warn("Validation Error (NodeData - Add): 'status' is mandatory and invalid. Value:", data.status, "Valid are:", VALID_NODE_STATUS_VALUES);
      return false;
    }
  } else { // Update context
    if (data.status !== undefined && (typeof data.status !== 'string' || !VALID_NODE_STATUS_VALUES.includes(data.status as any))) {
      console.warn("Validation Error (NodeData - Update): Invalid 'status'. Value:", data.status);
      return false;
    }
  }

  // Description: Required for Add (non-empty string), Optional for Update (string if present).
  if (isNodeAddContext) {
    if (typeof data.description !== 'string' || data.description.trim() === '') {
      console.warn("Validation Error (NodeData - Add): 'description' is mandatory and must be a non-empty string. Value:", data.description);
      return false;
    }
  } else { // Update context
    if (data.description !== undefined && typeof data.description !== 'string') {
      console.warn("Validation Error (NodeData - Update): 'description' if present must be a string. Value:", data.description);
      return false;
    }
  }

  // Aliases: Required for Add (array of strings, can be empty), Optional for Update (array of strings if present).
  if (isNodeAddContext) {
    if (!Array.isArray(data.aliases) || !data.aliases.every((a: any) => typeof a === 'string')) {
      console.warn("Validation Error (NodeData - Add): 'aliases' is mandatory and must be an array of strings (can be empty []). Value:", data.aliases);
      return false;
    }
  } else { // Update context
    if (data.aliases !== undefined && !(Array.isArray(data.aliases) && data.aliases.every((a: any) => typeof a === 'string'))) {
      console.warn("Validation Error (NodeData - Update): 'aliases' if present must be an array of strings. Value:", data.aliases);
      return false;
    }
  }
  
  // isLeaf: Optional for both. Boolean if present.
  if (data.isLeaf !== undefined && typeof data.isLeaf !== 'boolean') {
    console.warn("Validation Error (NodeData): 'isLeaf' must be boolean if present. Value:", data.isLeaf);
    return false;
  }
  
  // parentNodeId: Optional for both. String if present.
  if (data.parentNodeId !== undefined && (data.parentNodeId !== null && (typeof data.parentNodeId !== 'string' || data.parentNodeId.trim() === ''))) {
    // Allow null to clear parentNodeId
    console.warn("Validation Error (NodeData): 'parentNodeId' must be a non-empty string or null if present. Value:", data.parentNodeId);
    return false;
  }
  
  return true;
}


function isValidAIEdgeDataInternal(data: any, isEdgeAddContext: boolean): boolean {
  if (typeof data !== 'object' || data === null) return false;
  
  if (isEdgeAddContext) { // Type and status are required for new edges
    if (typeof data.type !== 'string' || !VALID_EDGE_TYPE_VALUES.includes(data.type as any)) {
      console.warn("Validation Error (EdgeData - Add): 'type' is required and invalid. Value:", data.type, "Valid are:", VALID_EDGE_TYPE_VALUES);
      return false;
    }
    if (typeof data.status !== 'string' || !VALID_EDGE_STATUS_VALUES.includes(data.status as any)) {
      console.warn("Validation Error (EdgeData - Add): 'status' is required and invalid. Value:", data.status, "Valid are:", VALID_EDGE_STATUS_VALUES);
      return false;
    }
  } else { // For updates, type and status are optional
    if (data.type !== undefined && (typeof data.type !== 'string' || !VALID_EDGE_TYPE_VALUES.includes(data.type as any))) {
        console.warn("Validation Error (EdgeData - Update): Invalid 'type'. Value:", data.type, "Valid are:", VALID_EDGE_TYPE_VALUES);
        return false;
    }
    if (data.status !== undefined && (typeof data.status !== 'string' || !VALID_EDGE_STATUS_VALUES.includes(data.status as any))) {
        console.warn("Validation Error (EdgeData - Update): Invalid 'status'. Value:", data.status, "Valid are:", VALID_EDGE_STATUS_VALUES);
        return false;
    }
  }

  if (data.description !== undefined && typeof data.description !== 'string') {
    console.warn("Validation Error (EdgeData): Invalid 'description'. Value:", data.description);
    return false;
  }
  if (data.travelTime !== undefined && typeof data.travelTime !== 'string') {
    console.warn("Validation Error (EdgeData): Invalid 'travelTime'. Value:", data.travelTime);
    return false;
  }
  return true;
}

function isValidAINodeOperationInternal(nodeOp: any, isNodeAddOperation: boolean): boolean {
  if (typeof nodeOp !== 'object' || nodeOp === null) return false;
  if (typeof nodeOp.placeName !== 'string' || nodeOp.placeName.trim() === '') {
    console.warn(`Validation Error (Node${isNodeAddOperation ? 'Add' : 'Update'}): 'placeName' is required. Value:`, nodeOp.placeName);
    return false;
  }
  
  const dataFieldKey = isNodeAddOperation ? 'data' : 'newData';
  const dataField = nodeOp[dataFieldKey];

  if (typeof dataField !== 'object' || dataField === null) {
    console.warn(`Validation Error (Node${isNodeAddOperation ? 'Add' : 'Update'}): '${dataFieldKey}' field is required. Value:`, dataField);
    return false;
  }

  if (!isValidAINodeDataInternal(dataField, isNodeAddOperation)) { 
    console.warn(`Validation Error (Node${isNodeAddOperation ? 'Add' : 'Update'}): Invalid '${dataFieldKey}' for placeName "${nodeOp.placeName}". Details above.`);
    return false;
  }

  if (isNodeAddOperation && nodeOp.initialPosition !== undefined) {
    if (typeof nodeOp.initialPosition !== 'object' || nodeOp.initialPosition === null ||
        typeof nodeOp.initialPosition.x !== 'number' || typeof nodeOp.initialPosition.y !== 'number') {
      console.warn("Validation Error (NodeAdd): 'initialPosition' must be {x: number, y: number}. Value:", nodeOp.initialPosition);
      return false;
    }
  }
  return true;
}

function isValidAINodeRemovalInternal(nodeRemove: any): boolean {
  if (typeof nodeRemove !== 'object' || nodeRemove === null) return false;
  if (typeof nodeRemove.placeName !== 'string' || nodeRemove.placeName.trim() === '') {
    console.warn("Validation Error (NodeRemove): 'placeName' is required. Value:", nodeRemove.placeName);
    return false;
  }
  return true;
}

function isValidAIEdgeOperationInternal(edgeOp: any, isEdgeAddOperation: boolean): boolean {
  if (typeof edgeOp !== 'object' || edgeOp === null) return false;
  if (typeof edgeOp.sourcePlaceName !== 'string' || edgeOp.sourcePlaceName.trim() === '') {
    console.warn(`Validation Error (Edge${isEdgeAddOperation ? 'Add' : 'Update'}): 'sourcePlaceName' is required. Value:`, edgeOp.sourcePlaceName);
    return false;
  }
  if (typeof edgeOp.targetPlaceName !== 'string' || edgeOp.targetPlaceName.trim() === '') {
    console.warn(`Validation Error (Edge${isEdgeAddOperation ? 'Add' : 'Update'}): 'targetPlaceName' is required. Value:`, edgeOp.targetPlaceName);
    return false;
  }

  const dataFieldKey = isEdgeAddOperation ? 'data' : 'newData';
  const dataField = edgeOp[dataFieldKey];
  if (typeof dataField !== 'object' || dataField === null) {
     console.warn(`Validation Error (Edge${isEdgeAddOperation ? 'Add' : 'Update'}): '${dataFieldKey}' field is required. Value:`, dataField);
    return false;
  }
  if (!isValidAIEdgeDataInternal(dataField, isEdgeAddOperation)) {
    console.warn(`Validation Error (Edge${isEdgeAddOperation ? 'Add' : 'Update'}): Invalid '${dataFieldKey}' for edge between "${edgeOp.sourcePlaceName}" and "${edgeOp.targetPlaceName}".`);
    return false;
  }
  return true;
}

function isValidAIEdgeRemovalInternal(edgeRemove: any): boolean {
  if (typeof edgeRemove !== 'object' || edgeRemove === null) return false;
  if (typeof edgeRemove.sourcePlaceName !== 'string' || edgeRemove.sourcePlaceName.trim() === '') {
    console.warn("Validation Error (EdgeRemove): 'sourcePlaceName' is required. Value:", edgeRemove.sourcePlaceName);
    return false;
  }
  if (typeof edgeRemove.targetPlaceName !== 'string' || edgeRemove.targetPlaceName.trim() === '') {
    console.warn("Validation Error (EdgeRemove): 'targetPlaceName' is required. Value:", edgeRemove.targetPlaceName);
    return false;
  }
  if (edgeRemove.type !== undefined && (typeof edgeRemove.type !== 'string' || !VALID_EDGE_TYPE_VALUES.includes(edgeRemove.type as any))) {
    console.warn("Validation Error (EdgeRemove): Optional 'type' is invalid. Value:", edgeRemove.type);
    return false;
  }
  return true;
}

export function isValidAIMapUpdatePayload(payload: AIMapUpdatePayload | null): payload is AIMapUpdatePayload {
  if (typeof payload !== 'object' || payload === null) {
    console.warn("Validation Error (AIMapUpdatePayload): Payload is not an object or is null.");
    return false;
  }

  if (payload.nodesToAdd !== undefined) {
    if (!Array.isArray(payload.nodesToAdd) || !payload.nodesToAdd.every(n => isValidAINodeOperationInternal(n, true))) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToAdd' is invalid."); return false;
    }
  }
  if (payload.nodesToUpdate !== undefined) {
    if (!Array.isArray(payload.nodesToUpdate) || !payload.nodesToUpdate.every(n => isValidAINodeOperationInternal(n, false))) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToUpdate' is invalid."); return false;
    }
  }
  if (payload.nodesToRemove !== undefined) {
    if (!Array.isArray(payload.nodesToRemove) || !payload.nodesToRemove.every(isValidAINodeRemovalInternal)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToRemove' is invalid."); return false;
    }
  }
  if (payload.edgesToAdd !== undefined) {
    if (!Array.isArray(payload.edgesToAdd) || !payload.edgesToAdd.every(e => isValidAIEdgeOperationInternal(e, true))) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToAdd' is invalid."); return false;
    }
  }
  if (payload.edgesToUpdate !== undefined) {
    if (!Array.isArray(payload.edgesToUpdate) || !payload.edgesToUpdate.every(e => isValidAIEdgeOperationInternal(e, false))) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToUpdate' is invalid."); return false;
    }
  }
  if (payload.edgesToRemove !== undefined) {
    if (!Array.isArray(payload.edgesToRemove) || !payload.edgesToRemove.every(isValidAIEdgeRemovalInternal)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToRemove' is invalid."); return false;
    }
  }
  if (payload.suggestedCurrentMapNodeId !== undefined && payload.suggestedCurrentMapNodeId !== null && typeof payload.suggestedCurrentMapNodeId !== 'string') {
    console.warn("Validation Error (AIMapUpdatePayload): 'suggestedCurrentMapNodeId' must be a string or null if present. Value:", payload.suggestedCurrentMapNodeId);
    return false;
  }
  return true;
}
