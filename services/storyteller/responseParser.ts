/**
 * @file responseParser.ts
 * @description Utilities for validating and parsing AI storyteller responses.
 */

import { GameStateFromAI, Item, Character, MapData,
    ValidCharacterUpdatePayload, ValidNewCharacterPayload, DialogueSetupPayload,
    MapNode, AdventureTheme } from '../../types';
import { MAIN_TURN_OPTIONS_COUNT } from '../../constants';
import {
    isValidCharacterUpdate,
    isValidNewCharacterPayload,
    isDialogueSetupPayloadStructurallyValid,
    isValidNewItemSuggestion
} from '../parsers/validation';
import {
    fetchCorrectedName_Service,
    fetchCorrectedCharacterDetails_Service,
    fetchCorrectedDialogueSetup_Service,
} from '../corrections';

import {
    extractJsonFromFence,
    safeParseJson,
    coerceNullToUndefined,
} from '../../utils/jsonUtils';
import { buildCharacterId } from '../../utils/entityUtils';

/** Interface describing contextual data required by the parsing helpers. */
interface ParserContext {
    playerGender: string;
    currentTheme: AdventureTheme;
    onParseAttemptFailed?: () => void;
    logMessageFromPayload?: string;
    sceneDescriptionFromPayload?: string;
    allRelevantCharacters: Character[];
    allRelevantMainMapNodesForCorrection: MapNode[];
    currentInventoryForCorrection: Item[];
}

/** Result object returned from the dialogue setup handler. */
interface DialogueResult {
    dialogueSetup?: DialogueSetupPayload;
    options: string[];
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
        (data.charactersAdded === undefined || data.charactersAdded === null || Array.isArray(data.charactersAdded)) &&
        (data.charactersUpdated === undefined || data.charactersUpdated === null || Array.isArray(data.charactersUpdated)) &&
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
    let options: unknown[] = Array.isArray(data.options) ? data.options : [];
    let isDialogueTurn = false;

    if (dialogueSetup) {
        let dialogueSetupIsValid = isDialogueSetupPayloadStructurallyValid(dialogueSetup);
        if (!dialogueSetupIsValid) {
            console.warn("parseAIResponse: 'dialogueSetup' is present but malformed. Attempting correction.");
            const charactersForDialogueContext: Character[] = [...context.allRelevantCharacters];
            (data.charactersAdded || []).forEach(cAdd => {
                if (isValidNewCharacterPayload(cAdd)) {
                    charactersForDialogueContext.push({
                        ...cAdd,
                        id: buildCharacterId(cAdd.name),
                        themeName: '',
                        presenceStatus: cAdd.presenceStatus || 'unknown',
                        lastKnownLocation: cAdd.lastKnownLocation === undefined ? null : cAdd.lastKnownLocation,
                        preciseLocation: cAdd.preciseLocation === undefined ? null : cAdd.preciseLocation,
                    } as Character);
                }
            });
            (data.charactersUpdated || []).forEach(cUpd => {
                if (isValidCharacterUpdate(cUpd)) {
                    const existing = context.allRelevantCharacters.find(ex => ex.name === cUpd.name);
                    charactersForDialogueContext.push({
                        id: buildCharacterId(cUpd.name),
                        name: cUpd.name,
                        description: cUpd.newDescription || existing?.description || 'Updated character',
                        aliases: cUpd.newAliases || existing?.aliases || [],
                        themeName: '',
                        presenceStatus: cUpd.newPresenceStatus || existing?.presenceStatus || 'unknown',
                        lastKnownLocation: cUpd.newLastKnownLocation === undefined ? (existing?.lastKnownLocation ?? null) : cUpd.newLastKnownLocation,
                        preciseLocation: cUpd.newPreciseLocation === undefined ? (existing?.preciseLocation ?? null) : cUpd.newPreciseLocation,
                    } as Character);
                }
            });

            const correctedDialogueSetup = await fetchCorrectedDialogueSetup_Service(
                context.logMessageFromPayload || data.logMessage,
                context.sceneDescriptionFromPayload || data.sceneDescription,
                context.currentTheme,
                charactersForDialogueContext,
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

    return { dialogueSetup, options: options as string[], isDialogueTurn };
}


/**
 * Handles character additions and updates validation/correction logic.
 */
async function handleCharacterChanges(
    rawAdded: unknown,
    rawUpdated: unknown,
    baseData: Partial<GameStateFromAI>,
    context: ParserContext
): Promise<{ charactersAdded: Character[]; charactersUpdated: ValidCharacterUpdatePayload[] }> {
    const finalCharactersAdded: Character[] = [];
    if (Array.isArray(rawAdded)) {
        for (const originalCharAdd of rawAdded) {
            const originalName = (typeof originalCharAdd === 'object' && originalCharAdd !== null && 'name' in originalCharAdd)
                ? (originalCharAdd as { name?: unknown }).name as string | undefined
                : undefined;
            if (isValidNewCharacterPayload(originalCharAdd)) {
                finalCharactersAdded.push({
                    ...(originalCharAdd as Character),
                    id: buildCharacterId(originalCharAdd.name),
                    presenceStatus: originalCharAdd.presenceStatus || 'unknown',
                    lastKnownLocation: originalCharAdd.lastKnownLocation === undefined ? null : originalCharAdd.lastKnownLocation,
                    preciseLocation: originalCharAdd.preciseLocation === undefined ? null : originalCharAdd.preciseLocation,
                    themeName: '',
                });
            } else {
                console.warn(`parseAIResponse ('charactersAdded'): Invalid character structure for "${originalName || 'Unknown Name'}". Attempting correction.`);
                const correctedDetails = await fetchCorrectedCharacterDetails_Service(
                    originalName || 'Newly Mentioned Character',
                    context.logMessageFromPayload || baseData.logMessage,
                    context.sceneDescriptionFromPayload || baseData.sceneDescription,
                    context.currentTheme,
                    context.allRelevantMainMapNodesForCorrection
                );
                if (correctedDetails) {
                    const correctedCharAddPayload: ValidNewCharacterPayload = {
                        name: originalName || (correctedDetails.description.split(' ').slice(0, 2).join(' ') || 'Corrected Character'),
                        description: correctedDetails.description,
                        aliases: correctedDetails.aliases,
                        presenceStatus: correctedDetails.presenceStatus,
                        lastKnownLocation: correctedDetails.lastKnownLocation,
                        preciseLocation: correctedDetails.preciseLocation,
                    };
                    if (isValidNewCharacterPayload(correctedCharAddPayload)) {
                        finalCharactersAdded.push({ ...correctedCharAddPayload, id: buildCharacterId(correctedCharAddPayload.name), themeName: '' } as Character);
                        console.log(`parseAIResponse ('charactersAdded'): Successfully corrected character:`, correctedCharAddPayload.name);
                    } else {
                        console.warn(`parseAIResponse ('charactersAdded'): Corrected character "${originalName || 'Unknown Name'}" still invalid. Discarding. Corrected Data:`, correctedCharAddPayload);
                    }
                } else {
                    console.warn(`parseAIResponse ('charactersAdded'): Failed to correct character "${originalName || 'Unknown Name'}". Discarding.`);
                }
            }
        }
    } else if (rawAdded !== undefined) {
        console.warn("parseAIResponse ('charactersAdded'): Field was present but not an array.", rawAdded);
    }

    const rawCharacterUpdates: unknown[] = Array.isArray(rawUpdated) ? rawUpdated : [];
    const tempFinalCharactersUpdatedPayloads: ValidCharacterUpdatePayload[] = [];

    for (const cUpdate of rawCharacterUpdates) {
        if (
            typeof cUpdate === 'object' &&
            cUpdate !== null &&
            'name' in cUpdate &&
            typeof (cUpdate as { name?: unknown }).name === 'string' &&
            (cUpdate as { name: string }).name.trim() !== ''
        ) {
            const currentCUpdatePayload: { [key: string]: unknown; name: string } = {
                ...(cUpdate as Record<string, unknown>),
                name: (cUpdate as { name: string }).name,
            };
            const allKnownAndCurrentlyAddedCharNames = new Set([
                ...context.allRelevantCharacters.map(c => c.name),
                ...finalCharactersAdded.map(c => c.name),
            ]);

            if (!allKnownAndCurrentlyAddedCharNames.has(currentCUpdatePayload.name)) {
                console.warn(`parseAIResponse ('charactersUpdated'): Original target name "${currentCUpdatePayload.name}" not found. Attempting name correction.`);
                const correctedName = await fetchCorrectedName_Service(
                    'character name',
                    currentCUpdatePayload.name,
                    context.logMessageFromPayload || baseData.logMessage,
                    context.sceneDescriptionFromPayload || baseData.sceneDescription,
                    Array.from(allKnownAndCurrentlyAddedCharNames),
                    context.currentTheme
                );
                if (correctedName && correctedName.trim() !== '') {
                    currentCUpdatePayload.name = correctedName;
                    console.log(`parseAIResponse ('charactersUpdated'): Corrected target name to "${correctedName}".`);
                } else {
                    console.warn(`parseAIResponse ('charactersUpdated'): Failed to correct target name for "${currentCUpdatePayload.name}". Will attempt to process as is, may convert to 'add'.`);
                }
            }

            if (isValidCharacterUpdate(currentCUpdatePayload)) {
                tempFinalCharactersUpdatedPayloads.push(currentCUpdatePayload);
            } else {
                console.warn(`parseAIResponse ('charactersUpdated'): Payload for "${currentCUpdatePayload.name}" is invalid after potential name correction. Discarding. Payload:`, currentCUpdatePayload);
            }
        } else {
            console.warn("parseAIResponse ('charactersUpdated'): Update missing or has invalid 'name'. Discarding.", cUpdate);
        }
    }

    const finalCharacterUpdateInstructions: ValidCharacterUpdatePayload[] = [];
    for (const charUpdatePayload of tempFinalCharactersUpdatedPayloads) {
        const targetName = charUpdatePayload.name;
        const isAlreadyKnownFromPreviousTurns = context.allRelevantCharacters.some(char => char.name === targetName);
        const charAddedThisTurnIndex = finalCharactersAdded.findIndex(charAdded => charAdded.name === targetName);
        const isBeingAddedThisTurn = charAddedThisTurnIndex !== -1;

        if (isAlreadyKnownFromPreviousTurns || isBeingAddedThisTurn) {
            finalCharacterUpdateInstructions.push(charUpdatePayload);
            if (isBeingAddedThisTurn) {
                const charInAddedList = finalCharactersAdded[charAddedThisTurnIndex];
                if (charUpdatePayload.newDescription !== undefined) charInAddedList.description = charUpdatePayload.newDescription;
                if (charUpdatePayload.newAliases !== undefined) charInAddedList.aliases = charUpdatePayload.newAliases;
                if (charUpdatePayload.addAlias) charInAddedList.aliases = Array.from(new Set([...(charInAddedList.aliases || []), charUpdatePayload.addAlias]));
                if (charUpdatePayload.newPresenceStatus !== undefined) charInAddedList.presenceStatus = charUpdatePayload.newPresenceStatus;
                if (charUpdatePayload.newLastKnownLocation !== undefined) charInAddedList.lastKnownLocation = charUpdatePayload.newLastKnownLocation;
                if (charUpdatePayload.newPreciseLocation !== undefined) charInAddedList.preciseLocation = charUpdatePayload.newPreciseLocation;

                if (charInAddedList.presenceStatus === 'distant' || charInAddedList.presenceStatus === 'unknown') {
                    charInAddedList.preciseLocation = null;
                } else if ((charInAddedList.presenceStatus === 'nearby' || charInAddedList.presenceStatus === 'companion') && charInAddedList.preciseLocation === null) {
                    charInAddedList.preciseLocation = charInAddedList.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
                }
                finalCharactersAdded[charAddedThisTurnIndex] = charInAddedList;
            }
        } else {
            console.warn(`parseAIResponse ('charactersUpdated'): Target character "${targetName}" for update not found. Converting to an add operation.`);

            const newCharDataFromUpdate: Character = {
                id: buildCharacterId(targetName),
                name: targetName,
                description: charUpdatePayload.newDescription || `Details for ${targetName} are emerging.`,
                aliases: charUpdatePayload.newAliases || (charUpdatePayload.addAlias ? [charUpdatePayload.addAlias] : []),
                themeName: '',
                presenceStatus: charUpdatePayload.newPresenceStatus || 'unknown',
                lastKnownLocation: charUpdatePayload.newLastKnownLocation === undefined ? null : charUpdatePayload.newLastKnownLocation,
                preciseLocation: charUpdatePayload.newPreciseLocation === undefined ? null : charUpdatePayload.newPreciseLocation,
            };

            if (newCharDataFromUpdate.description === `Details for ${targetName} are emerging.`) {
                const correctedDetails = await fetchCorrectedCharacterDetails_Service(
                    targetName,
                    context.logMessageFromPayload || baseData.logMessage,
                    context.sceneDescriptionFromPayload || baseData.sceneDescription,
                    context.currentTheme,
                    context.allRelevantMainMapNodesForCorrection
                );
                if (correctedDetails) {
                    newCharDataFromUpdate.description = correctedDetails.description;
                    newCharDataFromUpdate.aliases = Array.from(new Set([...(newCharDataFromUpdate.aliases || []), ...(correctedDetails.aliases || [])]));
                    newCharDataFromUpdate.presenceStatus = correctedDetails.presenceStatus;
                    newCharDataFromUpdate.lastKnownLocation = correctedDetails.lastKnownLocation;
                    newCharDataFromUpdate.preciseLocation = correctedDetails.preciseLocation;
                }
            }

            if (newCharDataFromUpdate.presenceStatus === 'distant' || newCharDataFromUpdate.presenceStatus === 'unknown') {
                newCharDataFromUpdate.preciseLocation = null;
            } else if ((newCharDataFromUpdate.presenceStatus === 'nearby' || newCharDataFromUpdate.presenceStatus === 'companion') && newCharDataFromUpdate.preciseLocation === null) {
                newCharDataFromUpdate.preciseLocation = newCharDataFromUpdate.presenceStatus === 'companion' ? 'with you' : 'nearby in the scene';
            }

            const existingIndexInAdded = finalCharactersAdded.findIndex(c => c.name === newCharDataFromUpdate.name);
            if (existingIndexInAdded === -1) {
                finalCharactersAdded.push(newCharDataFromUpdate);
            } else {
                finalCharactersAdded[existingIndexInAdded] = { ...finalCharactersAdded[existingIndexInAdded], ...newCharDataFromUpdate };
            }
        }
    }

    return { charactersAdded: finalCharactersAdded, charactersUpdated: finalCharacterUpdateInstructions };
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
    allRelevantCharacters: Character[] = [],
    currentThemeMapData: MapData = { nodes: [], edges: [] },
    currentInventoryForCorrection: Item[] = []
): Promise<GameStateFromAI | null> {
    const jsonStr = extractJsonFromFence(responseText);

    const allRelevantMainMapNodesForCorrection: MapNode[] = currentThemeMapData.nodes.filter(node => node.data.nodeType !== 'feature');

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
            allRelevantCharacters,
            allRelevantMainMapNodesForCorrection,
            currentInventoryForCorrection,
        };

        const dialogueResult = await handleDialogueSetup(validated, context);
        if (!dialogueResult) return null;

        validated.dialogueSetup = dialogueResult.dialogueSetup;
        validated.options = dialogueResult.options;
        let isDialogueTurn = dialogueResult.isDialogueTurn;

        validated.itemChange = [];

        const charResult = await handleCharacterChanges(validated.charactersAdded, validated.charactersUpdated, validated, context);
        validated.charactersAdded = charResult.charactersAdded;
        validated.charactersUpdated = charResult.charactersUpdated;

        if (isDialogueTurn && validated.dialogueSetup && validated.dialogueSetup.participants) {
            const allAvailableCharacterNamesThisTurn = new Set([
                ...allRelevantCharacters.map(c => c.name),
                ...(validated.charactersAdded?.map(c => c.name) || []),
                ...(validated.charactersUpdated?.map(cUpd => cUpd.name) || [])
            ]);

            const finalValidParticipants: string[] = [];
            for (const participant of validated.dialogueSetup.participants) {
                if (allAvailableCharacterNamesThisTurn.has(participant)) {
                    finalValidParticipants.push(participant);
                } else {
                    console.warn(`parseAIResponse: Dialogue participant "${participant}" is not among known or newly added/updated characters. Attempting name correction against this turn's characters.`);
                    const correctedParticipantName = await fetchCorrectedName_Service(
                        'dialogue participant',
                        participant,
                        logMessageFromPayload || validated.logMessage,
                        sceneDescriptionFromPayload || validated.sceneDescription,
                        Array.from(allAvailableCharacterNamesThisTurn),
                        currentTheme
                    );
                    if (correctedParticipantName && allAvailableCharacterNamesThisTurn.has(correctedParticipantName)) {
                        finalValidParticipants.push(correctedParticipantName);
                        console.log(`parseAIResponse: Corrected dialogue participant name from "${participant}" to "${correctedParticipantName}".`);
                    } else {
                        console.warn(`parseAIResponse: Dialogue participant "${participant}" could not be validated/corrected against this turn's characters. Discarding participant.`);
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
            } else if (validated.dialogueSetup) {
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
        validated.localTime = validated.localTime?.trim() || 'Time Unknown';
        validated.localEnvironment = validated.localEnvironment?.trim() || 'Environment Undetermined';
        validated.localPlace = validated.localPlace?.trim() || 'Undetermined Location';
        if (validated.mapHint !== undefined) {
            validated.mapHint = validated.mapHint.trim();
        }
        if (validated.playerItemsHint !== undefined) {
            validated.playerItemsHint = validated.playerItemsHint.trim();
        }
        if (validated.worldItemsHint !== undefined) {
            validated.worldItemsHint = validated.worldItemsHint.trim();
        }
        if (validated.npcItemsHint !== undefined) {
            validated.npcItemsHint = validated.npcItemsHint.trim();
        }

        if (Array.isArray(validated.newItems)) {
            validated.newItems = validated.newItems.filter(isValidNewItemSuggestion);
        }

        delete (validated as Record<string, unknown>).placesAdded;
        delete (validated as Record<string, unknown>).placesUpdated;

        return validated as GameStateFromAI;

    } catch (e) {
        console.warn('parseAIResponse: Failed to parse JSON response from AI. This attempt will be considered a failure.', e);
        console.debug('parseAIResponse: Original response text (before any processing):', responseText);
        console.debug('parseAIResponse: JSON string after fence stripping (if any, input to JSON.parse):', jsonStr);
        onParseAttemptFailed?.();
        return null;
    }
}
