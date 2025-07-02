export interface MapUpdateDebugInfo {
  prompt: string;
  systemInstruction?: string;
  jsonSchema?: unknown;
  rawResponse?: string;
  parsedPayload?: import('../../types').AIMapUpdatePayload;
  validationError?: string;
  observations?: string;
  rationale?: string;
  thoughts?: Array<string>;
  minimalModelCalls?: Array<import('../../types').MinimalModelCallRecord>;
  connectorChainsDebugInfo?: Array<{
    round: number;
    prompt: string;
    rawResponse?: string;
    parsedPayload?: import('../../types').AIMapUpdatePayload;
    validationError?: string;
    thoughts?: Array<string>;
  }> | null;
}

export interface MapUpdateServiceResult {
  updatedMapData: import('../../types').MapData | null;
  newlyAddedNodes: Array<import('../../types').MapNode>;
  newlyAddedEdges: Array<import('../../types').MapEdge>;
  debugInfo: MapUpdateDebugInfo | null;
}
