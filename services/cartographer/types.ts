export interface MapUpdateDebugInfo {
  prompt: string;
  rawResponse?: string;
  parsedPayload?: import('../../types').AIMapUpdatePayload;
  validationError?: string;
  observations?: string;
  rationale?: string;
  minimalModelCalls?: import('../../types').MinimalModelCallRecord[];
  connectorChainsDebugInfo?: {
    round: number;
    prompt: string;
    rawResponse?: string;
    parsedPayload?: import('../../types').AIMapUpdatePayload;
    validationError?: string;
  }[] | null;
}

export interface MapUpdateServiceResult {
  updatedMapData: import('../../types').MapData | null;
  newlyAddedNodes: import('../../types').MapNode[];
  newlyAddedEdges: import('../../types').MapEdge[];
  debugInfo: MapUpdateDebugInfo | null;
}
