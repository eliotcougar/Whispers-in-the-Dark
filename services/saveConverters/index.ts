/**
 * @file services/saveConverters/index.ts
 * @description Conversion utilities for migrating saved game data between versions.
 */

import {
  SavedGameDataShape,
  Item,
  ThemeHistoryState,
  AdventureTheme,
  Character,
  ItemType,
  ThemePackName,
  KnownUse as V2KnownUse,
  MapData,
  MapNode,
  MapLayoutConfig
} from '../../types';
import {
  CURRENT_SAVE_GAME_VERSION,
  DEFAULT_STABILITY_LEVEL,
  DEFAULT_CHAOS_LEVEL,
  DEFAULT_ENABLED_THEME_PACKS,
  DEFAULT_PLAYER_GENDER,
} from '../../constants';
import { fetchCorrectedCharacterDetails_Service, fetchCorrectedLocalPlace_Service } from '../corrections';
import { isApiConfigured } from '../apiClient';
import {
  DEFAULT_IDEAL_EDGE_LENGTH,
  DEFAULT_NESTED_PADDING,
  DEFAULT_NESTED_ANGLE_PADDING,
} from '../../utils/mapLayoutUtils';
import {
  DEFAULT_LABEL_MARGIN_PX,
  DEFAULT_LABEL_LINE_HEIGHT_EM,
} from '../../utils/mapConstants';
import { findThemeByName } from '../themeUtils';

/** V1 KnownUse structure for conversion. */
export interface V1KnownUse {
  actionName: string;
  promptEffect: string;
  description?: string;
}

/** V1 Item structure for conversion. */
export interface V1Item {
  name: string;
  type: string;
  description: string;
  isActive?: boolean;
  isJunk?: boolean;
  knownUses?: V1KnownUse[];
}

/** V1 Place representation for conversion. */
export interface V1Place {
  themeName: string;
  name: string;
  description: string;
  aliases?: string[];
}

/** V1 Character representation for conversion. */
export interface V1Character {
  themeName: string;
  name: string;
  description: string;
  aliases?: string[];
}

/** V1 theme memory structure. */
export interface V1ThemeMemory {
  summary: string;
  overarchingQuest: string;
  currentObjective: string;
  placeNames: string[];
  characterNames: string[];
}

/** Map of theme memories in V1 saves. */
export interface V1ThemeHistoryState {
  [themeName: string]: V1ThemeMemory;
}

/** Top level V1 save shape. */
export interface V1SavedGameState {
  saveGameVersion: '1.0.0';
  currentThemeName: string | null;
  currentScene: string;
  actionOptions: string[];
  overarchingQuest: string | null;
  currentObjective: string | null;
  inventory: V1Item[];
  gameLog: string[];
  lastActionLog: string | null;
  themeHistory: V1ThemeHistoryState;
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

/** Intermediate V2 structure produced when converting from V1. */
export interface V2IntermediateSavedGameState {
  saveGameVersion: '2';
  currentThemeName: string | null;
  currentThemeObject: AdventureTheme | null;
  currentScene: string;
  actionOptions: string[];
  mainQuest: string | null;
  currentObjective: string | null;
  inventory: Item[];
  gameLog: string[];
  lastActionLog: string | null;
  themeHistory: ThemeHistoryState;
  pendingNewThemeNameAfterShift: string | null;
  allCharacters: Character[];
  score: number;
  localTime: string | null;
  localEnvironment: string | null;
  localPlace: string | null;
  turnsSinceLastShift: number;
  globalTurnNumber: number;
  playerGender: string;
  enabledThemePacks: ThemePackName[];
  stabilityLevel: number;
  chaosLevel: number;
  mapData: MapData;
  currentMapNodeId: string | null;
  mapLayoutConfig: MapLayoutConfig;
  isCustomGameMode: boolean;
}

/** Returns default map layout configuration. */
export const getDefaultMapLayoutConfig = (): MapLayoutConfig => ({
  IDEAL_EDGE_LENGTH: DEFAULT_IDEAL_EDGE_LENGTH,
  NESTED_PADDING: DEFAULT_NESTED_PADDING,
  NESTED_ANGLE_PADDING: DEFAULT_NESTED_ANGLE_PADDING,
  LABEL_MARGIN_PX: DEFAULT_LABEL_MARGIN_PX,
  LABEL_LINE_HEIGHT_EM: DEFAULT_LABEL_LINE_HEIGHT_EM,
});

/**
 * Converts a V1 save into an intermediate V2 structure.
 * @param v1Data Data parsed from an old V1 save file.
 */
export async function convertV1toV2Intermediate(v1Data: V1SavedGameState): Promise<V2IntermediateSavedGameState> {
  const v2Inventory: Item[] = v1Data.inventory.map((v1Item: V1Item) => ({
    name: v1Item.name,
    type: v1Item.type as ItemType,
    description: v1Item.description,
    activeDescription: undefined,
    isActive: v1Item.isActive ?? false,
    knownUses: (v1Item.knownUses || []).map((ku: V1KnownUse): V2KnownUse => ({
      ...ku,
      appliesWhenActive: undefined,
      appliesWhenInactive: undefined,
    })),
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
        placeNames: v1Memory.placeNames,
        characterNames: v1Memory.characterNames,
      };
    }
  }

  const v1ConvertedMapNodes: MapNode[] = v1Data.allPlaces.map((v1Place, index) => {
    const baseNameForId = v1Place.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const nodeId = `${v1Place.themeName}_${baseNameForId}_v1main_${index}`;
    return {
      id: nodeId,
      themeName: v1Place.themeName,
      placeName: v1Place.name,
      position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 },
      data: {
        description: v1Place.description || 'Description missing from V1 save',
        aliases: v1Place.aliases || [],
        status: 'discovered',
        isFeature: false,
        visited: true,
        nodeType: 'location',
      },
    };
  });

  const v1MapData: MapData = { nodes: v1ConvertedMapNodes, edges: [] };

  let v2LocalPlace = v1Data.localPlace;
  const currentThemeObjFromV1 = findThemeByName(v1Data.currentThemeName);
  if ((!v2LocalPlace || v2LocalPlace === 'Unknown' || v2LocalPlace === 'Undetermined Location') && currentThemeObjFromV1 && v1Data.currentScene) {
    try {
      const inferredPlace = await fetchCorrectedLocalPlace_Service(
        v1Data.currentScene,
        currentThemeObjFromV1,
        v1ConvertedMapNodes,
        v1Data.localTime,
        v1Data.localEnvironment
      );
      if (inferredPlace) v2LocalPlace = inferredPlace;
    } catch (e) { console.error('V1 conversion: Error inferring localPlace:', e); }
  }

  const v2AllCharactersPromises = v1Data.allCharacters.map(async (v1Char: V1Character) => {
    const charThemeObj = findThemeByName(v1Char.themeName);
    let presenceStatus: Character['presenceStatus'] = 'unknown';
    let lastKnownLocation: string | null = null;
    let preciseLocation: string | null = null;

    if (charThemeObj && isApiConfigured()) {
      const relevantMapNodesForCharThemeContext = v1ConvertedMapNodes.filter(
        node => node.themeName === charThemeObj.name,
      );
      const sceneContextForChar = (v1Data.currentThemeName === v1Char.themeName) ? v1Data.currentScene : undefined;
      const logContextForChar = (v1Data.currentThemeName === v1Char.themeName) ? v1Data.lastActionLog : undefined;
      try {
        const correctedDetails = await fetchCorrectedCharacterDetails_Service(
          v1Char.name,
          logContextForChar || undefined,
          sceneContextForChar || undefined,
          charThemeObj,
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
      themeName: v1Char.themeName,
      name: v1Char.name,
      description: v1Char.description,
      aliases: v1Char.aliases || [],
      presenceStatus,
      lastKnownLocation,
      preciseLocation,
      dialogueSummaries: [],
    };
  });
  const v2AllCharacters: Character[] = await Promise.all(v2AllCharactersPromises);

  return {
    saveGameVersion: '2',
    currentThemeName: v1Data.currentThemeName,
    currentThemeObject: currentThemeObjFromV1,
    currentScene: v1Data.currentScene,
    actionOptions: v1Data.actionOptions,
    mainQuest: v1Data.overarchingQuest,
    currentObjective: v1Data.currentObjective,
    inventory: v2Inventory,
    gameLog: v1Data.gameLog,
    lastActionLog: v1Data.lastActionLog,
    themeHistory: v2ThemeHistory,
    pendingNewThemeNameAfterShift: v1Data.pendingNewThemeNameAfterShift,
    allCharacters: v2AllCharacters,
    score: v1Data.score,
    localTime: v1Data.localTime,
    localEnvironment: v1Data.localEnvironment,
    localPlace: v2LocalPlace || 'Undetermined Location',
    turnsSinceLastShift: 0,
    globalTurnNumber: 0,
    playerGender: v1Data.playerGender || DEFAULT_PLAYER_GENDER,
    enabledThemePacks: v1Data.enabledThemePacks || [...DEFAULT_ENABLED_THEME_PACKS],
    stabilityLevel: v1Data.stabilityLevel ?? DEFAULT_STABILITY_LEVEL,
    chaosLevel: v1Data.chaosLevel ?? DEFAULT_CHAOS_LEVEL,
    mapData: v1MapData,
    currentMapNodeId: null,
    mapLayoutConfig: getDefaultMapLayoutConfig(),
    isCustomGameMode: false,
  };
}

/**
 * Converts a V2 intermediate save into the current save shape.
 * @param v2Data Data produced by the V1 to V2 converter or loaded from a V2 save.
 */
export function convertV2toV3Shape(v2Data: V2IntermediateSavedGameState): SavedGameDataShape {
  const { ...v3RelevantData } = v2Data;

  let finalMapData: MapData;
  if (v2Data.mapData && Array.isArray(v2Data.mapData.nodes) && Array.isArray(v2Data.mapData.edges)) {
    finalMapData = {
      nodes: v2Data.mapData.nodes.map(node => ({
        ...node,
        data: {
          description: node.data.description || 'Description missing from V2 save',
          aliases: node.data.aliases || [],
          status: node.data.status || 'discovered',
          isFeature: node.data.isFeature ?? false,
          visited: node.data.visited ?? false,
          parentNodeId: node.data.parentNodeId,
          nodeType: node.data.nodeType ?? 'location',
          ...Object.fromEntries(Object.entries(node.data).filter(([key]) => !['description', 'aliases', 'status', 'isFeature', 'visited', 'parentNodeId'].includes(key)))
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
        const val = (loadedConfig as Record<string, unknown>)[key];
        if (Object.prototype.hasOwnProperty.call(loadedConfig, key) && typeof val === 'number') {
          patchedConfig[key] = val;
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
    dialogueSummaries: char.dialogueSummaries || [],
  }));

  const finalCurrentThemeObject = v2Data.currentThemeObject || findThemeByName(v2Data.currentThemeName);

  return {
    ...v3RelevantData,
    currentThemeObject: finalCurrentThemeObject,
    allCharacters: finalAllCharacters,
    saveGameVersion: CURRENT_SAVE_GAME_VERSION,
    mapData: finalMapData,
    currentMapNodeId: finalCurrentMapNodeId,
    mapLayoutConfig: finalMapLayoutConfig,
    isCustomGameMode: v2Data.isCustomGameMode ?? false,
    globalTurnNumber: v2Data.globalTurnNumber ?? 0,
  };
}


/** Validates items when converting older saves. */


/** Validates a map layout configuration during conversion. */
function isValidMapLayoutConfig(config: unknown): config is MapLayoutConfig {
  if (!config || typeof config !== 'object') return false;
  const maybe = config as Partial<MapLayoutConfig>;
  const keys = Object.keys(getDefaultMapLayoutConfig()) as Array<keyof MapLayoutConfig>;
  for (const key of keys) {
    const val = maybe[key];
    if (typeof val !== 'number') {
      console.warn(`isValidMapLayoutConfig: Key '${key}' is missing or not a number. Value: ${String(val)}`);
      return false;
    }
  }
  return true;
}
