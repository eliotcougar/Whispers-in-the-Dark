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

