import type { MapNodeData, MapEdgeData } from '../../types';
import {
  VALID_NODE_STATUS_VALUES,
  VALID_NODE_TYPE_VALUES,
  VALID_EDGE_TYPE_VALUES,
  VALID_EDGE_STATUS_VALUES,
} from '../../constants';
import {
  NODE_STATUS_SYNONYMS,
  NODE_TYPE_SYNONYMS,
  EDGE_TYPE_SYNONYMS,
  EDGE_STATUS_SYNONYMS,
} from '../../utils/mapSynonyms';

/**
 * Normalizes a MapNodeData object in place and records any invalid values.
 */
export const applyNodeDataFix = (
  data: Partial<MapNodeData> | undefined,
  errors: string[],
  context: string,
): void => {
  if (!data) return;
  if (data.status) {
    const mapped = (NODE_STATUS_SYNONYMS as Record<string, MapNodeData['status'] | undefined>)[
      data.status.toLowerCase()
    ];
    if (mapped !== undefined) data.status = mapped;
    if (!VALID_NODE_STATUS_VALUES.includes(data.status)) {
      errors.push(`${context} invalid status "${data.status}"`);
    }
  }
  if (data.nodeType) {
    const mapped = (NODE_TYPE_SYNONYMS as Record<string, MapNodeData['nodeType'] | undefined>)[
      data.nodeType.toLowerCase()
    ];
    if (mapped !== undefined) data.nodeType = mapped;
    if (!VALID_NODE_TYPE_VALUES.includes(data.nodeType)) {
      errors.push(`${context} invalid nodeType "${data.nodeType}"`);
    }
  }
};

/**
 * Normalizes a MapEdgeData object in place and records any invalid values.
 */
export const applyEdgeDataFix = (
  data: Partial<MapEdgeData> | undefined,
  errors: string[],
  context: string,
): void => {
  if (!data) return;
  if (data.type) {
    const mapped = (EDGE_TYPE_SYNONYMS as Record<string, MapEdgeData['type'] | undefined>)[
      data.type.toLowerCase()
    ];
    if (mapped !== undefined) data.type = mapped;
    if (!VALID_EDGE_TYPE_VALUES.includes(data.type)) {
      errors.push(`${context} invalid type "${data.type}"`);
    }
  }
  if (data.status) {
    const mapped = (EDGE_STATUS_SYNONYMS as Record<string, MapEdgeData['status'] | undefined>)[
      data.status.toLowerCase()
    ];
    if (mapped !== undefined) data.status = mapped;
    if (!VALID_EDGE_STATUS_VALUES.includes(data.status)) {
      errors.push(`${context} invalid status "${data.status}"`);
    }
  }
};
