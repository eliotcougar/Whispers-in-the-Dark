/**
 * @file validators.ts
 * @description Validation helpers for game save data and related utilities.
 */
import {
  SavedGameDataShape,
  Item,
  ThemeHistoryState,
  ThemeMemory,
  AdventureTheme,
  Character,
  ThemePackName,
  KnownUse,
  MapData,
  MapNode,
  MapEdge,
  MapLayoutConfig,
  MapNodeData,
  DialogueSummaryRecord,
} from '../../types';
import {
  CURRENT_SAVE_GAME_VERSION,
  VALID_ITEM_TYPES,
  VALID_PRESENCE_STATUS_VALUES,
  PLAYER_HOLDER_ID,
} from '../../constants';
import { ALL_THEME_PACK_NAMES } from '../../themes';
import { getDefaultMapLayoutConfig } from '../../hooks/useMapUpdates';
import { DEFAULT_VIEWBOX } from '../../constants';
import { buildCharacterId, buildItemId } from '../../utils/entityUtils';

// --- Validation Helpers for SavedGameDataShape (V3) ---
export function isValidDialogueSummaryRecord(record: unknown): record is DialogueSummaryRecord {
  if (!record || typeof record !== 'object') return false;
  const maybe = record as Partial<DialogueSummaryRecord>;
  return (
    typeof maybe.summaryText === 'string' &&
    Array.isArray(maybe.participants) &&
    maybe.participants.every((p: unknown) => typeof p === 'string') &&
    typeof maybe.timestamp === 'string' &&
    typeof maybe.location === 'string'
  );
}

export function isValidItemForSave(item: unknown): item is Item {
  if (!item || typeof item !== 'object') return false;
  const maybe = item as Partial<Item>;
  return (
    typeof maybe.id === 'string' &&
    typeof maybe.name === 'string' &&
    typeof maybe.type === 'string' &&
    (VALID_ITEM_TYPES as ReadonlyArray<string>).includes(maybe.type) &&
    typeof maybe.description === 'string' &&
    typeof maybe.holderId === 'string' &&
    (maybe.activeDescription === undefined || typeof maybe.activeDescription === 'string') &&
    (maybe.isActive === undefined || typeof maybe.isActive === 'boolean') &&
    (maybe.isJunk === undefined || typeof maybe.isJunk === 'boolean') &&
    (maybe.knownUses === undefined ||
      (Array.isArray(maybe.knownUses) &&
        maybe.knownUses.every((ku: KnownUse) =>
          typeof ku.actionName === 'string' &&
          typeof ku.promptEffect === 'string' &&
          (ku.description === undefined || typeof ku.description === 'string') &&
          (ku.appliesWhenActive === undefined || typeof ku.appliesWhenActive === 'boolean') &&
          (ku.appliesWhenInactive === undefined || typeof ku.appliesWhenInactive === 'boolean')
        )))
  );
}

export function isValidThemeHistory(history: unknown): history is ThemeHistoryState {
  if (typeof history !== 'object' || history === null) return false;
  const record = history as Record<string, unknown>;
  for (const key in record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const entry = record[key] as Partial<ThemeMemory> | undefined;
      if (
        !entry ||
        typeof entry.summary !== 'string' ||
        typeof entry.mainQuest !== 'string' ||
        typeof entry.currentObjective !== 'string' ||
        !Array.isArray(entry.placeNames) ||
        !entry.placeNames.every((name: unknown) => typeof name === 'string') ||
        !Array.isArray(entry.characterNames) ||
        !entry.characterNames.every((name: unknown) => typeof name === 'string')
      )
        return false;
    }
  }
  return true;
}

export function isValidCharacterForSave(character: unknown): character is Character {
  if (!character || typeof character !== 'object') return false;
  const maybe = character as Partial<Character>;
  return (
    typeof maybe.id === 'string' &&
    maybe.id.trim() !== '' &&
    typeof maybe.themeName === 'string' &&
    typeof maybe.name === 'string' &&
    maybe.name.trim() !== '' &&
    typeof maybe.description === 'string' &&
    maybe.description.trim() !== '' &&
    (maybe.aliases === undefined ||
      (Array.isArray(maybe.aliases) &&
        maybe.aliases.every((alias: unknown) => typeof alias === 'string'))) &&
    (maybe.presenceStatus === undefined ||
      VALID_PRESENCE_STATUS_VALUES.includes(maybe.presenceStatus)) &&
    (maybe.lastKnownLocation === undefined ||
      maybe.lastKnownLocation === null ||
      typeof maybe.lastKnownLocation === 'string') &&
    (maybe.preciseLocation === undefined ||
      maybe.preciseLocation === null ||
      typeof maybe.preciseLocation === 'string') &&
    (maybe.dialogueSummaries === undefined ||
      (Array.isArray(maybe.dialogueSummaries) &&
        maybe.dialogueSummaries.every(isValidDialogueSummaryRecord)))
  );
}

export function isValidThemePackNameArray(packs: unknown): packs is Array<ThemePackName> {
  return Array.isArray(packs) && packs.every(p => typeof p === 'string' && ALL_THEME_PACK_NAMES.includes(p as ThemePackName));
}

export function isValidMapNodeData(data: unknown): data is MapNodeData {
  if (!data || typeof data !== 'object') return false;
  const maybe = data as Partial<MapNodeData> & { aliases?: unknown };
  return (
    typeof maybe.description === 'string' &&
    (maybe.aliases === undefined ||
      (Array.isArray(maybe.aliases) &&
        maybe.aliases.every((alias: unknown) => typeof alias === 'string'))) &&
    (maybe.status === undefined ||
      ['undiscovered', 'discovered', 'rumored', 'quest_target', 'blocked'].includes(maybe.status)) &&
    (maybe.visited === undefined || typeof maybe.visited === 'boolean') &&
    (maybe.isFeature === undefined || typeof maybe.isFeature === 'boolean') &&
    (maybe.parentNodeId === undefined || typeof maybe.parentNodeId === 'string')
  );
}

export function isValidMapNode(node: unknown): node is MapNode {
  if (!node || typeof node !== 'object') return false;
  const maybe = node as Partial<MapNode> & { position?: unknown };
  const pos = maybe.position as { x?: unknown; y?: unknown } | undefined;
  return (
    typeof maybe.id === 'string' &&
    maybe.id.trim() !== '' &&
    typeof maybe.themeName === 'string' &&
    typeof maybe.placeName === 'string' &&
    maybe.placeName.trim() !== '' &&
    pos !== undefined &&
    typeof pos.x === 'number' &&
    typeof pos.y === 'number' &&
    isValidMapNodeData(maybe.data)
  );
}

export function isValidMapEdge(edge: unknown): edge is MapEdge {
  if (!edge || typeof edge !== 'object') return false;
  const maybe = edge as Partial<MapEdge>;
  return (
    typeof maybe.id === 'string' &&
    maybe.id.trim() !== '' &&
    typeof maybe.sourceNodeId === 'string' &&
    maybe.sourceNodeId.trim() !== '' &&
    typeof maybe.targetNodeId === 'string' &&
    maybe.targetNodeId.trim() !== '' &&
    typeof maybe.data === 'object'
  );
}

export function isValidMapData(mapData: unknown): mapData is MapData {
  if (!mapData || typeof mapData !== 'object') return false;
  const maybe = mapData as Partial<MapData>;
  return (
    Array.isArray(maybe.nodes) &&
    maybe.nodes.every(isValidMapNode) &&
    Array.isArray(maybe.edges) &&
    maybe.edges.every(isValidMapEdge)
  );
}

export function isValidMapLayoutConfig(config: unknown): config is MapLayoutConfig {
  if (!config || typeof config !== 'object') return false;
  const maybe = config as Partial<MapLayoutConfig>;
  const defaultKeys = Object.keys(getDefaultMapLayoutConfig()) as Array<keyof MapLayoutConfig>;
  for (const key of defaultKeys) {
    const val = maybe[key];
    if (typeof val !== 'number') {
      console.warn(
        `isValidMapLayoutConfig: Key '${key}' is missing or not a number. Value: ${String(val)}`,
      );
      return false;
    }
  }
  return true;
}

export function isValidAdventureThemeObject(obj: unknown): obj is AdventureTheme {
  if (!obj || typeof obj !== 'object') return false;
  const maybe = obj as Partial<AdventureTheme>;
  return (
    typeof maybe.name === 'string' &&
    maybe.name.trim() !== '' &&
    typeof maybe.systemInstructionModifier === 'string' &&
    typeof maybe.initialMainQuest === 'string' &&
    typeof maybe.initialCurrentObjective === 'string' &&
    typeof maybe.initialSceneDescriptionSeed === 'string' &&
    typeof maybe.initialItems === 'string'
  );
}

export function validateSavedGameState(data: unknown): data is SavedGameDataShape {
  if (!data || typeof data !== 'object') {
    console.warn('Invalid save data: Not an object.');
    return false;
  }
  const obj = data as Partial<SavedGameDataShape> & Record<string, unknown>;
  if (obj.saveGameVersion !== CURRENT_SAVE_GAME_VERSION) {
    const providedVersion = (data as { saveGameVersion?: unknown }).saveGameVersion;
    console.warn(`Save data version mismatch. Expected ${CURRENT_SAVE_GAME_VERSION}, got ${String(providedVersion)}. Attempting to load anyway if structure is V3-compatible.`);
  }

  const fields: Array<keyof SavedGameDataShape> = [
    'currentThemeName', 'currentThemeObject', 'currentScene', 'actionOptions', 'mainQuest', 'currentObjective',
    'inventory', 'gameLog', 'lastActionLog', 'themeHistory',
    'pendingNewThemeNameAfterShift',
    'allCharacters', 'mapData', 'currentMapNodeId', 'destinationNodeId', 'mapLayoutConfig', 'mapViewBox', 'score', 'stabilityLevel', 'chaosLevel',
    'localTime', 'localEnvironment', 'localPlace', 'enabledThemePacks', 'playerGender',
    'turnsSinceLastShift', 'globalTurnNumber', 'isCustomGameMode'
  ];
  for (const field of fields) {
    if (!(field in obj)) {
      const nullableFields: Array<keyof SavedGameDataShape> = [
        'currentThemeName',
        'currentThemeObject',
        'mainQuest',
        'currentObjective',
        'lastActionLog',
        'pendingNewThemeNameAfterShift',
        'localTime',
        'localEnvironment',
        'localPlace',
        'currentMapNodeId',
        'destinationNodeId',
      ];
      if (
        !(nullableFields.includes(field) && obj[field] === null) &&
        field !== 'isCustomGameMode' &&
        field !== 'globalTurnNumber'
      ) {
        console.warn(`Invalid save data (V3): Missing field '${field}'.`); return false;
      }
    }
  }

  if (obj.currentThemeName !== null && typeof obj.currentThemeName !== 'string') { console.warn('Invalid save data (V3): currentThemeName type.'); return false; }
  if (obj.currentThemeObject !== null && !isValidAdventureThemeObject(obj.currentThemeObject)) { console.warn('Invalid save data (V3): currentThemeObject type or structure.'); return false; }
  if (typeof obj.currentScene !== 'string') { console.warn('Invalid save data (V3): currentScene type.'); return false; }
  if (!Array.isArray(obj.actionOptions) || !obj.actionOptions.every((opt: unknown) => typeof opt === 'string')) { console.warn('Invalid save data (V3): actionOptions.'); return false; }
  if (obj.mainQuest !== null && typeof obj.mainQuest !== 'string') { console.warn('Invalid save data (V3): mainQuest type.'); return false; }
  if (obj.currentObjective !== null && typeof obj.currentObjective !== 'string') { console.warn('Invalid save data (V3): currentObjective type.'); return false; }
  if (!Array.isArray(obj.inventory) || !obj.inventory.every(isValidItemForSave)) { console.warn('Invalid save data (V3): inventory.'); return false; }
  if (!Array.isArray(obj.gameLog) || !obj.gameLog.every((msg: unknown) => typeof msg === 'string')) { console.warn('Invalid save data (V3): gameLog.'); return false; }
  if (obj.lastActionLog !== null && typeof obj.lastActionLog !== 'string') { console.warn('Invalid save data (V3): lastActionLog type.'); return false; }
  if (!isValidThemeHistory(obj.themeHistory)) { console.warn('Invalid save data (V3): themeHistory.'); return false; }
  if (obj.pendingNewThemeNameAfterShift !== null && typeof obj.pendingNewThemeNameAfterShift !== 'string') { console.warn('Invalid save data (V3): pendingNewThemeNameAfterShift type.'); return false; }
  if (!Array.isArray(obj.allCharacters) || !obj.allCharacters.every(isValidCharacterForSave)) { console.warn('Invalid save data (V3): allCharacters.'); return false; }
  if (!isValidMapData(obj.mapData)) { console.warn('Invalid save data (V3): mapData.'); return false; }
  if (obj.currentMapNodeId !== null && typeof obj.currentMapNodeId !== 'string') { console.warn('Invalid save data (V3): currentMapNodeId type.'); return false; }
  if (obj.destinationNodeId !== null && typeof obj.destinationNodeId !== 'string') { console.warn('Invalid save data (V3): destinationNodeId type.'); return false; }
  if (!isValidMapLayoutConfig(obj.mapLayoutConfig)) { console.warn('Invalid save data (V3): mapLayoutConfig.'); return false; }
  if (typeof obj.mapViewBox !== 'string') { console.warn('Invalid save data (V3): mapViewBox type.'); return false; }
  if (typeof obj.score !== 'number') { console.warn('Invalid save data (V3): score type.'); return false; }
  if (typeof obj.stabilityLevel !== 'number') { console.warn('Invalid save data (V3): stabilityLevel type.'); return false; }
  if (typeof obj.chaosLevel !== 'number') { console.warn('Invalid save data (V3): chaosLevel type.'); return false; }
  if (obj.localTime !== null && typeof obj.localTime !== 'string') { console.warn('Invalid save data (V3): localTime type.'); return false; }
  if (obj.localEnvironment !== null && typeof obj.localEnvironment !== 'string') { console.warn('Invalid save data (V3): localEnvironment type.'); return false; }
  if (obj.localPlace !== null && typeof obj.localPlace !== 'string') { console.warn('Invalid save data (V3): localPlace type.'); return false; }
  if (!isValidThemePackNameArray(obj.enabledThemePacks)) { console.warn('Invalid save data (V3): enabledThemePacks.'); return false; }
  if (typeof obj.playerGender !== 'string') { console.warn('Invalid save data (V3): playerGender type.'); return false; }
  if (typeof obj.turnsSinceLastShift !== 'number') { console.warn('Invalid save data(V3): turnsSinceLastShift type.'); return false; }
  if (typeof obj.globalTurnNumber !== 'number') { console.warn('Invalid save data(V3): globalTurnNumber type.'); return false; }
  if (obj.isCustomGameMode !== undefined && typeof obj.isCustomGameMode !== 'boolean') { console.warn('Invalid save data (V3): isCustomGameMode type.'); return false; }

  const dialogueFields: Array<string> = ['dialogueState'];
  for (const field of dialogueFields) {
    if (field in obj && obj[field as keyof SavedGameDataShape] !== null && obj[field as keyof SavedGameDataShape] !== undefined) {
      console.warn(`Invalid save data (V3): Unexpected dialogue field '${field}' found in SavedGameDataShape. It should be null/undefined here.`); return false;
    }
  }

  return true;
}

export function ensureCompleteMapLayoutConfig(configHolder: { mapLayoutConfig?: Partial<MapLayoutConfig> | MapLayoutConfig }): void {
  const defaultConfig = getDefaultMapLayoutConfig();
  if (configHolder.mapLayoutConfig && typeof configHolder.mapLayoutConfig === 'object') {
    const loadedConfig = configHolder.mapLayoutConfig as Partial<MapLayoutConfig>;
    const patchedConfig: Partial<MapLayoutConfig> = {};
    for (const key of Object.keys(defaultConfig) as Array<keyof MapLayoutConfig>) {
      const val = (loadedConfig as Record<string, unknown>)[key];
      if (Object.prototype.hasOwnProperty.call(loadedConfig, key) && typeof val === 'number') {
        patchedConfig[key] = val;
      } else {
        patchedConfig[key] = defaultConfig[key];
      }
    }
    configHolder.mapLayoutConfig = patchedConfig as MapLayoutConfig;
  } else {
    configHolder.mapLayoutConfig = defaultConfig;
  }
}

export function ensureCompleteMapNodeDataDefaults(mapData: MapData | undefined): void {
  if (!mapData || !Array.isArray(mapData.nodes)) {
    return;
  }
  mapData.nodes.forEach(node => {
    const data = (node as { data?: MapNodeData }).data;
    if (!data) {
      node.data = {} as MapNodeData;
    }
    if (typeof node.data.description !== 'string') {
      node.data.description = 'No description provided.';
    }
    if (!Array.isArray(node.data.aliases)) {
      node.data.aliases = [];
    } else {
      node.data.aliases = node.data.aliases.filter(alias => typeof alias === 'string');
    }
    if (!['undiscovered', 'discovered', 'rumored', 'quest_target', 'blocked'].includes(node.data.status)) {
      node.data.status = 'discovered';
    }
    if (typeof node.data.visited !== 'boolean') {
      node.data.visited = false;
    }
    if (typeof node.data.isFeature !== 'boolean') {
      node.data.isFeature = false;
    }
  });
}

export function postProcessValidatedData(data: SavedGameDataShape): SavedGameDataShape {
  data.inventory = data.inventory.map((item: Item) => ({
    ...item,
    id: item.id || buildItemId(item.name),
    isJunk: item.isJunk ?? false,
    holderId: item.holderId || PLAYER_HOLDER_ID,
  }));
  // Numeric fields and nullable strings are guaranteed by validation
  data.allCharacters = data.allCharacters.map((c: unknown) => {
    const char = c as Partial<Character>;
    return {
      ...char,
      id: char.id ?? buildCharacterId(char.name!),
      aliases: char.aliases ?? [],
      presenceStatus: char.presenceStatus ?? 'unknown',
      lastKnownLocation: char.lastKnownLocation ?? null,
      preciseLocation: char.preciseLocation ?? null,
      dialogueSummaries: char.dialogueSummaries ?? [],
    } as Character;
  });
  data.mapViewBox = typeof data.mapViewBox === 'string' ? data.mapViewBox : DEFAULT_VIEWBOX;
  return data;
}
