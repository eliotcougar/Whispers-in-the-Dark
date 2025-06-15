
/**
 * @file mapUpdateValidationUtils.ts
 * @description Utilities for validating the AIMapUpdatePayload structure from the map update AI.
 */
import { AIMapUpdatePayload, MapNodeData, MapEdgeData } from '../types'; // AINodeUpdate is implicitly part of AIMapUpdatePayload
import {
  VALID_NODE_STATUS_VALUES,
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
} from '../constants';

/**
 * Validates a MapNodeData object used in map update operations.
 * @param data - The value to validate.
 * @param isNodeAddContext - Whether the validation is for a node addition.
 */
function isValidAINodeDataInternal(data: unknown, isNodeAddContext: boolean): boolean {
  if (typeof data !== 'object' || data === null) {
    console.warn("Validation Error (NodeData): Data is not an object. Value:", data);
    return false;
  }
  const node = data as Record<string, unknown>;

  // Status: Required for Add, Optional for Update. Must be valid if present.
  if (isNodeAddContext) {
    if (typeof node.status !== 'string' || !VALID_NODE_STATUS_VALUES.includes(node.status as MapNodeData['status'])) {
      console.warn("Validation Error (NodeData - Add): 'status' is mandatory and invalid. Value:", node.status, "Valid are:", VALID_NODE_STATUS_VALUES);
      return false;
    }
  } else { // Update context
    if (node.status !== undefined && (typeof node.status !== 'string' || !VALID_NODE_STATUS_VALUES.includes(node.status as MapNodeData['status']))) {
      console.warn("Validation Error (NodeData - Update): Invalid 'status'. Value:", node.status);
      return false;
    }
  }

  // Description: Required for Add (non-empty string), Optional for Update (string if present).
  if (isNodeAddContext) {
    if (typeof node.description !== 'string' || node.description.trim() === '') {
      console.warn("Validation Error (NodeData - Add): 'description' is mandatory and must be a non-empty string. Value:", node.description);
      return false;
    }
  } else { // Update context
    if (node.description !== undefined && typeof node.description !== 'string') {
      console.warn("Validation Error (NodeData - Update): 'description' if present must be a string. Value:", node.description);
      return false;
    }
  }

  // Aliases: Required for Add (array of strings, can be empty), Optional for Update (array of strings if present).
  if (isNodeAddContext) {
    if (!Array.isArray(node.aliases) || !node.aliases.every(a => typeof a === 'string')) {
      console.warn("Validation Error (NodeData - Add): 'aliases' is mandatory and must be an array of strings (can be empty []). Value:", node.aliases);
      return false;
    }
  } else { // Update context
    if (node.aliases !== undefined && !(Array.isArray(node.aliases) && node.aliases.every(a => typeof a === 'string'))) {
      console.warn("Validation Error (NodeData - Update): 'aliases' if present must be an array of strings. Value:", node.aliases);
      return false;
    }
  }
  

  if (isNodeAddContext) {
    if (typeof node.nodeType !== 'string' || !VALID_NODE_TYPE_VALUES.includes(node.nodeType as NonNullable<MapNodeData['nodeType']>)) {
      console.warn("Validation Error (NodeData - Add): 'nodeType' is mandatory and invalid. Value:", node.nodeType, "Valid are:", VALID_NODE_TYPE_VALUES);
      return false;
    }
  } else {
    if (node.nodeType !== undefined && (typeof node.nodeType !== 'string' || !VALID_NODE_TYPE_VALUES.includes(node.nodeType as NonNullable<MapNodeData['nodeType']>))) {
      console.warn("Validation Error (NodeData - Update): 'nodeType' is invalid. Value:", node.nodeType);
      return false;
    }
  }

  // parentNodeId: Required for Add, Optional for Update
  if (isNodeAddContext) {
    if (
      typeof node.parentNodeId !== 'string' ||
      node.parentNodeId.trim() === ''
    ) {
      console.warn(
        "Validation Error (NodeData - Add): 'parentNodeId' is mandatory and must be a non-empty string. Value:",
        node.parentNodeId
      );
      return false;
    }
  } else {
    if (
      node.parentNodeId !== undefined &&
      node.parentNodeId !== null &&
      (typeof node.parentNodeId !== 'string' || node.parentNodeId.trim() === '')
    ) {
      console.warn(
        "Validation Error (NodeData - Update): 'parentNodeId' must be a non-empty string or null if present. Value:",
        node.parentNodeId
      );
      return false;
    }
  }
  
  return true;
}


/**
 * Validates a MapEdgeData object used in map update operations.
 * @param data - The value to validate.
 * @param isEdgeAddContext - Whether the validation is for adding a new edge.
 */
function isValidAIEdgeDataInternal(data: unknown, isEdgeAddContext: boolean): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const edge = data as Record<string, unknown>;
  
  if (isEdgeAddContext) { // Type and status are required for new edges
    if (typeof edge.type !== 'string' || !VALID_EDGE_TYPE_VALUES.includes(edge.type as NonNullable<MapEdgeData['type']>)) {
      console.warn("Validation Error (EdgeData - Add): 'type' is required and invalid. Value:", edge.type, "Valid are:", VALID_EDGE_TYPE_VALUES);
      return false;
    }
    if (typeof edge.status !== 'string' || !VALID_EDGE_STATUS_VALUES.includes(edge.status as NonNullable<MapEdgeData['status']>)) {
      console.warn("Validation Error (EdgeData - Add): 'status' is required and invalid. Value:", edge.status, "Valid are:", VALID_EDGE_STATUS_VALUES);
      return false;
    }
  } else { // For updates, type and status are optional
    if (edge.type !== undefined && (typeof edge.type !== 'string' || !VALID_EDGE_TYPE_VALUES.includes(edge.type as NonNullable<MapEdgeData['type']>))) {
        console.warn("Validation Error (EdgeData - Update): Invalid 'type'. Value:", edge.type, "Valid are:", VALID_EDGE_TYPE_VALUES);
        return false;
    }
    if (edge.status !== undefined && (typeof edge.status !== 'string' || !VALID_EDGE_STATUS_VALUES.includes(edge.status as NonNullable<MapEdgeData['status']>))) {
        console.warn("Validation Error (EdgeData - Update): Invalid 'status'. Value:", edge.status, "Valid are:", VALID_EDGE_STATUS_VALUES);
        return false;
    }
  }

  if (edge.description !== undefined && typeof edge.description !== 'string') {
    console.warn("Validation Error (EdgeData): Invalid 'description'. Value:", edge.description);
    return false;
  }
  if (edge.travelTime !== undefined && typeof edge.travelTime !== 'string') {
    console.warn("Validation Error (EdgeData): Invalid 'travelTime'. Value:", edge.travelTime);
    return false;
  }
  return true;
}

/**
 * Validates a node add/update operation object.
 * @param nodeOp - The node operation data.
 * @param isNodeAddOperation - Whether this validation is for adding a node.
 */
function isValidAINodeOperationInternal(nodeOp: unknown, isNodeAddOperation: boolean): boolean {
  if (typeof nodeOp !== 'object' || nodeOp === null) return false;
  const op = nodeOp as Record<string, unknown>;
  if (typeof op.placeName !== 'string' || op.placeName.trim() === '') {
    console.warn(`Validation Error (Node${isNodeAddOperation ? 'Add' : 'Update'}): 'placeName' is required. Value:`, op.placeName);
    return false;
  }

  const dataFieldKey = isNodeAddOperation ? 'data' : 'newData';
  const dataField = op[dataFieldKey];

  if (typeof dataField !== 'object' || dataField === null) {
    console.warn(`Validation Error (Node${isNodeAddOperation ? 'Add' : 'Update'}): '${dataFieldKey}' field is required. Value:`, dataField);
    return false;
  }

  if (!isValidAINodeDataInternal(dataField, isNodeAddOperation)) {
    console.warn(`Validation Error (Node${isNodeAddOperation ? 'Add' : 'Update'}): Invalid '${dataFieldKey}' for placeName "${op.placeName}". Details above.`);
    return false;
  }

  if (isNodeAddOperation && op.initialPosition !== undefined) {
    const pos = op.initialPosition as Record<string, unknown>;
    if (typeof pos !== 'object' || pos === null ||
        typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      console.warn("Validation Error (NodeAdd): 'initialPosition' must be {x: number, y: number}. Value:", op.initialPosition);
      return false;
    }
  }
  return true;
}

/**
 * Validates a node removal operation object.
 */
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

/**
 * Validates an edge add/update operation object.
 * @param edgeOp - The edge operation data.
 * @param isEdgeAddOperation - Whether this validation is for adding an edge.
 */
function isValidAIEdgeOperationInternal(edgeOp: unknown, isEdgeAddOperation: boolean): boolean {
  if (typeof edgeOp !== 'object' || edgeOp === null) return false;
  const op = edgeOp as Record<string, unknown>;
  if (typeof op.sourcePlaceName !== 'string' || op.sourcePlaceName.trim() === '') {
    console.warn(`Validation Error (Edge${isEdgeAddOperation ? 'Add' : 'Update'}): 'sourcePlaceName' is required. Value:`, op.sourcePlaceName);
    return false;
  }
  if (typeof op.targetPlaceName !== 'string' || op.targetPlaceName.trim() === '') {
    console.warn(`Validation Error (Edge${isEdgeAddOperation ? 'Add' : 'Update'}): 'targetPlaceName' is required. Value:`, op.targetPlaceName);
    return false;
  }

  const dataFieldKey = isEdgeAddOperation ? 'data' : 'newData';
  const dataField = op[dataFieldKey];
  if (typeof dataField !== 'object' || dataField === null) {
     console.warn(`Validation Error (Edge${isEdgeAddOperation ? 'Add' : 'Update'}): '${dataFieldKey}' field is required. Value:`, dataField);
    return false;
  }
  if (!isValidAIEdgeDataInternal(dataField, isEdgeAddOperation)) {
    console.warn(`Validation Error (Edge${isEdgeAddOperation ? 'Add' : 'Update'}): Invalid '${dataFieldKey}' for edge between "${op.sourcePlaceName}" and "${op.targetPlaceName}".`);
    return false;
  }
  return true;
}

/**
 * Validates an edge removal operation object.
 */
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

function isValidSplitFamilyOperationInternal(op: unknown): boolean {
  if (typeof op !== 'object' || op === null) return false;
  const o = op as Record<string, unknown>;
  if (typeof o.originalNodeId !== 'string' || o.originalNodeId.trim() === '') return false;
  if (typeof o.newNodeId !== 'string' || o.newNodeId.trim() === '') return false;
  if (typeof o.newConnectorNodeId !== 'string' || o.newConnectorNodeId.trim() === '') return false;
  if (typeof o.newNodeType !== 'string' || !VALID_NODE_TYPE_VALUES.includes(o.newNodeType as MapNodeData['nodeType'])) return false;
  if (!Array.isArray(o.originalChildren) || !o.originalChildren.every(id => typeof id === 'string')) return false;
  if (!Array.isArray(o.newChildren) || !o.newChildren.every(id => typeof id === 'string')) return false;
  return true;
}

/**
 * Validates a full AIMapUpdatePayload object received from the map AI service.
 * @param payload - The parsed payload to validate.
 * @returns True if the payload conforms to expected structure.
 */
export function isValidAIMapUpdatePayload(payload: AIMapUpdatePayload | null): payload is AIMapUpdatePayload {
  if (typeof payload !== 'object' || payload === null) {
    console.warn("Validation Error (AIMapUpdatePayload): Payload is not an object or is null.");
    return false;
  }

  if (payload.nodesToAdd != null) {
    if (!Array.isArray(payload.nodesToAdd) || !payload.nodesToAdd.every(n => isValidAINodeOperationInternal(n, true))) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToAdd' is invalid."); return false;
    }
  }
  if (payload.nodesToUpdate != null) {
    if (!Array.isArray(payload.nodesToUpdate) || !payload.nodesToUpdate.every(n => isValidAINodeOperationInternal(n, false))) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToUpdate' is invalid."); return false;
    }
  }
  if (payload.nodesToRemove != null) {
    if (!Array.isArray(payload.nodesToRemove) || !payload.nodesToRemove.every(isValidAINodeRemovalInternal)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'nodesToRemove' is invalid."); return false;
    }
  }
  if (payload.edgesToAdd != null) {
    if (!Array.isArray(payload.edgesToAdd) || !payload.edgesToAdd.every(e => isValidAIEdgeOperationInternal(e, true))) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToAdd' is invalid."); return false;
    }
  }
  if (payload.edgesToUpdate != null) {
    if (!Array.isArray(payload.edgesToUpdate) || !payload.edgesToUpdate.every(e => isValidAIEdgeOperationInternal(e, false))) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToUpdate' is invalid."); return false;
    }
  }
  if (payload.edgesToRemove != null) {
    if (!Array.isArray(payload.edgesToRemove) || !payload.edgesToRemove.every(isValidAIEdgeRemovalInternal)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'edgesToRemove' is invalid."); return false;
    }
  }
  if (payload.suggestedCurrentMapNodeId != null && typeof payload.suggestedCurrentMapNodeId !== 'string') {
    console.warn("Validation Error (AIMapUpdatePayload): 'suggestedCurrentMapNodeId' must be a string or null if present. Value:", payload.suggestedCurrentMapNodeId);
    return false;
  }
  if (payload.splitFamily != null) {
    if (!isValidSplitFamilyOperationInternal(payload.splitFamily)) {
      console.warn("Validation Error (AIMapUpdatePayload): 'splitFamily' is invalid.");
      return false;
    }
  }
  return true;
}
