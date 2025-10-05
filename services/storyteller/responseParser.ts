/**
 * @file responseParser.ts
 * @description Utilities for validating and parsing AI storyteller responses.
 */

import {
    GameStateFromAI,
    HeroSheet,
    Item,
    NPC,
    MapData,
    ValidNPCUpdatePayload,
    ValidNewNPCPayload,
    DialogueSetupPayload,
    MapNode,
    AdventureTheme,
} from '../../types';
import { MAIN_TURN_OPTIONS_COUNT, DEFAULT_NPC_ATTITUDE } from '../../constants';
import {
    isValidNPCUpdate,
    isValidNewNPCPayload,
    isDialogueSetupPayloadStructurallyValid,
} from '../parsers/validation';
import { trimDialogueHints } from '../../utils/dialogueParsing';
import {
    fetchCorrectedName_Service,
    fetchCorrectedNPCDetails_Service,
    fetchCorrectedDialogueSetup_Service,
} from '../corrections';

import { safeParseJson, coerceNullToUndefined } from '../../utils/jsonUtils';
import { buildNPCId, findNPCByIdentifier } from '../../utils/entityUtils';

export type ParseFailureReason =
    | 'json_parse_failed'
    | 'non_object'
    | 'missing_scene_description'
    | 'invalid_base_fields'
    | 'invalid_options'
    | 'unknown';

export interface ParseAIResponseResult {
    data: GameStateFromAI | null;
    error: string | null;
    reason: ParseFailureReason | null;
}

type RecordParseFailure = (reason: ParseFailureReason, message: string) => void;

const toAttitude = (value?: unknown): string => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return DEFAULT_NPC_ATTITUDE;
};

const toKnownNames = (value?: unknown): Array<string> => {
    if (Array.isArray(value)) {
        const names: Array<string> = [];
        for (const entry of value) {
            if (typeof entry !== 'string') continue;
            const trimmed = entry.trim();
            if (trimmed.length === 0) continue;
            names.push(trimmed);
        }
        return names;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? [trimmed] : [];
    }
    return [];
};

const normalizeKnownPlayerNames = (
    primary?: unknown,
    fallback?: unknown,
): Array<string> => toKnownNames(primary ?? fallback);

const toValidNewNPCPayload = (candidate: unknown): ValidNewNPCPayload | null => {
    if (!candidate || typeof candidate !== 'object') return null;
    const rawCandidate = candidate as Record<string, unknown>;
    const normalized: Record<string, unknown> = {
        ...rawCandidate,
        attitudeTowardPlayer: toAttitude(rawCandidate.attitudeTowardPlayer),
        knowsPlayerAs: normalizeKnownPlayerNames(
            rawCandidate.knowsPlayerAs,
            rawCandidate.knownPlayerName,
        ),
        lastKnownLocation:
            rawCandidate.lastKnownLocation === undefined
                ? null
                : rawCandidate.lastKnownLocation,
        preciseLocation:
            rawCandidate.preciseLocation === undefined
                ? null
                : rawCandidate.preciseLocation,
    };
    delete normalized.knownPlayerName;
    if (!isValidNewNPCPayload(normalized)) return null;
    return normalized as ValidNewNPCPayload;
};

const createNPCFromNewPayload = (payload: ValidNewNPCPayload): NPC => ({
    ...payload,
    id: buildNPCId(payload.name),
    aliases: payload.aliases ?? [],
    presenceStatus: payload.presenceStatus ?? 'unknown',
    attitudeTowardPlayer: toAttitude(payload.attitudeTowardPlayer),
    knowsPlayerAs: payload.knowsPlayerAs ?? [],
    lastKnownLocation: payload.lastKnownLocation ?? null,
    preciseLocation: payload.preciseLocation ?? null,
    dialogueSummaries: [],
});

const toValidNPCUpdatePayload = (candidate: unknown): ValidNPCUpdatePayload | null => {
    if (!isValidNPCUpdate(candidate)) return null;
    const payload = candidate as ValidNPCUpdatePayload & {
        newKnownPlayerName?: unknown;
    };
    const normalizedKnownNames = normalizeKnownPlayerNames(
        payload.newKnownPlayerNames,
        payload.newKnownPlayerName,
    );
    if (normalizedKnownNames.length > 0) {
        payload.newKnownPlayerNames = Array.from(new Set(normalizedKnownNames));
    }
    delete (payload as { newKnownPlayerName?: unknown }).newKnownPlayerName;
    return payload;
};

const collectNPCsForDialogueContext = (
    data: Partial<GameStateFromAI>,
    context: ParserContext,
): Array<NPC> => {
    const npcsForContext: Array<NPC> = [...context.allRelevantNPCs];
    const npcByName = new Map<string, NPC>(
        npcsForContext.map(npc => [npc.name, npc]),
    );

    const handleAddCandidate = (candidate: unknown): void => {
        const payload = toValidNewNPCPayload(candidate);
        if (!payload) return;
        const npc = createNPCFromNewPayload(payload);
        npcsForContext.push(npc);
        npcByName.set(npc.name, npc);
    };

    const handleUpdateCandidate = (candidate: unknown): void => {
        const payload = toValidNPCUpdatePayload(candidate);
        if (!payload) return;
        const existing = npcByName.get(payload.name);
        const normalized: NPC = {
            id: buildNPCId(payload.name),
            name: payload.name,
            description:
                payload.newDescription ?? existing?.description ?? 'Updated NPC',
            aliases:
                payload.newAliases ??
                (payload.addAlias
                    ? [...(existing?.aliases ?? []), payload.addAlias]
                    : existing?.aliases ?? []),
            presenceStatus:
                payload.newPresenceStatus ?? existing?.presenceStatus ?? 'unknown',
            attitudeTowardPlayer: toAttitude(
                payload.newAttitudeTowardPlayer ?? existing?.attitudeTowardPlayer,
            ),
            knowsPlayerAs:
                normalizeKnownPlayerNames(
                    payload.newKnownPlayerNames,
                    existing?.knowsPlayerAs,
                ),
            lastKnownLocation:
                payload.newLastKnownLocation ?? existing?.lastKnownLocation ?? null,
            preciseLocation:
                payload.newPreciseLocation ?? existing?.preciseLocation ?? null,
            dialogueSummaries: existing?.dialogueSummaries ?? [],
        };
        npcsForContext.push(normalized);
        npcByName.set(normalized.name, normalized);
    };

    if (Array.isArray(data.npcsAdded)) {
        data.npcsAdded.forEach(handleAddCandidate);
    }
    if (Array.isArray(data.npcsUpdated)) {
        data.npcsUpdated.forEach(handleUpdateCandidate);
    }

    return npcsForContext;
};

const ensurePresenceConsistency = (npc: NPC): NPC => {
    const next: NPC = { ...npc };
    if (next.presenceStatus === 'distant' || next.presenceStatus === 'unknown') {
        next.preciseLocation = null;
    } else {
        next.preciseLocation ??=
            next.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
    }
    return next;
};

const mergeUniqueStrings = (
    ...collections: Array<Array<string> | undefined>
): Array<string> => {
    const merged = new Set<string>();
    for (const collection of collections) {
        if (!collection) continue;
        for (const entry of collection) {
            if (typeof entry !== 'string') continue;
            const trimmed = entry.trim();
            if (trimmed.length === 0) continue;
            merged.add(trimmed);
        }
    }
    return Array.from(merged);
};

const applyNPCUpdateToExisting = (
    npc: NPC,
    update: ValidNPCUpdatePayload,
): NPC => {
    const updated: NPC = { ...npc };
    if (update.newDescription !== undefined) {
        updated.description = update.newDescription;
    }
    if (update.newAliases !== undefined) {
        updated.aliases = update.newAliases;
    }
    if (update.addAlias) {
        updated.aliases = mergeUniqueStrings(updated.aliases ?? [], [update.addAlias]);
    }
    if (update.newPresenceStatus !== undefined) {
        updated.presenceStatus = update.newPresenceStatus;
    }
    if (update.newAttitudeTowardPlayer !== undefined) {
        updated.attitudeTowardPlayer = toAttitude(update.newAttitudeTowardPlayer);
    }
    if (update.newKnownPlayerNames !== undefined) {
        updated.knowsPlayerAs = normalizeKnownPlayerNames(update.newKnownPlayerNames);
    }
    if (update.newLastKnownLocation !== undefined) {
        updated.lastKnownLocation = update.newLastKnownLocation;
    }
    if (update.newPreciseLocation !== undefined) {
        updated.preciseLocation = update.newPreciseLocation;
    }
    return ensurePresenceConsistency(updated);
};

const buildNPCFromUpdatePayload = (
    update: ValidNPCUpdatePayload,
    existing?: NPC,
): NPC => {
    const aliases = update.newAliases ??
        mergeUniqueStrings(existing?.aliases, update.addAlias ? [update.addAlias] : undefined);
    const newKnownNames = update.newKnownPlayerNames;
    const knowsPlayerAs = newKnownNames === undefined
        ? existing?.knowsPlayerAs ?? []
        : normalizeKnownPlayerNames(newKnownNames);

    return ensurePresenceConsistency({
        id: buildNPCId(update.name),
        name: update.name,
        description: update.newDescription ?? existing?.description ?? `Details for ${update.name} are emerging.`,
        aliases,
        presenceStatus: update.newPresenceStatus ?? existing?.presenceStatus ?? 'unknown',
        attitudeTowardPlayer: toAttitude(update.newAttitudeTowardPlayer ?? existing?.attitudeTowardPlayer),
        knowsPlayerAs,
        lastKnownLocation: update.newLastKnownLocation ?? existing?.lastKnownLocation ?? null,
        preciseLocation: update.newPreciseLocation ?? existing?.preciseLocation ?? null,
        dialogueSummaries: existing?.dialogueSummaries ?? [],
    });
};

const buildNPCFromUpdateAsAddition = async (
    update: ValidNPCUpdatePayload,
    baseData: Partial<GameStateFromAI>,
    context: ParserContext,
): Promise<NPC> => {
    let npc = buildNPCFromUpdatePayload(update);
    if (npc.description === `Details for ${update.name} are emerging.`) {
        const correctedDetails = await fetchCorrectedNPCDetails_Service(
            update.name,
            context.logMessageFromPayload ?? baseData.logMessage,
            context.sceneDescriptionFromPayload ?? baseData.sceneDescription,
            context.theme,
            context.allRelevantMainMapNodesForCorrection,
        );
        if (correctedDetails) {
            npc = enrichNPCFromCorrection(npc, correctedDetails);
        }
    }
    return npc;
};

const normalizeNPCUpdateCandidate = async (
    candidate: unknown,
    knownNPCs: Array<NPC>,
    knownNames: Set<string>,
    baseData: Partial<GameStateFromAI>,
    context: ParserContext,
): Promise<ValidNPCUpdatePayload | null> => {
    if (!candidate || typeof candidate !== 'object') {
        console.warn("parseAIResponse ('npcsUpdated'): Update missing or malformed. Discarding.", candidate);
        return null;
    }

    const rawPayload = { ...(candidate as Record<string, unknown>) };
    if (typeof rawPayload.name !== 'string' || rawPayload.name.trim() === '') {
        console.warn("parseAIResponse ('npcsUpdated'): Update missing or has invalid 'name'. Discarding.", candidate);
        return null;
    }

    const payloadIdentifierForLogs = rawPayload.name;

    if ('newKnownPlayerName' in rawPayload) {
        const value = rawPayload.newKnownPlayerName;
        rawPayload.newKnownPlayerNames = Array.isArray(value)
            ? value
            : value !== undefined && value !== null
                ? [value]
                : [];
        delete rawPayload.newKnownPlayerName;
    }

    const matchedNPC = findNPCByIdentifier(
        rawPayload.name,
        knownNPCs,
    ) as NPC | undefined;

    if (matchedNPC) {
        rawPayload.name = matchedNPC.name;
    } else if (!knownNames.has(rawPayload.name)) {
        console.warn(
            `parseAIResponse ('npcsUpdated'): Identifier "${payloadIdentifierForLogs}" not found. Attempting name correction.`,
        );
        const correctedName = await fetchCorrectedName_Service(
            'NPC name',
            rawPayload.name,
            context.logMessageFromPayload ?? baseData.logMessage,
            context.sceneDescriptionFromPayload ?? baseData.sceneDescription,
            Array.from(knownNames),
            context.theme,
        );
        if (correctedName && correctedName.trim() !== '') {
            rawPayload.name = correctedName;
            console.log(
                `parseAIResponse ('npcsUpdated'): Corrected target name to "${correctedName}".`,
            );
        } else {
            console.warn(
                `parseAIResponse ('npcsUpdated'): Failed to correct identifier "${payloadIdentifierForLogs}". Will attempt to process as is, may convert to 'add'.`,
            );
        }
    }

    const sanitized = toValidNPCUpdatePayload(rawPayload);
    if (!sanitized) {
        console.warn(
            `parseAIResponse ('npcsUpdated'): Payload for "${payloadIdentifierForLogs}" is invalid after potential name correction. Discarding. Payload:`,
            rawPayload,
        );
        return null;
    }

    return sanitized;
};

const createNPCFromCorrection = (
    name: string,
    details: {
        description: string;
        aliases: Array<string>;
        presenceStatus: NPC['presenceStatus'];
        attitudeTowardPlayer?: string | null;
        knowsPlayerAs?: Array<string>;
        knownPlayerName?: string;
        lastKnownLocation: string | null;
        preciseLocation: string | null;
    },
): NPC => {
    const correctedKnownNames = normalizeKnownPlayerNames(
        details.knowsPlayerAs,
        details.knownPlayerName,
    );
    return ensurePresenceConsistency({
        id: buildNPCId(name),
        name,
        description: details.description,
        aliases: mergeUniqueStrings(details.aliases),
        presenceStatus: details.presenceStatus,
        attitudeTowardPlayer: toAttitude(details.attitudeTowardPlayer),
        knowsPlayerAs: correctedKnownNames,
        lastKnownLocation: details.lastKnownLocation,
        preciseLocation: details.preciseLocation,
        dialogueSummaries: [],
    });
};

const attemptCorrectNPCAdd = async (
    originalName: string | undefined,
    baseData: Partial<GameStateFromAI>,
    context: ParserContext,
): Promise<NPC | null> => {
    const correctedDetails = await fetchCorrectedNPCDetails_Service(
        originalName ?? 'Newly Mentioned NPC',
        context.logMessageFromPayload ?? baseData.logMessage,
        context.sceneDescriptionFromPayload ?? baseData.sceneDescription,
        context.theme,
        context.allRelevantMainMapNodesForCorrection,
    );
    if (!correctedDetails) {
        return null;
    }
    const generatedName = correctedDetails.description
        .split(' ')
        .slice(0, 2)
        .join(' ')
        .trim();
    const fallbackName = originalName ?? (generatedName || 'Corrected NPC');
    return createNPCFromCorrection(fallbackName, correctedDetails);
};

const enrichNPCFromCorrection = (
    npc: NPC,
    details: {
        description: string;
        aliases: Array<string>;
        presenceStatus: NPC['presenceStatus'];
        attitudeTowardPlayer?: string | null;
        knowsPlayerAs?: Array<string>;
        knownPlayerName?: string;
        lastKnownLocation: string | null;
        preciseLocation: string | null;
    },
): NPC => {
    const mergedAliases = mergeUniqueStrings(npc.aliases, details.aliases);
    const mergedKnownNames = mergeUniqueStrings(
        npc.knowsPlayerAs,
        normalizeKnownPlayerNames(
            details.knowsPlayerAs,
            details.knownPlayerName,
        ),
    );
    return ensurePresenceConsistency({
        ...npc,
        description: details.description,
        aliases: mergedAliases,
        presenceStatus: details.presenceStatus,
        attitudeTowardPlayer: toAttitude(details.attitudeTowardPlayer ?? npc.attitudeTowardPlayer),
        knowsPlayerAs: mergedKnownNames,
        lastKnownLocation: details.lastKnownLocation,
        preciseLocation: details.preciseLocation,
    });
};

/** Interface describing contextual data required by the parsing helpers. */
interface ParserContext {
    heroGender: string;
    theme: AdventureTheme;
    onParseAttemptFailed?: () => void;
    logMessageFromPayload?: string;
    sceneDescriptionFromPayload?: string;
    allRelevantNPCs: Array<NPC>;
    allRelevantMainMapNodesForCorrection: Array<MapNode>;
    currentInventoryForCorrection: Array<Item>;
    recordFailure?: RecordParseFailure;
}

/** Result object returned from the dialogue setup handler. */
interface DialogueResult {
    dialogueSetup?: DialogueSetupPayload;
    options: Array<string>;
    isDialogueTurn: boolean;
}

/**
 * Validates base structural elements of the parsed data object.
 * Returns the object back if valid or null if validation fails.
 */
function validateBasicStructure(
    parsedData: unknown,
    onParseAttemptFailed?: () => void,
    recordFailure?: RecordParseFailure,
): Partial<GameStateFromAI> | null {
    if (!parsedData || typeof parsedData !== 'object') {
        console.warn('parseAIResponse: Parsed data is not a valid object.', parsedData);
        onParseAttemptFailed?.();
        recordFailure?.('non_object', 'Storyteller response must be a JSON object that matches the expected schema.');
        return null;
    }

    const data = parsedData as Record<string, unknown>;
    if (typeof data.sceneDescription !== 'string' || data.sceneDescription.trim() === '') {
        console.warn('parseAIResponse: sceneDescription is missing or empty.', parsedData);
        onParseAttemptFailed?.();
        recordFailure?.('missing_scene_description', 'Storyteller response must include a non-empty "sceneDescription" field.');
        return null;
    }

    const isOptionalString = (value: unknown): boolean => value == null || typeof value === 'string';
    const isOptionalBoolean = (value: unknown): boolean => value == null || typeof value === 'boolean';
    const isOptionalArray = (value: unknown): boolean => value == null || Array.isArray(value);
    const isOptionalObject = (value: unknown): boolean => value == null || typeof value === 'object';

    const baseFieldsValid =
        isOptionalString(data.mainQuest) &&
        isOptionalString(data.currentObjective) &&
        isOptionalString(data.logMessage) &&
        isOptionalArray(data.npcsAdded) &&
        isOptionalArray(data.npcsUpdated) &&
        isOptionalBoolean(data.objectiveAchieved) &&
        isOptionalBoolean(data.mainQuestAchieved) &&
        isOptionalString(data.localTime) &&
        isOptionalString(data.localEnvironment) &&
        isOptionalString(data.localPlace) &&
        isOptionalObject(data.dialogueSetup) &&
        isOptionalBoolean(data.mapUpdated) &&
        isOptionalString(data.currentMapNodeId) &&
        isOptionalString(data.mapHint) &&
        isOptionalString(data.playerItemsHint) &&
        isOptionalString(data.worldItemsHint) &&
        isOptionalString(data.npcItemsHint) &&
        isOptionalString(data.librarianHint) &&
        isOptionalArray(data.newItems);

    if (!baseFieldsValid) {
        console.warn('parseAIResponse: Basic field validation failed (pre-dialogue specifics and array checks).', parsedData);
        onParseAttemptFailed?.();
        recordFailure?.('invalid_base_fields', 'Storyteller response contained invalid or mistyped base fields. Ensure optional arrays and strings use the correct types.');
        return null;
    }

    const sanitized = coerceNullToUndefined(data);
    return sanitized as Partial<GameStateFromAI>;
}

/**
 * Handles dialogue setup validation and correction logic.
 */
async function handleDialogueSetup(
    data: Partial<GameStateFromAI>,
    context: ParserContext
): Promise<DialogueResult | null> {
    let dialogueSetup = data.dialogueSetup;
    let options: Array<unknown> = Array.isArray(data.options) ? data.options : [];
    let isDialogueTurn = false;

    if (dialogueSetup) {
        let dialogueSetupIsValid = isDialogueSetupPayloadStructurallyValid(dialogueSetup);
        if (!dialogueSetupIsValid) {
            console.warn("parseAIResponse: 'dialogueSetup' is present but malformed. Attempting correction.");
            const npcDialogueContext = collectNPCsForDialogueContext(data, context);
            const correctedDialogueSetup = await fetchCorrectedDialogueSetup_Service(
                context.logMessageFromPayload ?? data.logMessage,
                context.sceneDescriptionFromPayload ?? data.sceneDescription,
                context.theme,
                npcDialogueContext,
                context.allRelevantMainMapNodesForCorrection,
                context.currentInventoryForCorrection,
                context.heroGender,
                dialogueSetup
            );

            if (correctedDialogueSetup && isDialogueSetupPayloadStructurallyValid(correctedDialogueSetup)) {
                dialogueSetup = correctedDialogueSetup;
                dialogueSetupIsValid = true;
                console.log("parseAIResponse: Successfully corrected 'dialogueSetup'.");
            } else {
                console.warn("parseAIResponse: Failed to correct 'dialogueSetup' or corrected version is still invalid. Discarding dialogue attempt.");
                dialogueSetup = undefined;
                dialogueSetupIsValid = false;
            }
        }
        isDialogueTurn = dialogueSetupIsValid && !!dialogueSetup;
        if (isDialogueTurn) {
            options = [];
        }
    }

    if (!isDialogueTurn) {
        dialogueSetup = undefined;
        if (!Array.isArray(options) || !options.every(opt => typeof opt === 'string')) {
            console.warn('parseAIResponse: options are missing or invalid (must be array of strings) when not in dialogue.', data);
            context.onParseAttemptFailed?.();
            context.recordFailure?.('invalid_options', 'Storyteller response must provide six distinct action options when not initiating dialogue.');
            return null;
        }
    }

    return { dialogueSetup, options: options as Array<string>, isDialogueTurn };
}


/**
 * Handles NPC additions and updates validation/correction logic.
 */
async function handleNPCChanges(
    rawAdded: unknown,
    rawUpdated: unknown,
    baseData: Partial<GameStateFromAI>,
    context: ParserContext
): Promise<{ npcsAdded: Array<NPC>; npcsUpdated: Array<ValidNPCUpdatePayload> }> {
    const finalNPCsAdded: Array<NPC> = [];
    const finalNPCUpdateInstructions: Array<ValidNPCUpdatePayload> = [];
    const addedIndexByName = new Map<string, number>();
    const baseKnownNames = new Set(context.allRelevantNPCs.map(npc => npc.name));
    const knownNamesForCorrection = new Set(baseKnownNames);
    const knownNPCsForLookup: Array<NPC> = [...context.allRelevantNPCs];

    const registerAddedNPC = (npc: NPC): void => {
        const normalized = ensurePresenceConsistency(npc);
        const existingIndex = addedIndexByName.get(normalized.name);
        if (existingIndex === undefined) {
            addedIndexByName.set(normalized.name, finalNPCsAdded.length);
            finalNPCsAdded.push(normalized);
            knownNPCsForLookup.push(normalized);
        } else {
            const existing = finalNPCsAdded[existingIndex];
            const merged = ensurePresenceConsistency({
                ...existing,
                ...normalized,
                aliases: mergeUniqueStrings(existing.aliases, normalized.aliases),
                knowsPlayerAs: mergeUniqueStrings(existing.knowsPlayerAs, normalized.knowsPlayerAs),
            });
            finalNPCsAdded[existingIndex] = merged;
            const lookupIndex = knownNPCsForLookup.findIndex(npcInLookup => npcInLookup.name === merged.name);
            if (lookupIndex >= 0) {
                knownNPCsForLookup[lookupIndex] = merged;
            } else {
                knownNPCsForLookup.push(merged);
            }
        }
        knownNamesForCorrection.add(normalized.name);
    };

    if (Array.isArray(rawAdded)) {
        for (const originalNPCAdd of rawAdded) {
            const originalName =
                typeof originalNPCAdd === 'object' &&
                originalNPCAdd !== null &&
                'name' in originalNPCAdd &&
                typeof (originalNPCAdd as { name?: unknown }).name === 'string'
                    ? ((originalNPCAdd as { name?: string }).name ?? undefined)
                    : undefined;

            const payload = toValidNewNPCPayload(originalNPCAdd);
            if (payload) {
                registerAddedNPC(createNPCFromNewPayload(payload));
                continue;
            }

            console.warn(`parseAIResponse ('npcsAdded'): Invalid NPC structure for "${originalName ?? 'Unknown Name'}". Attempting correction.`);
            const correctedNPC = await attemptCorrectNPCAdd(originalName, baseData, context);
            if (correctedNPC) {
                registerAddedNPC(correctedNPC);
                console.log(`parseAIResponse ('npcsAdded'): Successfully corrected NPC:`, correctedNPC.name);
            } else {
                console.warn(`parseAIResponse ('npcsAdded'): Failed to correct NPC "${originalName ?? 'Unknown Name'}". Discarding.`);
            }
        }
    } else if (rawAdded !== undefined) {
        console.warn("parseAIResponse ('npcsAdded'): Field was present but not an array.", rawAdded);
    }

    const rawNPCUpdates: Array<unknown> = Array.isArray(rawUpdated) ? rawUpdated : [];
    const tempFinalNPCsUpdatedPayloads: Array<ValidNPCUpdatePayload> = [];

    for (const npcUpdate of rawNPCUpdates) {
        const normalizedUpdate = await normalizeNPCUpdateCandidate(
            npcUpdate,
            knownNPCsForLookup,
            knownNamesForCorrection,
            baseData,
            context,
        );
        if (normalizedUpdate) {
            tempFinalNPCsUpdatedPayloads.push(normalizedUpdate);
            knownNamesForCorrection.add(normalizedUpdate.name);
        }
    }

    for (const npcUpdatePayload of tempFinalNPCsUpdatedPayloads) {
        const targetName = npcUpdatePayload.name;
        const indexInAdded = addedIndexByName.get(targetName);

        if (baseKnownNames.has(targetName)) {
            finalNPCUpdateInstructions.push(npcUpdatePayload);
            continue;
        }

        if (indexInAdded !== undefined) {
            finalNPCUpdateInstructions.push(npcUpdatePayload);
            const updatedNPC = applyNPCUpdateToExisting(
                finalNPCsAdded[indexInAdded],
                npcUpdatePayload,
            );
            finalNPCsAdded[indexInAdded] = updatedNPC;
            const lookupIndex = knownNPCsForLookup.findIndex(npc => npc.name === targetName);
            if (lookupIndex >= 0) {
                knownNPCsForLookup[lookupIndex] = updatedNPC;
            } else {
                knownNPCsForLookup.push(updatedNPC);
            }
            continue;
        }

        console.warn(`parseAIResponse ('npcsUpdated'): Target NPC "${targetName}" for update not found. Converting to an add operation.`);
        const newNPCFromUpdate = await buildNPCFromUpdateAsAddition(
            npcUpdatePayload,
            baseData,
            context,
        );
        registerAddedNPC(newNPCFromUpdate);
    }

    return { npcsAdded: finalNPCsAdded, npcsUpdated: finalNPCUpdateInstructions };
}

/**
 * Parses the AI's JSON response and composes helper validations.
 */
export async function parseAIResponse(
    responseText: string,
    theme: AdventureTheme,
    heroSheet: HeroSheet | null,
    onParseAttemptFailed?: () => void,
    logMessageFromPayload?: string,
    sceneDescriptionFromPayload?: string,
    allRelevantNPCs: Array<NPC> = [],
    mapDataForResponse: MapData = { nodes: [], edges: [] },
    currentInventoryForCorrection: Array<Item> = []
): Promise<ParseAIResponseResult> {
    const jsonStr = responseText;

    const allRelevantMainMapNodesForCorrection: Array<MapNode> = mapDataForResponse.nodes.filter(node => node.data.nodeType !== 'feature');

    let failureReason: ParseFailureReason | null = null;
    let failureMessage: string | null = null;
    const recordFailure: RecordParseFailure = (reason, message) => {
        if (failureReason === null) {
            failureReason = reason;
            failureMessage = message;
        }
    };

    const buildFailureResult = (fallbackReason: ParseFailureReason, fallbackMessage: string): ParseAIResponseResult => ({
        data: null,
        reason: failureReason ?? fallbackReason,
        error: failureMessage ?? fallbackMessage,
    });

    try {
        const parsedData = safeParseJson<Partial<GameStateFromAI>>(jsonStr);
        if (parsedData === null) {
            recordFailure('json_parse_failed', 'Storyteller response could not be parsed as JSON.');
            throw new Error('JSON parse failed');
        }

        const validated = validateBasicStructure(parsedData, onParseAttemptFailed, recordFailure);
        if (!validated) return buildFailureResult('invalid_base_fields', 'Storyteller response failed base validation.');

        const context: ParserContext = {
            heroGender: heroSheet?.gender ?? 'Male',
            theme,
            onParseAttemptFailed,
            logMessageFromPayload,
            sceneDescriptionFromPayload,
            allRelevantNPCs: allRelevantNPCs,
            allRelevantMainMapNodesForCorrection,
            currentInventoryForCorrection,
            recordFailure,
        };

        const dialogueResult = await handleDialogueSetup(validated, context);
        if (!dialogueResult) return buildFailureResult('invalid_options', 'Storyteller response must include valid action options when dialogue is not triggered.');

        validated.dialogueSetup = dialogueResult.dialogueSetup;
        validated.options = dialogueResult.options;
        let isDialogueTurn = dialogueResult.isDialogueTurn;

        validated.itemChange = [];

        const npcResult = await handleNPCChanges(validated.npcsAdded, validated.npcsUpdated, validated, context);
        validated.npcsAdded = npcResult.npcsAdded;
        validated.npcsUpdated = npcResult.npcsUpdated;

        if (isDialogueTurn && validated.dialogueSetup) {
            const availableNPCObjectsThisTurn: Array<NPC> = [
                ...allRelevantNPCs,
                ...((validated.npcsAdded ?? []) as Array<NPC>),
            ];
            const availableNPCNamesThisTurn = new Set([
                ...availableNPCObjectsThisTurn.map(npc => npc.name),
                ...validated.npcsUpdated.map(npcUpd => npcUpd.name),
            ]);

            const finalValidParticipants: Array<string> = [];
            for (const participant of validated.dialogueSetup.participants) {
                const matchedNPC = findNPCByIdentifier(
                    participant,
                    availableNPCObjectsThisTurn,
                ) as NPC | undefined;
                if (matchedNPC) {
                    finalValidParticipants.push(matchedNPC.name);
                } else if (availableNPCNamesThisTurn.has(participant)) {
                    finalValidParticipants.push(participant);
                } else {
                    console.warn(
                        `parseAIResponse: Dialogue participant "${participant}" is not among known or newly added/updated NPCs. Attempting name correction against this turn's NPCs.`,
                    );
                    const correctedParticipantName = await fetchCorrectedName_Service(
                        'dialogue participant',
                        participant,
                        logMessageFromPayload ?? validated.logMessage,
                        sceneDescriptionFromPayload ?? validated.sceneDescription,
                        Array.from(availableNPCNamesThisTurn),
                        theme,
                    );
                    if (
                        correctedParticipantName &&
                        availableNPCNamesThisTurn.has(correctedParticipantName)
                    ) {
                        finalValidParticipants.push(correctedParticipantName);
                        console.log(
                            `parseAIResponse: Corrected dialogue participant name from "${participant}" to "${correctedParticipantName}".`,
                        );
                    } else {
                        console.warn(
                            `parseAIResponse: Dialogue participant "${participant}" could not be validated/corrected against this turn's NPCs. Discarding participant.`,
                        );
                    }
                }
            }

            if (finalValidParticipants.length === 0 && validated.dialogueSetup.participants.length > 0) {
                console.warn('parseAIResponse: No valid dialogue participants remain after final name validation. Discarding dialogue attempt.');
                validated.dialogueSetup = undefined;
                isDialogueTurn = false;
                if (!Array.isArray(validated.options) || validated.options.length === 0 || !validated.options.every((opt: unknown) => typeof opt === 'string' && opt.trim() !== '')) {
                    console.warn('parseAIResponse: options invalid after dialogue cancellation. Resetting to default failsafe.', validated.options);
                    validated.options = ['Look around.', 'Ponder the situation.', 'Check inventory.', 'Try to move on.', 'Consider your objective.', 'Plan your next steps.'];
                }
            } else {
                validated.dialogueSetup.participants = finalValidParticipants;
            }
        }

        if (!isDialogueTurn) {
            if (!Array.isArray(validated.options) || validated.options.length === 0 || !validated.options.every((opt: unknown) => typeof opt === 'string' && opt.trim() !== '')) {
                console.warn('parseAIResponse: options are missing, empty, or invalid when not inDialogue (final check).', validated.options);
                onParseAttemptFailed?.();
                recordFailure('invalid_options', 'Storyteller response must provide six distinct action options when not initiating dialogue.');
                return buildFailureResult('invalid_options', 'Storyteller response must provide six distinct action options when not initiating dialogue.');
            }
            while (validated.options.length < MAIN_TURN_OPTIONS_COUNT) validated.options.push('...');
            if (validated.options.length > MAIN_TURN_OPTIONS_COUNT) validated.options = validated.options.slice(0, MAIN_TURN_OPTIONS_COUNT);
        } else {
            validated.options = [];
        }

        validated.objectiveAchieved = validated.objectiveAchieved ?? false;
        validated.mainQuestAchieved = validated.mainQuestAchieved ?? false;
        validated.localTime = validated.localTime?.trim() ?? 'Time Unknown';
        validated.localEnvironment = validated.localEnvironment?.trim() ?? 'Environment Undetermined';
        validated.localPlace = validated.localPlace?.trim() ?? 'Undetermined Location';
        trimDialogueHints(validated);

        delete (validated as Record<string, unknown>).placesAdded;
        delete (validated as Record<string, unknown>).placesUpdated;

        return { data: validated as GameStateFromAI, error: null, reason: null };

    } catch (e: unknown) {
        console.warn('parseAIResponse: Failed to parse JSON response from AI. This attempt will be considered a failure.', e);
        console.debug('parseAIResponse: Original response text (before any processing):', responseText);
        console.debug('parseAIResponse: JSON string after fence stripping (if any, input to JSON.parse):', jsonStr);
        onParseAttemptFailed?.();
        recordFailure('json_parse_failed', 'Storyteller response could not be parsed as JSON.');
        return buildFailureResult('unknown', 'Storyteller response failed due to an unknown parsing error.');
    }
}






