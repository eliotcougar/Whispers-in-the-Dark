
/**
 * @file saveLoadService.ts
 * @description Functions for saving and loading game state across versions.
 */
import { FullGameState, SavedGameDataShape, Item, ThemeHistoryState, AdventureTheme, Character, ItemType, ThemePackName, KnownUse as V2KnownUse, DialogueHistoryEntry, DialogueData, MapData, MapNode, MapEdge, MapLayoutConfig, MapNodeData, DialogueSummaryRecord } from '../types';
import { CURRENT_SAVE_GAME_VERSION, LOCAL_STORAGE_SAVE_KEY, DEFAULT_STABILITY_LEVEL, DEFAULT_CHAOS_LEVEL, VALID_ITEM_TYPES, DEFAULT_ENABLED_THEME_PACKS, DEFAULT_PLAYER_GENDER } from '../constants';
import { THEME_PACKS, ALL_THEME_PACK_NAMES } from '../themes';
import { fetchCorrectedCharacterDetails_Service, fetchCorrectedLocalPlace_Service } from './correctionService';
import {
    DEFAULT_K_REPULSION, DEFAULT_K_SPRING, DEFAULT_IDEAL_EDGE_LENGTH,
    DEFAULT_K_CENTERING, DEFAULT_K_UNTANGLE, DEFAULT_K_EDGE_NODE_REPULSION, // Added
    DEFAULT_DAMPING_FACTOR, DEFAULT_MAX_DISPLACEMENT, DEFAULT_LAYOUT_ITERATIONS
} from '../utils/mapLayoutUtils';
import { formatKnownPlacesForPrompt } from '../utils/promptFormatters';

// --- V1 Save Game Interfaces (for conversion) ---
interface V1KnownUse {
  actionName: string;
  promptEffect: string;
  description?: string;
}

interface V1Item {
  name: string;
  type: string;
  description: string;
  isActive?: boolean;
  isJunk?: boolean;
  knownUses?: V1KnownUse[];
}

interface V1Place { // This interface represents the old Place structure for V1
  themeName: string;
  name: string;
  description: string;
  aliases?: string[];
}

interface V1Character {
  themeName: string;
  name: string;
  description: string;
  aliases?: string[];
}

interface V1ThemeMemory {
  summary: string;
  overarchingQuest: string;
  currentObjective: string;
  placeNames: string[];
  characterNames: string[];
}

interface V1ThemeHistoryState {
  [themeName: string]: V1ThemeMemory;
}

interface V1SavedGameState {
  saveGameVersion: "1.0.0";
  currentThemeName: string | null;
  currentScene: string;
  actionOptions: string[];
  overarchingQuest: string | null;
  currentObjective: string | null;
  inventory: V1Item[];
  gameLog: string[];
  lastActionLog: string | null;
  themeHistory: V1ThemeHistoryState;
  // isPostRealityShiftDisorientation: boolean; // Removed for V3
  pendingNewThemeNameAfterShift: string | null;
  allPlaces: V1Place[];
  allCharacters: V1Character[];
  score: number;
  stabilityLevel: number;
  chaosLevel: number;
  enabledThemePacks: ThemePackName[];
  playerGender: string;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;
}

// V2-like structure that convertV1toV2 outputs.
interface V2IntermediateSavedGameState {
  saveGameVersion: "2"; // Target version after V1 conversion step
  currentThemeName: string | null;
  currentThemeObject: AdventureTheme | null; // Added
  currentScene: string;
  actionOptions: string[];
  mainQuest: string | null;
  currentObjective: string | null;
  inventory: Item[];
  gameLog: string[];
  lastActionLog: string | null;
  themeHistory: ThemeHistoryState;
  // isPostRealityShiftDisorientation: boolean; // Removed for V3
  pendingNewThemeNameAfterShift: string | null;
  allCharacters: Character[]; // V2 Characters do not have dialogueSummaries yet
  score: number;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;
  turnsSinceLastShift: number;
  globalTurnNumber: number; // Added for V3, initialize in conversion
  playerGender: string;
  enabledThemePacks: ThemePackName[];
  stabilityLevel: number;
  chaosLevel: number;
  mapData: MapData; // Introduced in this intermediate step
  currentMapNodeId: string | null;
  mapLayoutConfig: MapLayoutConfig;
  isCustomGameMode: boolean; // Added for V3, initialize as false for V2
  // dialogueState?: DialogueData | null; // V2 might not have had this formalized
}

const getDefaultMapLayoutConfig = (): MapLayoutConfig => ({
    K_REPULSION: DEFAULT_K_REPULSION,
    K_SPRING: DEFAULT_K_SPRING,
    IDEAL_EDGE_LENGTH: DEFAULT_IDEAL_EDGE_LENGTH,
    K_CENTERING: DEFAULT_K_CENTERING,
    K_UNTANGLE: DEFAULT_K_UNTANGLE,
    K_EDGE_NODE_REPULSION: DEFAULT_K_EDGE_NODE_REPULSION, // Added
    DAMPING_FACTOR: DEFAULT_DAMPING_FACTOR,
    MAX_DISPLACEMENT: DEFAULT_MAX_DISPLACEMENT,
    iterations: DEFAULT_LAYOUT_ITERATIONS,
});


export const findThemeByName = (themeName: string | null): AdventureTheme | null => {
    if (!themeName) return null;
    for (const packKey in THEME_PACKS) {
        const pack = THEME_PACKS[packKey as ThemePackName];
        const foundTheme = pack.find(theme => theme.name === themeName);
        if (foundTheme) {
            return foundTheme;
        }
    }
    return null;
};

async function convertV1toV2Intermediate(v1Data: V1SavedGameState): Promise<V2IntermediateSavedGameState> {
  const v2Inventory: Item[] = v1Data.inventory.map((v1Item: V1Item) => ({
    name: v1Item.name,
    type: v1Item.type as ItemType,
    description: v1Item.description,
    activeDescription: undefined,
    isActive: v1Item.isActive ?? false,
    knownUses: (v1Item.knownUses || []).map((ku: V1KnownUse) => ({
      ...ku,
      appliesWhenActive: undefined,
      appliesWhenInactive: undefined,
    } as V2KnownUse)),
    isJunk: v1Item.isJunk ?? false,
  }));

  const v2ThemeHistory: ThemeHistoryState = {};
  for (const themeName in v1Data.themeHistory) {
    if (Object.prototype.hasOwnProperty.call(v1Data.themeHistory, themeName)) {
      const v1Memory = v1Data.themeHistory[themeName];
      v2ThemeHistory[themeName] = {
        summary: v1Memory.summary,
        mainQuest: v1Memory.overarchingQuest,
        currentObjective: v1Memory.currentObjective,
        placeNames: v1Memory.placeNames, // These will now refer to MapNode.placeName of main map nodes
        characterNames: v1Memory.characterNames,
      };
    }
  }

  // Convert V1Places to MapNodes (main nodes)
  const v1ConvertedMapNodes: MapNode[] = v1Data.allPlaces.map((v1Place, index) => {
    const baseNameForId = v1Place.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const nodeId = `${v1Place.themeName}_${baseNameForId}_v1main_${index}`;
    return {
      id: nodeId,
      themeName: v1Place.themeName,
      placeName: v1Place.name,
      position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 }, // Initial random position
      data: {
        description: v1Place.description || "Description missing from V1 save",
        aliases: v1Place.aliases || [],
        status: 'discovered',
        isLeaf: false,
        visited: true,
      },
    };
  });

  const v1MapData: MapData = { nodes: v1ConvertedMapNodes, edges: [] };

  let v2LocalPlace = v1Data.localPlace;
  const currentThemeObjFromV1 = findThemeByName(v1Data.currentThemeName);
  if ((!v2LocalPlace || v2LocalPlace === "Unknown" || v2LocalPlace === "Undetermined Location") && currentThemeObjFromV1 && v1Data.currentScene) {
      try {
        const inferredPlace = await fetchCorrectedLocalPlace_Service(
          v1Data.currentScene,
          currentThemeObjFromV1, // Pass AdventureTheme object
          v1ConvertedMapNodes,
          v1Data.localTime,
          v1Data.localEnvironment
        );
        if (inferredPlace) v2LocalPlace = inferredPlace;
      } catch (e) { console.error("V1 conversion: Error inferring localPlace:", e); }
  }

  const v2AllCharactersPromises = v1Data.allCharacters.map(async (v1Char: V1Character) => {
    let charThemeObj = findThemeByName(v1Char.themeName);
    let presenceStatus: Character['presenceStatus'] = 'unknown';
    let lastKnownLocation: string | null = null;
    let preciseLocation: string | null = null;

    if (charThemeObj && process.env.API_KEY) {
      const relevantMapNodesForCharThemeContext = v1ConvertedMapNodes.filter(node => node.themeName === charThemeObj!.name);
      const sceneContextForChar = (v1Data.currentThemeName === v1Char.themeName) ? v1Data.currentScene : undefined;
      const logContextForChar = (v1Data.currentThemeName === v1Char.themeName) ? v1Data.lastActionLog : undefined;
      try {
        const correctedDetails = await fetchCorrectedCharacterDetails_Service(
          v1Char.name,
          logContextForChar || undefined,
          sceneContextForChar || undefined,
          charThemeObj, // Pass AdventureTheme object
          relevantMapNodesForCharThemeContext
        );
        if (correctedDetails) {
          presenceStatus = correctedDetails.presenceStatus;
          lastKnownLocation = correctedDetails.lastKnownLocation;
          preciseLocation = correctedDetails.preciseLocation;
        }
      } catch (e) { console.error(`V1 conversion: Error inferring details for ${v1Char.name}:`, e); }
    }
    return {
      themeName: v1Char.themeName, name: v1Char.name, description: v1Char.description,
      aliases: v1Char.aliases || [], presenceStatus, lastKnownLocation, preciseLocation,
      dialogueSummaries: [], // Initialize for V2 intermediate
    };
  });
  const v2AllCharacters: Character[] = await Promise.all(v2AllCharactersPromises);

  return {
    saveGameVersion: "2",
    currentThemeName: v1Data.currentThemeName,
    currentThemeObject: currentThemeObjFromV1, // Populate currentThemeObject
    currentScene: v1Data.currentScene,
    actionOptions: v1Data.actionOptions,
    mainQuest: v1Data.overarchingQuest,
    currentObjective: v1Data.currentObjective,
    inventory: v2Inventory,
    gameLog: v1Data.gameLog,
    lastActionLog: v1Data.lastActionLog,
    themeHistory: v2ThemeHistory,
    // isPostRealityShiftDisorientation: (v1Data as any).isPostRealityShiftDisorientation ?? false, // Handle potential absence in older V1
    pendingNewThemeNameAfterShift: v1Data.pendingNewThemeNameAfterShift,
    allCharacters: v2AllCharacters,
    score: v1Data.score,
    localTime: v1Data.localTime,
    localEnvironment: v1Data.localEnvironment,
    localPlace: v2LocalPlace || "Undetermined Location",
    turnsSinceLastShift: 0, // Initialize for V2
    globalTurnNumber: 0, // Initialize for V2 (will become part of V3)
    playerGender: v1Data.playerGender || DEFAULT_PLAYER_GENDER,
    enabledThemePacks: v1Data.enabledThemePacks || [...DEFAULT_ENABLED_THEME_PACKS],
    stabilityLevel: v1Data.stabilityLevel ?? DEFAULT_STABILITY_LEVEL,
    chaosLevel: v1Data.chaosLevel ?? DEFAULT_CHAOS_LEVEL,
    mapData: v1MapData,
    currentMapNodeId: null,
    mapLayoutConfig: getDefaultMapLayoutConfig(),
    isCustomGameMode: false, // Default for V2
  };
}

function convertV2toV3Shape(v2Data: V2IntermediateSavedGameState): SavedGameDataShape {
  const { ...v3RelevantData } = v2Data;

  let finalMapData: MapData;
  if (v2Data.mapData && Array.isArray(v2Data.mapData.nodes) && Array.isArray(v2Data.mapData.edges)) {
    finalMapData = {
        nodes: v2Data.mapData.nodes.map(node => ({
            ...node,
            data: {
                description: node.data.description || "Description missing from V2 save",
                aliases: node.data.aliases || [],
                status: node.data.status || 'discovered',
                isLeaf: node.data.isLeaf ?? false,
                visited: node.data.visited ?? false,
                parentNodeId: node.data.parentNodeId,
                ...Object.fromEntries(Object.entries(node.data).filter(([key]) => !['description', 'aliases', 'status', 'isLeaf', 'visited', 'parentNodeId'].includes(key)))
            }
        })),
        edges: v2Data.mapData.edges,
    };
  } else {
    finalMapData = { nodes: [], edges: [] };
  }

  let finalMapLayoutConfig: MapLayoutConfig;
  if (v2Data.mapLayoutConfig && isValidMapLayoutConfig(v2Data.mapLayoutConfig)) {
    finalMapLayoutConfig = v2Data.mapLayoutConfig;
  } else {
    const defaultConfig = getDefaultMapLayoutConfig();
    if (v2Data.mapLayoutConfig && typeof v2Data.mapLayoutConfig === 'object') {
        const loadedConfig = v2Data.mapLayoutConfig;
        const patchedConfig: Partial<MapLayoutConfig> = {};
        for (const key of Object.keys(defaultConfig) as Array<keyof MapLayoutConfig>) {
            if (Object.prototype.hasOwnProperty.call(loadedConfig, key) && typeof (loadedConfig as any)[key] === 'number') {
                patchedConfig[key] = (loadedConfig as any)[key];
            } else {
                patchedConfig[key] = defaultConfig[key];
            }
        }
        finalMapLayoutConfig = patchedConfig as MapLayoutConfig;
    } else {
        finalMapLayoutConfig = defaultConfig;
    }
  }


  const finalCurrentMapNodeId = v2Data.currentMapNodeId === undefined ? null : v2Data.currentMapNodeId;
  
  const finalAllCharacters = v2Data.allCharacters.map(char => ({
    ...char,
    dialogueSummaries: char.dialogueSummaries || [], // Ensure dialogueSummaries is initialized
  }));

  const finalCurrentThemeObject = v2Data.currentThemeObject || findThemeByName(v2Data.currentThemeName);


  return {
    ...v3RelevantData,
    currentThemeObject: finalCurrentThemeObject, // Ensure currentThemeObject is set
    allCharacters: finalAllCharacters, // Use characters with initialized dialogueSummaries
    saveGameVersion: CURRENT_SAVE_GAME_VERSION, // Target V3
    mapData: finalMapData,
    currentMapNodeId: finalCurrentMapNodeId,
    mapLayoutConfig: finalMapLayoutConfig,
    isCustomGameMode: v2Data.isCustomGameMode ?? false, // Carry over or default
    globalTurnNumber: v2Data.globalTurnNumber ?? 0, // Carry over or default
  };
}


// --- Validation Helpers for SavedGameDataShape (V3) ---
function isValidDialogueSummaryRecord(record: any): record is DialogueSummaryRecord {
    return record &&
        typeof record.summaryText === 'string' &&
        Array.isArray(record.participants) && record.participants.every((p: any) => typeof p === 'string') &&
        typeof record.timestamp === 'string' &&
        typeof record.location === 'string';
}

function isValidItemForSave(item: any): item is Item {
  return item &&
    typeof item.name === 'string' &&
    typeof item.type === 'string' && (VALID_ITEM_TYPES as readonly string[]).includes(item.type) &&
    typeof item.description === 'string' &&
    (item.activeDescription === undefined || typeof item.activeDescription === 'string') &&
    (item.isActive === undefined || typeof item.isActive === 'boolean') &&
    (item.isJunk === undefined || typeof item.isJunk === 'boolean') &&
    (item.knownUses === undefined || (Array.isArray(item.knownUses) && item.knownUses.every((ku: V2KnownUse) =>
      ku && typeof ku.actionName === 'string' && typeof ku.promptEffect === 'string' &&
      (ku.description === undefined || typeof ku.description === 'string') &&
      (ku.appliesWhenActive === undefined || typeof ku.appliesWhenActive === 'boolean') &&
      (ku.appliesWhenInactive === undefined || typeof ku.appliesWhenInactive === 'boolean')
    )));
}

function isValidThemeHistory(history: any): history is ThemeHistoryState {
  if (typeof history !== 'object' || history === null) return false;
  for (const key in history) {
    if (Object.prototype.hasOwnProperty.call(history, key)) {
      const entry = history[key];
      if (!entry || typeof entry.summary !== 'string' || typeof entry.mainQuest !== 'string' ||
          typeof entry.currentObjective !== 'string' ||
          !Array.isArray(entry.placeNames) || !entry.placeNames.every((name: any) => typeof name === 'string') ||
          !Array.isArray(entry.characterNames) || !entry.characterNames.every((name: any) => typeof name === 'string')
      ) return false;
    }
  }
  return true;
}

function isValidCharacterForSave(character: any): character is Character {
  return character && typeof character.themeName === 'string' && typeof character.name === 'string' && character.name.trim() !== '' &&
    typeof character.description === 'string' && character.description.trim() !== '' &&
    (character.aliases === undefined || (Array.isArray(character.aliases) && character.aliases.every((alias: any) => typeof alias === 'string'))) &&
    (character.presenceStatus === undefined || ['distant', 'nearby', 'companion', 'unknown'].includes(character.presenceStatus)) &&
    (character.lastKnownLocation === undefined || character.lastKnownLocation === null || typeof character.lastKnownLocation === 'string') &&
    (character.preciseLocation === undefined || character.preciseLocation === null || typeof character.preciseLocation === 'string') &&
    (character.dialogueSummaries === undefined || (Array.isArray(character.dialogueSummaries) && character.dialogueSummaries.every(isValidDialogueSummaryRecord)));
}

function isValidThemePackNameArray(packs: any): packs is ThemePackName[] {
  return Array.isArray(packs) && packs.every(p => typeof p === 'string' && ALL_THEME_PACK_NAMES.includes(p as ThemePackName));
}

function isValidMapNodeData(data: any): data is MapNodeData {
    return data && typeof data === 'object' && data !== null &&
           typeof data.description === 'string' && // Description is mandatory
           (data.aliases === undefined || (Array.isArray(data.aliases) && data.aliases.every((alias: any) => typeof alias === 'string'))) &&
           (data.status === undefined || ['undiscovered', 'discovered', 'rumored', 'quest_target'].includes(data.status)) &&
           (data.visited === undefined || typeof data.visited === 'boolean') &&
           (data.isLeaf === undefined || typeof data.isLeaf === 'boolean') &&
           (data.parentNodeId === undefined || data.parentNodeId === null || typeof data.parentNodeId === 'string');
}


function isValidMapNode(node: any): node is MapNode {
    return node && typeof node.id === 'string' && node.id.trim() !== '' &&
           typeof node.themeName === 'string' &&
           typeof node.placeName === 'string' && node.placeName.trim() !== '' &&
           typeof node.position === 'object' && node.position !== null &&
           typeof node.position.x === 'number' && typeof node.position.y === 'number' &&
           isValidMapNodeData(node.data);
}

function isValidMapEdge(edge: any): edge is MapEdge {
    return edge && typeof edge.id === 'string' && edge.id.trim() !== '' &&
           typeof edge.sourceNodeId === 'string' && edge.sourceNodeId.trim() !== '' &&
           typeof edge.targetNodeId === 'string' && edge.targetNodeId.trim() !== '' &&
           typeof edge.data === 'object' && edge.data !== null;
}

function isValidMapData(mapData: any): mapData is MapData {
    return mapData && typeof mapData === 'object' && mapData !== null &&
           Array.isArray(mapData.nodes) && mapData.nodes.every(isValidMapNode) &&
           Array.isArray(mapData.edges) && mapData.edges.every(isValidMapEdge);
}

function isValidMapLayoutConfig(config: any): config is MapLayoutConfig {
    if (!config || typeof config !== 'object') return false;
    const defaultConfigKeys = Object.keys(getDefaultMapLayoutConfig()) as Array<keyof MapLayoutConfig>;
    for (const key of defaultConfigKeys) {
        if (typeof config[key] !== 'number') {
            console.warn(`isValidMapLayoutConfig: Key '${key}' is missing or not a number. Value: ${config[key]}`);
            return false;
        }
    }
    return true;
}

function isValidAdventureThemeObject(obj: any): obj is AdventureTheme {
    return obj &&
           typeof obj.name === 'string' && obj.name.trim() !== '' &&
           typeof obj.systemInstructionModifier === 'string' &&
           typeof obj.initialMainQuest === 'string' &&
           typeof obj.initialCurrentObjective === 'string' &&
           typeof obj.initialSceneDescriptionSeed === 'string' &&
           typeof obj.initialItems === 'string';
}


function validateSavedGameState(data: any): data is SavedGameDataShape {
  if (!data || typeof data !== 'object') { console.warn("Invalid save data: Not an object."); return false; }
  if (data.saveGameVersion !== CURRENT_SAVE_GAME_VERSION) {
    console.warn(`Save data version mismatch. Expected ${CURRENT_SAVE_GAME_VERSION}, got ${data.saveGameVersion}. Attempting to load anyway if structure is V3-compatible.`);
  }

  const fields: (keyof SavedGameDataShape)[] = [
    'currentThemeName', 'currentThemeObject', 'currentScene', 'actionOptions', 'mainQuest', 'currentObjective',
    'inventory', 'gameLog', 'lastActionLog', 'themeHistory',
    'pendingNewThemeNameAfterShift',
    'allCharacters', 'mapData', 'currentMapNodeId', 'mapLayoutConfig', 'score', 'stabilityLevel', 'chaosLevel',
    'localTime', 'localEnvironment', 'localPlace', 'enabledThemePacks', 'playerGender',
    'turnsSinceLastShift', 'globalTurnNumber', 'isCustomGameMode' 
  ];
  for (const field of fields) {
    if (!(field in data)) {
      const nullableFields: (keyof SavedGameDataShape)[] = ['currentThemeName', 'currentThemeObject', 'mainQuest', 'currentObjective', 'lastActionLog', 'pendingNewThemeNameAfterShift', 'localTime', 'localEnvironment', 'localPlace', 'currentMapNodeId'];
      if (!(nullableFields.includes(field) && data[field] === null) && field !== 'isCustomGameMode' && field !== 'globalTurnNumber') {
        console.warn(`Invalid save data (V3): Missing field '${field}'.`); return false;
      }
    }
  }

  if (data.currentThemeName !== null && typeof data.currentThemeName !== 'string') { console.warn("Invalid save data (V3): currentThemeName type."); return false; }
  if (data.currentThemeObject !== null && !isValidAdventureThemeObject(data.currentThemeObject)) { console.warn("Invalid save data (V3): currentThemeObject type or structure."); return false; }
  if (typeof data.currentScene !== 'string') { console.warn("Invalid save data (V3): currentScene type."); return false; }
  if (!Array.isArray(data.actionOptions) || !data.actionOptions.every((opt: any) => typeof opt === 'string')) { console.warn("Invalid save data (V3): actionOptions."); return false; }
  if (data.mainQuest !== null && typeof data.mainQuest !== 'string') { console.warn("Invalid save data (V3): mainQuest type."); return false; }
  if (data.currentObjective !== null && typeof data.currentObjective !== 'string') { console.warn("Invalid save data (V3): currentObjective type."); return false; }
  if (!Array.isArray(data.inventory) || !data.inventory.every(isValidItemForSave)) { console.warn("Invalid save data (V3): inventory."); return false; }
  if (!Array.isArray(data.gameLog) || !data.gameLog.every((msg: any) => typeof msg === 'string')) { console.warn("Invalid save data (V3): gameLog."); return false; }
  if (data.lastActionLog !== null && typeof data.lastActionLog !== 'string') { console.warn("Invalid save data (V3): lastActionLog type."); return false; }
  if (!isValidThemeHistory(data.themeHistory)) { console.warn("Invalid save data (V3): themeHistory."); return false; }
  if (data.pendingNewThemeNameAfterShift !== null && typeof data.pendingNewThemeNameAfterShift !== 'string') { console.warn("Invalid save data (V3): pendingNewThemeNameAfterShift type."); return false; }
  if (!Array.isArray(data.allCharacters) || !data.allCharacters.every(isValidCharacterForSave)) { console.warn("Invalid save data (V3): allCharacters."); return false; }
  if (!isValidMapData(data.mapData)) { console.warn("Invalid save data (V3): mapData."); return false; }
  if (data.currentMapNodeId !== null && typeof data.currentMapNodeId !== 'string') { console.warn("Invalid save data (V3): currentMapNodeId type."); return false; }
  if (!isValidMapLayoutConfig(data.mapLayoutConfig)) { console.warn("Invalid save data (V3): mapLayoutConfig."); return false; }
  if (typeof data.score !== 'number') { console.warn("Invalid save data (V3): score type."); return false; }
  if (typeof data.stabilityLevel !== 'number') { console.warn("Invalid save data (V3): stabilityLevel type."); return false; }
  if (typeof data.chaosLevel !== 'number') { console.warn("Invalid save data (V3): chaosLevel type."); return false; }
  if (data.localTime !== null && typeof data.localTime !== 'string') { console.warn("Invalid save data (V3): localTime type."); return false; }
  if (data.localEnvironment !== null && typeof data.localEnvironment !== 'string') { console.warn("Invalid save data (V3): localEnvironment type."); return false; }
  if (data.localPlace !== null && typeof data.localPlace !== 'string') { console.warn("Invalid save data (V3): localPlace type."); return false; }
  if (!isValidThemePackNameArray(data.enabledThemePacks)) { console.warn("Invalid save data (V3): enabledThemePacks."); return false; }
  if (typeof data.playerGender !== 'string') { console.warn("Invalid save data (V3): playerGender type."); return false; }
  if (typeof data.turnsSinceLastShift !== 'number') { console.warn("Invalid save data (V3): turnsSinceLastShift type."); return false; }
  if (typeof data.globalTurnNumber !== 'number') { console.warn("Invalid save data (V3): globalTurnNumber type."); return false; } 
  if (data.isCustomGameMode !== undefined && typeof data.isCustomGameMode !== 'boolean') { console.warn("Invalid save data (V3): isCustomGameMode type."); return false; }


  const dialogueFields: string[] = ['dialogueState'];
  for (const field of dialogueFields) {
    if (field in data && data[field as keyof SavedGameDataShape] !== null && data[field as keyof SavedGameDataShape] !== undefined) {
      console.warn(`Invalid save data (V3): Unexpected dialogue field '${field}' found in SavedGameDataShape. It should be null/undefined here.`); return false;
    }
  }

  return true;
}

/**
 * Ensures that the mapLayoutConfig property of the given object is complete,
 * using default values for any missing or invalid fields.
 * Modifies the object in place.
 * @param configHolder An object that is expected to have a mapLayoutConfig property.
 */
function ensureCompleteMapLayoutConfig(configHolder: { mapLayoutConfig?: Partial<MapLayoutConfig> | MapLayoutConfig }): void {
    const defaultConfig = getDefaultMapLayoutConfig();
    if (configHolder.mapLayoutConfig && typeof configHolder.mapLayoutConfig === 'object') {
        const loadedConfig = configHolder.mapLayoutConfig as Partial<MapLayoutConfig>; // Cast to allow partial
        const patchedConfig: Partial<MapLayoutConfig> = {};
        for (const key of Object.keys(defaultConfig) as Array<keyof MapLayoutConfig>) {
            if (loadedConfig.hasOwnProperty(key) && typeof (loadedConfig as any)[key] === 'number') {
                patchedConfig[key] = (loadedConfig as any)[key];
            } else {
                patchedConfig[key] = defaultConfig[key];
            }
        }
        configHolder.mapLayoutConfig = patchedConfig as MapLayoutConfig;
    } else {
        configHolder.mapLayoutConfig = defaultConfig;
    }
}

/**
 * Ensures that nodes within mapData have default values for description, aliases,
 * and other optional fields if they are missing. Modifies mapData in place.
 * @param mapData The MapData object to process.
 */
function ensureCompleteMapNodeDataDefaults(mapData: MapData | undefined): void {
    if (!mapData || !Array.isArray(mapData.nodes)) {
        return;
    }
    mapData.nodes.forEach(node => {
        if (!node.data || typeof node.data !== 'object') {
            node.data = {} as MapNodeData; // Initialize if data is missing
        }
        if (typeof node.data.description !== 'string') {
            node.data.description = "No description provided.";
        }
        if (!Array.isArray(node.data.aliases)) {
            node.data.aliases = [];
        } else {
            node.data.aliases = node.data.aliases.filter(alias => typeof alias === 'string');
        }
        if (node.data.status === undefined || !['undiscovered', 'discovered', 'rumored', 'quest_target'].includes(node.data.status)) {
            node.data.status = 'discovered';
        }
        if (typeof node.data.visited !== 'boolean') {
            node.data.visited = false;
        }
        if (typeof node.data.isLeaf !== 'boolean') {
            node.data.isLeaf = false;
        }
        // parentNodeId can be string or undefined, so no default needed unless specific logic requires it
    });
}


const prepareGameStateForSaving = (gameState: FullGameState): SavedGameDataShape => {
  const {
    dialogueState,
    objectiveAnimationType,
    lastDebugPacket,
    lastTurnChanges,
    isAwaitingManualShiftThemeSelection, 
    ...restOfGameState
  } = gameState;

  const mapDataForSave: MapData = {
    nodes: (gameState.mapData?.nodes || []).map(node => ({
        ...node,
        data: {
            description: node.data.description || "Description missing in save prep",
            aliases: node.data.aliases || [],
            status: node.data.status,
            isLeaf: node.data.isLeaf,
            visited: node.data.visited,
            parentNodeId: node.data.parentNodeId,
            ...Object.fromEntries(Object.entries(node.data).filter(([key]) => !['description', 'aliases'].includes(key)))
        }
    })),
    edges: gameState.mapData?.edges || [],
  };

  const savedData: SavedGameDataShape = {
    ...restOfGameState,
    saveGameVersion: CURRENT_SAVE_GAME_VERSION,
    currentThemeObject: gameState.currentThemeObject, 
    inventory: gameState.inventory.map(item => ({ ...item, isJunk: item.isJunk ?? false })),
    allCharacters: gameState.allCharacters.map(c => ({
      ...c, 
      aliases: c.aliases || [], 
      presenceStatus: c.presenceStatus || 'unknown',
      lastKnownLocation: c.lastKnownLocation, 
      preciseLocation: c.preciseLocation,
      dialogueSummaries: c.dialogueSummaries || [], 
    })),
    mapData: mapDataForSave,
    currentMapNodeId: gameState.currentMapNodeId || null,
    mapLayoutConfig: gameState.mapLayoutConfig || getDefaultMapLayoutConfig(),
    score: gameState.score ?? 0,
    stabilityLevel: gameState.stabilityLevel ?? DEFAULT_STABILITY_LEVEL,
    chaosLevel: gameState.chaosLevel ?? DEFAULT_CHAOS_LEVEL,
    localTime: gameState.localTime ?? null,
    localEnvironment: gameState.localEnvironment ?? null,
    localPlace: gameState.localPlace ?? null,
    enabledThemePacks: gameState.enabledThemePacks ?? [...DEFAULT_ENABLED_THEME_PACKS],
    playerGender: gameState.playerGender ?? DEFAULT_PLAYER_GENDER,
    turnsSinceLastShift: gameState.turnsSinceLastShift ?? 0,
    globalTurnNumber: gameState.globalTurnNumber ?? 0, 
    isCustomGameMode: gameState.isCustomGameMode ?? false, 
  };
  return savedData;
};

const expandSavedDataToFullState = (savedData: SavedGameDataShape): FullGameState => {
  const mapDataFromLoad: MapData = {
    nodes: (savedData.mapData?.nodes || []).map(node => ({
        ...node,
        data: {
            ...node.data,
            description: node.data.description || "Description missing on load",
            aliases: node.data.aliases || []
        }
    })),
    edges: savedData.mapData?.edges || [],
  };
  
  let themeObjectToUse = savedData.currentThemeObject;
  if (!themeObjectToUse && savedData.currentThemeName) {
      themeObjectToUse = findThemeByName(savedData.currentThemeName);
      if (!themeObjectToUse) {
          console.warn(`expandSavedDataToFullState: Theme "${savedData.currentThemeName}" not found in current definitions. Game may be unstable.`);
      }
  }


  return {
    ...savedData,
    currentThemeObject: themeObjectToUse, 
    allCharacters: savedData.allCharacters.map(c => ({
        ...c,
        dialogueSummaries: c.dialogueSummaries || [], 
    })),
    mapData: mapDataFromLoad,
    currentMapNodeId: savedData.currentMapNodeId || null,
    mapLayoutConfig: savedData.mapLayoutConfig,
    isCustomGameMode: savedData.isCustomGameMode ?? false, 
    globalTurnNumber: savedData.globalTurnNumber ?? 0, 
    isAwaitingManualShiftThemeSelection: false, 
    dialogueState: null,
    objectiveAnimationType: null,
    lastDebugPacket: null,
    lastTurnChanges: null,
  };
};

// --- LocalStorage Operations ---
export const saveGameStateToLocalStorage = (gameState: FullGameState): boolean => {
  try {
    const dataToSave = prepareGameStateForSaving(gameState);
    localStorage.setItem(LOCAL_STORAGE_SAVE_KEY, JSON.stringify(dataToSave));
    return true;
  } catch (error) {
    console.error("Error saving game state to localStorage:", error);
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
      alert("Could not save game: Browser storage is full. Please clear some space or try saving to a file.");
    } else {
      alert("An unexpected error occurred while trying to automatically save your game.");
    }
    return false;
  }
};

/**
 * Loads the latest saved game from localStorage if available.
 * Converts older save versions to the current structure and validates the result.
 */
export const loadGameStateFromLocalStorage = async (): Promise<FullGameState | null> => {
  try {
    const savedDataString = localStorage.getItem(LOCAL_STORAGE_SAVE_KEY);
    if (!savedDataString) return null;

    let parsedData = JSON.parse(savedDataString);
    let dataToValidateAndExpand: SavedGameDataShape | null = null;

    if (parsedData && parsedData.saveGameVersion === "1.0.0") {
      console.log("V1 save data detected from localStorage. Attempting conversion to V3...");
      const v2Intermediate = await convertV1toV2Intermediate(parsedData as V1SavedGameState);
      dataToValidateAndExpand = convertV2toV3Shape(v2Intermediate);
    } else if (parsedData && parsedData.saveGameVersion === "2") {
      console.log("V2 save data detected from localStorage. Attempting conversion to V3...");
      dataToValidateAndExpand = convertV2toV3Shape(parsedData as V2IntermediateSavedGameState);
    } else if (parsedData && (parsedData.saveGameVersion === CURRENT_SAVE_GAME_VERSION || (typeof parsedData.saveGameVersion === 'string' && parsedData.saveGameVersion.startsWith(CURRENT_SAVE_GAME_VERSION.split('.')[0])))) {
       if (parsedData.saveGameVersion !== CURRENT_SAVE_GAME_VERSION) {
          console.warn(`Potentially compatible future V${CURRENT_SAVE_GAME_VERSION.split('.')[0]}.x save version '${parsedData.saveGameVersion}' from localStorage. Attempting to treat as current version (V3) for validation.`);
       }
       dataToValidateAndExpand = parsedData as SavedGameDataShape;
       ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
       ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
   } else if (parsedData) {
      console.warn(`Unknown save version '${parsedData.saveGameVersion}' from localStorage. This might fail validation.`);
      dataToValidateAndExpand = parsedData as SavedGameDataShape;
      if (dataToValidateAndExpand) {
        ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
        ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
      }
   }

    if (dataToValidateAndExpand && !dataToValidateAndExpand.currentThemeObject && dataToValidateAndExpand.currentThemeName) {
      dataToValidateAndExpand.currentThemeObject = findThemeByName(dataToValidateAndExpand.currentThemeName);
      if (!dataToValidateAndExpand.currentThemeObject) {
        console.warn(`Failed to find theme "${dataToValidateAndExpand.currentThemeName}" during localStorage load. Game state might be incomplete.`);
      }
    }

    if (dataToValidateAndExpand) {
      const gt = (dataToValidateAndExpand as any).globalTurnNumber;
      if (typeof gt === 'string') {
        const parsed = parseInt(gt, 10);
        dataToValidateAndExpand.globalTurnNumber = isNaN(parsed) ? 0 : parsed;
      } else if (gt === undefined || gt === null) {
        dataToValidateAndExpand.globalTurnNumber = 0;
      }
    }

    if (dataToValidateAndExpand && validateSavedGameState(dataToValidateAndExpand)) {
      dataToValidateAndExpand.inventory = dataToValidateAndExpand.inventory.map((item: Item) => ({ ...item, isJunk: item.isJunk ?? false }));
      dataToValidateAndExpand.score = dataToValidateAndExpand.score ?? 0;
      dataToValidateAndExpand.stabilityLevel = dataToValidateAndExpand.stabilityLevel ?? DEFAULT_STABILITY_LEVEL;
      dataToValidateAndExpand.chaosLevel = dataToValidateAndExpand.chaosLevel ?? DEFAULT_CHAOS_LEVEL;
      dataToValidateAndExpand.localTime = dataToValidateAndExpand.localTime ?? null;
      dataToValidateAndExpand.localEnvironment = dataToValidateAndExpand.localEnvironment ?? null;
      dataToValidateAndExpand.localPlace = dataToValidateAndExpand.localPlace ?? null;
      dataToValidateAndExpand.allCharacters = dataToValidateAndExpand.allCharacters.map((c: any) => ({
        ...c, 
        aliases: c.aliases || [], 
        presenceStatus: c.presenceStatus || 'unknown',
        lastKnownLocation: c.lastKnownLocation ?? null,
        preciseLocation: c.preciseLocation || null,
        dialogueSummaries: c.dialogueSummaries || [], 
      }));
      dataToValidateAndExpand.enabledThemePacks = dataToValidateAndExpand.enabledThemePacks ?? [...DEFAULT_ENABLED_THEME_PACKS];
      dataToValidateAndExpand.playerGender = dataToValidateAndExpand.playerGender ?? DEFAULT_PLAYER_GENDER;
      dataToValidateAndExpand.turnsSinceLastShift = dataToValidateAndExpand.turnsSinceLastShift ?? 0;
      dataToValidateAndExpand.globalTurnNumber = dataToValidateAndExpand.globalTurnNumber ?? 0; 
      dataToValidateAndExpand.mainQuest = dataToValidateAndExpand.mainQuest ?? null;
      dataToValidateAndExpand.isCustomGameMode = dataToValidateAndExpand.isCustomGameMode ?? false; 
      
      return expandSavedDataToFullState(dataToValidateAndExpand);
    }
    console.warn("Local save data is invalid or version mismatch for V3. Starting new game.");
    localStorage.removeItem(LOCAL_STORAGE_SAVE_KEY);
    return null;
  } catch (error) {
    console.error("Error loading game state from localStorage:", error);
    localStorage.removeItem(LOCAL_STORAGE_SAVE_KEY);
    return null;
  }
};

export const clearGameStateFromLocalStorage = (): void => {
  try { localStorage.removeItem(LOCAL_STORAGE_SAVE_KEY); }
  catch (error) { console.error("Error clearing game state from localStorage:", error); }
};

// --- File Operations ---
const triggerDownload = (data: string, filename: string, type: string): void => {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
};

export const saveGameStateToFile = (gameState: FullGameState): void => {
  try {
    const dataToSave = prepareGameStateForSaving(gameState);
    const jsonString = JSON.stringify(dataToSave, null, 2);
    triggerDownload(jsonString, `WhispersInTheDark_Save_V${CURRENT_SAVE_GAME_VERSION}_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
  } catch (error) {
    console.error("Error saving game state to file:", error);
    alert("An error occurred while preparing your game data for download.");
  }
};

/**
 * Reads a saved game from a user-selected file.
 * Handles version conversion and validation similar to the localStorage load.
 */
export const loadGameStateFromFile = async (file: File): Promise<FullGameState | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (event.target && typeof event.target.result === 'string') {
          let parsedData = JSON.parse(event.target.result);
          let dataToValidateAndExpand: SavedGameDataShape | null = null;

          if (parsedData && parsedData.saveGameVersion === "1.0.0") {
            console.log("V1 save data detected from file. Attempting conversion to V3...");
            const v2Intermediate = await convertV1toV2Intermediate(parsedData as V1SavedGameState);
            dataToValidateAndExpand = convertV2toV3Shape(v2Intermediate);
          } else if (parsedData && parsedData.saveGameVersion === "2") {
             console.log("V2 save data detected from file. Attempting conversion to V3...");
             dataToValidateAndExpand = convertV2toV3Shape(parsedData as V2IntermediateSavedGameState);
          } else if (parsedData && (parsedData.saveGameVersion === CURRENT_SAVE_GAME_VERSION || (typeof parsedData.saveGameVersion === 'string' && parsedData.saveGameVersion.startsWith(CURRENT_SAVE_GAME_VERSION.split('.')[0])))) {
            if (parsedData.saveGameVersion !== CURRENT_SAVE_GAME_VERSION) {
                console.warn(`Potentially compatible future V${CURRENT_SAVE_GAME_VERSION.split('.')[0]}.x save version '${parsedData.saveGameVersion}' from file. Attempting to treat as current version (V3) for validation.`);
            }
            dataToValidateAndExpand = parsedData as SavedGameDataShape;
            ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
            ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
          } else if (parsedData) {
            console.warn(`Unknown save version '${parsedData.saveGameVersion}' from file. This might fail validation.`);
            dataToValidateAndExpand = parsedData as SavedGameDataShape;
            if (dataToValidateAndExpand) {
                ensureCompleteMapLayoutConfig(dataToValidateAndExpand);
                ensureCompleteMapNodeDataDefaults(dataToValidateAndExpand.mapData);
            }
          }

          if (dataToValidateAndExpand && !dataToValidateAndExpand.currentThemeObject && dataToValidateAndExpand.currentThemeName) {
            dataToValidateAndExpand.currentThemeObject = findThemeByName(dataToValidateAndExpand.currentThemeName);
          if (!dataToValidateAndExpand.currentThemeObject) {
               console.warn(`Failed to find theme "${dataToValidateAndExpand.currentThemeName}" during file load. Game state might be incomplete.`);
          }
        }

        if (dataToValidateAndExpand) {
          const gt = (dataToValidateAndExpand as any).globalTurnNumber;
          if (typeof gt === 'string') {
            const parsed = parseInt(gt, 10);
            dataToValidateAndExpand.globalTurnNumber = isNaN(parsed) ? 0 : parsed;
          } else if (gt === undefined || gt === null) {
            dataToValidateAndExpand.globalTurnNumber = 0;
          }
        }

        if (dataToValidateAndExpand && validateSavedGameState(dataToValidateAndExpand)) {
            dataToValidateAndExpand.inventory = dataToValidateAndExpand.inventory.map((item: Item) => ({ ...item, isJunk: item.isJunk ?? false }));
            dataToValidateAndExpand.score = dataToValidateAndExpand.score ?? 0;
            dataToValidateAndExpand.stabilityLevel = dataToValidateAndExpand.stabilityLevel ?? DEFAULT_STABILITY_LEVEL;
            dataToValidateAndExpand.chaosLevel = dataToValidateAndExpand.chaosLevel ?? DEFAULT_CHAOS_LEVEL;
            dataToValidateAndExpand.localTime = dataToValidateAndExpand.localTime ?? null;
            dataToValidateAndExpand.localEnvironment = dataToValidateAndExpand.localEnvironment ?? null;
            dataToValidateAndExpand.localPlace = dataToValidateAndExpand.localPlace ?? null;
            dataToValidateAndExpand.allCharacters = dataToValidateAndExpand.allCharacters.map((c: any) => ({
              ...c, 
              aliases: c.aliases || [], 
              presenceStatus: c.presenceStatus || 'unknown',
              lastKnownLocation: c.lastKnownLocation ?? null,
              preciseLocation: c.preciseLocation || null,
              dialogueSummaries: c.dialogueSummaries || [], 
            }));
            dataToValidateAndExpand.enabledThemePacks = dataToValidateAndExpand.enabledThemePacks ?? [...DEFAULT_ENABLED_THEME_PACKS];
            dataToValidateAndExpand.playerGender = dataToValidateAndExpand.playerGender ?? DEFAULT_PLAYER_GENDER;
            dataToValidateAndExpand.turnsSinceLastShift = dataToValidateAndExpand.turnsSinceLastShift ?? 0;
            dataToValidateAndExpand.globalTurnNumber = dataToValidateAndExpand.globalTurnNumber ?? 0; 
            dataToValidateAndExpand.mainQuest = dataToValidateAndExpand.mainQuest ?? null;
            dataToValidateAndExpand.isCustomGameMode = dataToValidateAndExpand.isCustomGameMode ?? false; 

            resolve(expandSavedDataToFullState(dataToValidateAndExpand));
            return;
          }
        }
        console.warn("File save data is invalid or version mismatch for V3. Not loading.");
        resolve(null);
      } catch (error) {
        console.error("Error loading game state from file:", error);
        resolve(null);
      }
    };
    reader.onerror = () => {
      console.error("Error reading file.");
      resolve(null);
    };
    reader.readAsText(file);
  });
};
