/**
 * @file responseParser.ts
 * @description Utilities for validating and parsing AI storyteller responses.
 */

import { GameStateFromAI, Item, NPC, MapData,
    ValidNPCUpdatePayload, ValidNewNPCPayload as ValidNewNPCPayload, DialogueSetupPayload,
    MapNode, AdventureTheme } from '../../types';
import { MAIN_TURN_OPTIONS_COUNT } from '../../constants';
import {
    isValidNPCUpdate,
    isValidNewNPCPayload as isValidNewNPCPayload,
    isDialogueSetupPayloadStructurallyValid
} from '../parsers/validation';
import { trimDialogueHints } from '../../utils/dialogueParsing';
import {
    fetchCorrectedName_Service,
    fetchCorrectedNPCDetails_Service,
    fetchCorrectedDialogueSetup_Service,
} from '../corrections';

import {
    extractJsonFromFence,
    safeParseJson,
    coerceNullToUndefined,
} from '../../utils/jsonUtils';
import { buildNPCId as buildNPCId } from '../../utils/entityUtils';

/** Interface describing contextual data required by the parsing helpers. */
interface ParserContext {
    playerGender: string;
    currentTheme: AdventureTheme;
    onParseAttemptFailed?: () => void;
    logMessageFromPayload?: string;
    sceneDescriptionFromPayload?: string;
    allRelevantNPCs: Array<NPC>;
    allRelevantMainMapNodesForCorrection: Array<MapNode>;
    currentInventoryForCorrection: Array<Item>;
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
    onParseAttemptFailed?: () => void
): Partial<GameStateFromAI> | null {
    if (!parsedData || typeof parsedData !== 'object') {
        console.warn('parseAIResponse: Parsed data is not a valid object.', parsedData);
        onParseAttemptFailed?.();
        return null;
    }

    const data = parsedData as Record<string, unknown>;
    if (typeof data.sceneDescription !== 'string' || data.sceneDescription.trim() === '') {
        console.warn('parseAIResponse: sceneDescription is missing or empty.', parsedData);
        onParseAttemptFailed?.();
        return null;
    }

    const baseFieldsValid =
        (data.mainQuest === undefined || data.mainQuest === null || typeof data.mainQuest === 'string') &&
        (data.currentObjective === undefined || data.currentObjective === null || typeof data.currentObjective === 'string') &&
        (data.logMessage === undefined || data.logMessage === null || typeof data.logMessage === 'string') &&
        (data.npcsAdded === undefined || data.npcsAdded === null || Array.isArray(data.npcsAdded)) &&
        (data.npcsUpdated === undefined || data.npcsUpdated === null || Array.isArray(data.npcsUpdated)) &&
        (data.objectiveAchieved === undefined || data.objectiveAchieved === null || typeof data.objectiveAchieved === 'boolean') &&
        (data.localTime === undefined || data.localTime === null || typeof data.localTime === 'string') &&
        (data.localEnvironment === undefined || data.localEnvironment === null || typeof data.localEnvironment === 'string') &&
        (data.localPlace === undefined || data.localPlace === null || typeof data.localPlace === 'string') &&
        (data.dialogueSetup === undefined || data.dialogueSetup === null || typeof data.dialogueSetup === 'object') &&
        (data.mapUpdated === undefined || data.mapUpdated === null || typeof data.mapUpdated === 'boolean') &&
        (data.currentMapNodeId === undefined || data.currentMapNodeId === null || typeof data.currentMapNodeId === 'string') &&
        (data.mapHint === undefined || data.mapHint === null || typeof data.mapHint === 'string') &&
        (data.playerItemsHint === undefined || data.playerItemsHint === null || typeof data.playerItemsHint === 'string') &&
        (data.worldItemsHint === undefined || data.worldItemsHint === null || typeof data.worldItemsHint === 'string') &&
        (data.npcItemsHint === undefined || data.npcItemsHint === null || typeof data.npcItemsHint === 'string') &&
        (data.newItems === undefined || data.newItems === null || Array.isArray(data.newItems));

    if (!baseFieldsValid) {
        console.warn('parseAIResponse: Basic field validation failed (pre-dialogue specifics and array checks).', parsedData);
        onParseAttemptFailed?.();
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
            const NPCsForDialogueContext: Array<NPC> = [...context.allRelevantNPCs];
              (data.npcsAdded ?? []).forEach(npcAdd => {
                if (isValidNewNPCPayload(npcAdd)) {
                    NPCsForDialogueContext.push({
                        ...npcAdd,
                        id: buildNPCId(npcAdd.name),
                        themeName: '',
                          presenceStatus: npcAdd.presenceStatus ?? 'unknown',
                          lastKnownLocation: npcAdd.lastKnownLocation ?? null,
                          preciseLocation: npcAdd.preciseLocation ?? null,
                    } as NPC);
                }
            });
              (data.npcsUpdated ?? []).forEach(npcUpd => {
                if (isValidNPCUpdate(npcUpd)) {
                    const existing = context.allRelevantNPCs.find(ex => ex.name === npcUpd.name);
                    NPCsForDialogueContext.push({
                        id: buildNPCId(npcUpd.name),
                        name: npcUpd.name,
                          description: npcUpd.newDescription ?? existing?.description ?? 'Updated NPC',
                          aliases: npcUpd.newAliases ?? existing?.aliases ?? [],
                        themeName: '',
                          presenceStatus: npcUpd.newPresenceStatus ?? existing?.presenceStatus ?? 'unknown',
                          lastKnownLocation: npcUpd.newLastKnownLocation ?? (existing?.lastKnownLocation ?? null),
                          preciseLocation: npcUpd.newPreciseLocation ?? (existing?.preciseLocation ?? null),
                    } as NPC);
                }
            });

            const correctedDialogueSetup = await fetchCorrectedDialogueSetup_Service(
                context.logMessageFromPayload ?? data.logMessage,
                context.sceneDescriptionFromPayload ?? data.sceneDescription,
                context.currentTheme,
                NPCsForDialogueContext,
                context.allRelevantMainMapNodesForCorrection,
                context.currentInventoryForCorrection,
                context.playerGender,
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
    if (Array.isArray(rawAdded)) {
        for (const originalNPCAdd of rawAdded) {
            const originalName = (typeof originalNPCAdd === 'object' && originalNPCAdd !== null && 'name' in originalNPCAdd)
                ? (originalNPCAdd as { name?: unknown }).name as string | undefined
                : undefined;
            if (isValidNewNPCPayload(originalNPCAdd)) {
                finalNPCsAdded.push({
                    ...(originalNPCAdd as NPC),
                    id: buildNPCId(originalNPCAdd.name),
                    presenceStatus: originalNPCAdd.presenceStatus ?? 'unknown',
                    lastKnownLocation: originalNPCAdd.lastKnownLocation ?? null,
                    preciseLocation: originalNPCAdd.preciseLocation ?? null,
                    themeName: '',
                });
            } else {
                console.warn(`parseAIResponse ('npcsAdded'): Invalid NPC structure for "${originalName ?? 'Unknown Name'}". Attempting correction.`);
                const correctedDetails = await fetchCorrectedNPCDetails_Service(
                    originalName ?? 'Newly Mentioned NPC',
                    context.logMessageFromPayload ?? baseData.logMessage,
                    context.sceneDescriptionFromPayload ?? baseData.sceneDescription,
                    context.currentTheme,
                    context.allRelevantMainMapNodesForCorrection
                );
                if (correctedDetails) {
                    const fallbackName = correctedDetails.description.split(' ').slice(0, 2).join(' ') || 'Corrected NPC';
                    const correctedNPCAddPayload: ValidNewNPCPayload = {
                        name: originalName ?? fallbackName,
                        description: correctedDetails.description,
                        aliases: correctedDetails.aliases,
                        presenceStatus: correctedDetails.presenceStatus,
                        lastKnownLocation: correctedDetails.lastKnownLocation,
                        preciseLocation: correctedDetails.preciseLocation,
                    };
                    if (isValidNewNPCPayload(correctedNPCAddPayload)) {
                        finalNPCsAdded.push({ ...correctedNPCAddPayload, id: buildNPCId(correctedNPCAddPayload.name), themeName: '' } as NPC);
                        console.log(`parseAIResponse ('npcsAdded'): Successfully corrected NPC:`, correctedNPCAddPayload.name);
                    } else {
                        console.warn(`parseAIResponse ('npcsAdded'): Corrected NPC "${originalName ?? 'Unknown Name'}" still invalid. Discarding. Corrected Data:`, correctedNPCAddPayload);
                    }
                } else {
                    console.warn(`parseAIResponse ('npcsAdded'): Failed to correct NPC "${originalName ?? 'Unknown Name'}". Discarding.`);
                }
            }
        }
    } else if (rawAdded !== undefined) {
        console.warn("parseAIResponse ('npcsAdded'): Field was present but not an array.", rawAdded);
    }

    const rawNPCUpdates: Array<unknown> = Array.isArray(rawUpdated) ? rawUpdated : [];
    const tempFinalNPCsUpdatedPayloads: Array<ValidNPCUpdatePayload> = [];

    for (const npcUpdate of rawNPCUpdates) {
        if (
            typeof npcUpdate === 'object' &&
            npcUpdate !== null &&
            'name' in npcUpdate &&
            typeof (npcUpdate as { name?: unknown }).name === 'string' &&
            (npcUpdate as { name: string }).name.trim() !== ''
        ) {
            const currentNPCUpdatePayload: { [key: string]: unknown; name: string } = {
                ...(npcUpdate as Record<string, unknown>),
                name: (npcUpdate as { name: string }).name,
            };
            const payloadNameForLogs = currentNPCUpdatePayload.name;
            const allKnownAndCurrentlyAddedNPCNames = new Set([
                ...context.allRelevantNPCs.map(npc => npc.name),
                ...finalNPCsAdded.map(npc => npc.name),
            ]);

            if (!allKnownAndCurrentlyAddedNPCNames.has(currentNPCUpdatePayload.name)) {
                console.warn(`parseAIResponse ('npcsUpdated'): Original target name "${payloadNameForLogs}" not found. Attempting name correction.`);
                const correctedName = await fetchCorrectedName_Service(
                    'NPC name',
                    currentNPCUpdatePayload.name,
                    context.logMessageFromPayload ?? baseData.logMessage,
                    context.sceneDescriptionFromPayload ?? baseData.sceneDescription,
                    Array.from(allKnownAndCurrentlyAddedNPCNames),
                    context.currentTheme
                );
                if (correctedName && correctedName.trim() !== '') {
                    currentNPCUpdatePayload.name = correctedName;
                    console.log(`parseAIResponse ('npcsUpdated'): Corrected target name to "${correctedName}".`);
                } else {
                    console.warn(`parseAIResponse ('npcsUpdated'): Failed to correct target name for "${payloadNameForLogs}". Will attempt to process as is, may convert to 'add'.`);
                }
            }

            if (isValidNPCUpdate(currentNPCUpdatePayload)) {
                tempFinalNPCsUpdatedPayloads.push(currentNPCUpdatePayload);
            } else {
                console.warn(`parseAIResponse ('npcsUpdated'): Payload for "${payloadNameForLogs}" is invalid after potential name correction. Discarding. Payload:`, currentNPCUpdatePayload);
            }
        } else {
            console.warn("parseAIResponse ('npcsUpdated'): Update missing or has invalid 'name'. Discarding.", npcUpdate);
        }
    }

    const finalNPCUpdateInstructions: Array<ValidNPCUpdatePayload> = [];
    for (const npcUpdatePayload of tempFinalNPCsUpdatedPayloads) {
        const targetName = npcUpdatePayload.name;
        const isAlreadyKnownFromPreviousTurns = context.allRelevantNPCs.some(npc => npc.name === targetName);
        const npcAddedThisTurnIndex = finalNPCsAdded.findIndex(npcAdded => npcAdded.name === targetName);
        const isBeingAddedThisTurn = npcAddedThisTurnIndex !== -1;

        if (isAlreadyKnownFromPreviousTurns || isBeingAddedThisTurn) {
            finalNPCUpdateInstructions.push(npcUpdatePayload);
            if (isBeingAddedThisTurn) {
                const npcInAddedList = finalNPCsAdded[npcAddedThisTurnIndex];
                if (npcUpdatePayload.newDescription !== undefined) npcInAddedList.description = npcUpdatePayload.newDescription;
                if (npcUpdatePayload.newAliases !== undefined) npcInAddedList.aliases = npcUpdatePayload.newAliases;
                if (npcUpdatePayload.addAlias) npcInAddedList.aliases = Array.from(new Set([...(npcInAddedList.aliases ?? []), npcUpdatePayload.addAlias]));
                if (npcUpdatePayload.newPresenceStatus !== undefined) npcInAddedList.presenceStatus = npcUpdatePayload.newPresenceStatus;
                if (npcUpdatePayload.newLastKnownLocation !== undefined) npcInAddedList.lastKnownLocation = npcUpdatePayload.newLastKnownLocation;
                if (npcUpdatePayload.newPreciseLocation !== undefined) npcInAddedList.preciseLocation = npcUpdatePayload.newPreciseLocation;

                if (npcInAddedList.presenceStatus === 'distant' || npcInAddedList.presenceStatus === 'unknown') {
                    npcInAddedList.preciseLocation = null;
                } else {
                    npcInAddedList.preciseLocation ??= npcInAddedList.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
                }
                finalNPCsAdded[npcAddedThisTurnIndex] = npcInAddedList;
            }
        } else {
            console.warn(`parseAIResponse ('npcsUpdated'): Target NPC "${targetName}" for update not found. Converting to an add operation.`);

                const newNPCDataFromUpdate: NPC = {
                    id: buildNPCId(targetName),
                    name: targetName,
                    description: npcUpdatePayload.newDescription ?? `Details for ${targetName} are emerging.`,
                    aliases: npcUpdatePayload.newAliases ?? (npcUpdatePayload.addAlias ? [npcUpdatePayload.addAlias] : []),
                    themeName: '',
                    presenceStatus: npcUpdatePayload.newPresenceStatus ?? 'unknown',
                    lastKnownLocation: npcUpdatePayload.newLastKnownLocation ?? null,
                    preciseLocation: npcUpdatePayload.newPreciseLocation ?? null,
                };

            if (newNPCDataFromUpdate.description === `Details for ${targetName} are emerging.`) {
                    const correctedDetails = await fetchCorrectedNPCDetails_Service(
                      targetName,
                      context.logMessageFromPayload ?? baseData.logMessage,
                      context.sceneDescriptionFromPayload ?? baseData.sceneDescription,
                    context.currentTheme,
                    context.allRelevantMainMapNodesForCorrection
                );
                if (correctedDetails) {
                    newNPCDataFromUpdate.description = correctedDetails.description;
                    newNPCDataFromUpdate.aliases = Array.from(
                        new Set([...(newNPCDataFromUpdate.aliases ?? []), ...correctedDetails.aliases])
                    );
                    newNPCDataFromUpdate.presenceStatus = correctedDetails.presenceStatus;
                    newNPCDataFromUpdate.lastKnownLocation = correctedDetails.lastKnownLocation;
                    newNPCDataFromUpdate.preciseLocation = correctedDetails.preciseLocation;
                }
            }

            if (newNPCDataFromUpdate.presenceStatus === 'distant' || newNPCDataFromUpdate.presenceStatus === 'unknown') {
                newNPCDataFromUpdate.preciseLocation = null;
            } else {
                newNPCDataFromUpdate.preciseLocation ??= newNPCDataFromUpdate.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
            }

            const existingIndexInAdded = finalNPCsAdded.findIndex(npc => npc.name === newNPCDataFromUpdate.name);
            if (existingIndexInAdded === -1) {
                finalNPCsAdded.push(newNPCDataFromUpdate);
            } else {
                finalNPCsAdded[existingIndexInAdded] = { ...finalNPCsAdded[existingIndexInAdded], ...newNPCDataFromUpdate };
            }
        }
    }

    return { npcsAdded: finalNPCsAdded, npcsUpdated: finalNPCUpdateInstructions };
}

/**
 * Parses the AI's JSON response and composes helper validations.
 */
export async function parseAIResponse(
    responseText: string,
    playerGender: string,
    currentTheme: AdventureTheme,
    onParseAttemptFailed?: () => void,
    logMessageFromPayload?: string,
    sceneDescriptionFromPayload?: string,
    allRelevantNPCs: Array<NPC> = [],
    currentThemeMapData: MapData = { nodes: [], edges: [] },
    currentInventoryForCorrection: Array<Item> = []
): Promise<GameStateFromAI | null> {
    const jsonStr = extractJsonFromFence(responseText);

    const allRelevantMainMapNodesForCorrection: Array<MapNode> = currentThemeMapData.nodes.filter(node => node.data.nodeType !== 'feature');

    try {
        const parsedData = safeParseJson<Partial<GameStateFromAI>>(jsonStr);
        if (parsedData === null) throw new Error('JSON parse failed');

        const validated = validateBasicStructure(parsedData, onParseAttemptFailed);
        if (!validated) return null;

        const context: ParserContext = {
            playerGender,
            currentTheme,
            onParseAttemptFailed,
            logMessageFromPayload,
            sceneDescriptionFromPayload,
            allRelevantNPCs: allRelevantNPCs,
            allRelevantMainMapNodesForCorrection,
            currentInventoryForCorrection,
        };

        const dialogueResult = await handleDialogueSetup(validated, context);
        if (!dialogueResult) return null;

        validated.dialogueSetup = dialogueResult.dialogueSetup;
        validated.options = dialogueResult.options;
        let isDialogueTurn = dialogueResult.isDialogueTurn;

        validated.itemChange = [];

        const npcResult = await handleNPCChanges(validated.npcsAdded, validated.npcsUpdated, validated, context);
        validated.npcsAdded = npcResult.npcsAdded;
        validated.npcsUpdated = npcResult.npcsUpdated;

        if (isDialogueTurn && validated.dialogueSetup) {
            const allAvailableNPCNamesThisTurn = new Set([
                ...allRelevantNPCs.map(npc => npc.name),
                ...validated.npcsAdded.map(npc => npc.name),
                ...validated.npcsUpdated.map(npcUpd => npcUpd.name)
            ]);

            const finalValidParticipants: Array<string> = [];
            for (const participant of validated.dialogueSetup.participants) {
                if (allAvailableNPCNamesThisTurn.has(participant)) {
                    finalValidParticipants.push(participant);
                } else {
                    console.warn(`parseAIResponse: Dialogue participant "${participant}" is not among known or newly added/updated NPCs. Attempting name correction against this turn's NPCs.`);
                    const correctedParticipantName = await fetchCorrectedName_Service(
                        'dialogue participant',
                        participant,
                        logMessageFromPayload ?? validated.logMessage,
                        sceneDescriptionFromPayload ?? validated.sceneDescription,
                        Array.from(allAvailableNPCNamesThisTurn),
                        currentTheme
                    );
                    if (correctedParticipantName && allAvailableNPCNamesThisTurn.has(correctedParticipantName)) {
                        finalValidParticipants.push(correctedParticipantName);
                        console.log(`parseAIResponse: Corrected dialogue participant name from "${participant}" to "${correctedParticipantName}".`);
                    } else {
                        console.warn(`parseAIResponse: Dialogue participant "${participant}" could not be validated/corrected against this turn's NPCs. Discarding participant.`);
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
                return null;
            }
            while (validated.options.length < MAIN_TURN_OPTIONS_COUNT) validated.options.push('...');
            if (validated.options.length > MAIN_TURN_OPTIONS_COUNT) validated.options = validated.options.slice(0, MAIN_TURN_OPTIONS_COUNT);
        } else {
            validated.options = [];
        }

        validated.objectiveAchieved = validated.objectiveAchieved ?? false;
        validated.localTime = validated.localTime?.trim() ?? 'Time Unknown';
        validated.localEnvironment = validated.localEnvironment?.trim() ?? 'Environment Undetermined';
        validated.localPlace = validated.localPlace?.trim() ?? 'Undetermined Location';
        trimDialogueHints(validated);

        delete (validated as Record<string, unknown>).placesAdded;
        delete (validated as Record<string, unknown>).placesUpdated;

        return validated as GameStateFromAI;

    } catch (e: unknown) {
        console.warn('parseAIResponse: Failed to parse JSON response from AI. This attempt will be considered a failure.', e);
        console.debug('parseAIResponse: Original response text (before any processing):', responseText);
        console.debug('parseAIResponse: JSON string after fence stripping (if any, input to JSON.parse):', jsonStr);
        onParseAttemptFailed?.();
        return null;
    }
}
