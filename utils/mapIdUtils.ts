export const extractRandomSuffix = (id: string): string | null => {
  const match = id.match(/_(\d+_[a-z0-9]{5})$/i);
  return match ? match[1] : null;
};

export const buildNodeId = (placeName: string, suffix?: string): string => {
  const baseName = placeName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');
  const unique =
    suffix || `${Date.now() % 10000}_${Math.random().toString(36).substring(2, 7)}`;
  return `node_${baseName}_${unique}`;
};

export const buildEdgeId = (
  sourceNodeId: string,
  targetNodeId: string,
  suffix?: string,
): string => {
  const unique =
    suffix || `${Date.now() % 10000}_${Math.random().toString(36).substring(2, 7)}`;
  return `${sourceNodeId}_to_${targetNodeId}_${unique}`;
};

import type { MapData } from '../types';

export const updateNodeId = (
  mapData: MapData,
  oldId: string,
  placeName: string,
): string => {
  const suffix = extractRandomSuffix(oldId) || undefined;
  const newId = buildNodeId(placeName, suffix);
  if (newId === oldId) return oldId;

  const node = mapData.nodes.find(n => n.id === oldId);
  if (node) {
    node.id = newId;
  }

  mapData.nodes.forEach(n => {
    if (n.data.parentNodeId === oldId) n.data.parentNodeId = newId;
  });
  mapData.edges.forEach(e => {
    let touched = false;
    if (e.sourceNodeId === oldId) {
      e.sourceNodeId = newId;
      touched = true;
    }
    if (e.targetNodeId === oldId) {
      e.targetNodeId = newId;
      touched = true;
    }
    if (touched) {
      const edgeSuffix = extractRandomSuffix(e.id) || undefined;
      e.id = buildEdgeId(e.sourceNodeId, e.targetNodeId, edgeSuffix);
    }
  });

  return newId;
};
