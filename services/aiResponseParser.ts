/**
 * @file aiResponseParser.ts
 * @description Utilities for validating and parsing AI storyteller responses.
 */

import { GameStateFromAI, Item, ItemChange, Character, MapData,
    ValidCharacterUpdatePayload, ValidNewCharacterPayload, DialogueSetupPayload,
    CharacterPresenceInfo, MapNode, AdventureTheme } from '../types';
import {
    isValidItem,
    isValidCharacterUpdate,
    isValidNewCharacterPayload,
    isDialogueSetupPayloadStructurallyValid
} from './parsers/validation';
import {
    fetchCorrectedItemAction_Service,
    fetchCorrectedItemPayload_Service,
    fetchCorrectedName_Service,
    fetchCorrectedCharacterDetails_Service,
    fetchCorrectedDialogueSetup_Service,
    fetchCorrectedPlaceDetails_Service,
} from './corrections';

import { sanitizeJsonString } from './parsers/jsonSanitizer';

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
    parsedData: any,
    onParseAttemptFailed?: () => void
): Partial<GameStateFromAI> | null {
    if (!parsedData || typeof parsedData !== 'object') {
        console.warn('parseAIResponse: Parsed data is not a valid object.', parsedData);
        onParseAttemptFailed?.();
        return null;
    }

    if (typeof parsedData.sceneDescription !== 'string' || parsedData.sceneDescription.trim() === '') {
        console.warn('parseAIResponse: sceneDescription is missing or empty.', parsedData);
        onParseAttemptFailed?.();
        return null;
    }

    const baseFieldsValid =
        (parsedData.mainQuest === undefined || typeof parsedData.mainQuest === 'string') &&
        (parsedData.currentObjective === undefined || typeof parsedData.currentObjective === 'string') &&
        (parsedData.logMessage === undefined || typeof parsedData.logMessage === 'string') &&
        (parsedData.charactersAdded === undefined || Array.isArray(parsedData.charactersAdded)) &&
        (parsedData.charactersUpdated === undefined || Array.isArray(parsedData.charactersUpdated)) &&
        (parsedData.objectiveAchieved === undefined || typeof parsedData.objectiveAchieved === 'boolean') &&
        (parsedData.localTime === undefined || typeof parsedData.localTime === 'string') &&
        (parsedData.localEnvironment === undefined || typeof parsedData.localEnvironment === 'string') &&
        (parsedData.localPlace === undefined || typeof parsedData.localPlace === 'string') &&
        (parsedData.dialogueSetup === undefined || typeof parsedData.dialogueSetup === 'object') &&
        (parsedData.mapUpdated === undefined || typeof parsedData.mapUpdated === 'boolean') &&
        (parsedData.currentMapNodeId === undefined || parsedData.currentMapNodeId === null || typeof parsedData.currentMapNodeId === 'string');

    if (!baseFieldsValid) {
        console.warn('parseAIResponse: Basic field validation failed (pre-dialogue specifics and array checks).', parsedData);
        onParseAttemptFailed?.();
        return null;
    }

    return parsedData as Partial<GameStateFromAI>;
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
 * Validates and corrects itemChange payloads.
 */
async function processItemChanges(
    itemChanges: any,
    baseData: Partial<GameStateFromAI>,
    context: ParserContext
): Promise<ItemChange[]> {
    const changes: any[] = Array.isArray(itemChanges) ? itemChanges : [];
    if (!Array.isArray(itemChanges)) {
        console.warn('parseAIResponse: Invalid itemChange format (expected array). Discarding itemChange.', itemChanges);
    }

    const processedItemChanges: ItemChange[] = [];
    for (const rawIc of changes) {
        let ic = { ...rawIc } as ItemChange;
        if (typeof ic === 'object' && ic !== null && Object.keys(ic).length === 0 && ic.constructor === Object) {
            console.warn("parseAIResponse ('itemChange'): Skipping empty itemChange object:", ic);
            continue;
        }

        if (typeof ic.action !== 'string' || !['gain', 'lose', 'update'].includes(ic.action)) {
            console.warn("parseAIResponse ('itemChange'): Invalid itemChange 'action'. Attempting correction.", ic);
            const correctedAction = await fetchCorrectedItemAction_Service(
                context.logMessageFromPayload || baseData.logMessage,
                context.sceneDescriptionFromPayload || baseData.sceneDescription,
                JSON.stringify(ic),
                context.currentTheme
            );
            if (correctedAction && ['gain', 'lose', 'update'].includes(correctedAction)) {
                ic.action = correctedAction;
                console.log(`parseAIResponse ('itemChange'): Corrected itemChange action to: "${correctedAction}"`, ic);
            } else {
                console.warn("parseAIResponse ('itemChange'): Failed to correct itemChange action. Discarding this itemChange.", ic);
                continue;
            }
        }

        let currentItemPayload = ic.item;
        let currentInvalidPayload = ic.invalidPayload;

        switch (ic.action) {
            case 'gain':
                if (!isValidItem(currentItemPayload, 'gain')) {
                    console.warn(`parseAIResponse ('gain'): Invalid item structure. Attempting correction.`, currentItemPayload);
                    const corrected = await fetchCorrectedItemPayload_Service(
                        ic.action,
                        context.logMessageFromPayload || baseData.logMessage,
                        context.sceneDescriptionFromPayload || baseData.sceneDescription,
                        JSON.stringify(currentItemPayload),
                        context.currentTheme
                    );
                    if (corrected && isValidItem(corrected, 'gain')) {
                        currentItemPayload = corrected;
                        currentInvalidPayload = undefined;
                    } else {
                        currentInvalidPayload = currentItemPayload;
                        currentItemPayload = null;
                    }
                }
                if (currentItemPayload) {
                    (currentItemPayload as Item).newName = undefined;
                    (currentItemPayload as Item).addKnownUse = undefined;
                    (currentItemPayload as Item).isJunk = (currentItemPayload as Item).isJunk ?? false;
                    (currentItemPayload as Item).isActive = (currentItemPayload as Item).isActive ?? false;
                }
                break;
            case 'update':
                let originalNameForUpdate: string | undefined = undefined;
                if (typeof currentItemPayload === 'object' && currentItemPayload !== null && typeof (currentItemPayload as Item).name === 'string') {
                    originalNameForUpdate = (currentItemPayload as Item).name;
                    if (!context.currentInventoryForCorrection.some(invItem => invItem.name === originalNameForUpdate) && originalNameForUpdate.trim() !== '') {
                        console.warn(`parseAIResponse ('update'): Original item name "${originalNameForUpdate}" not found in inventory. Attempting name correction.`);
                        const correctedOriginalName = await fetchCorrectedName_Service(
                            'item',
                            originalNameForUpdate,
                            context.logMessageFromPayload || baseData.logMessage,
                            context.sceneDescriptionFromPayload || baseData.sceneDescription,
                            context.currentInventoryForCorrection.map(invItem => invItem.name),
                            context.currentTheme
                        );
                        if (correctedOriginalName && correctedOriginalName.trim() !== '') {
                            (currentItemPayload as Item).name = correctedOriginalName;
                            console.log(`parseAIResponse ('update'): Corrected original item name to "${correctedOriginalName}".`);
                        } else {
                            console.warn(`parseAIResponse ('update'): Failed to correct original item name "${originalNameForUpdate}".`);
                        }
                    }
                }
                if (!isValidItem(currentItemPayload, 'update')) {
                    console.warn(`parseAIResponse ('update'): Invalid item structure. Attempting full payload correction.`, currentItemPayload);
                    const corrected = await fetchCorrectedItemPayload_Service(
                        ic.action,
                        context.logMessageFromPayload || baseData.logMessage,
                        context.sceneDescriptionFromPayload || baseData.sceneDescription,
                        JSON.stringify(currentItemPayload),
                        context.currentTheme
                    );
                    if (corrected && isValidItem(corrected, 'update')) {
                        currentItemPayload = corrected;
                        currentInvalidPayload = undefined;
                    } else {
                        currentInvalidPayload = currentItemPayload;
                        currentItemPayload = null;
                    }
                }
                if (currentItemPayload) {
                    (currentItemPayload as Item).isJunk = (currentItemPayload as Item).isJunk ?? false;
                    (currentItemPayload as Item).isActive = (currentItemPayload as Item).isActive ?? false;
                }
                break;
            case 'lose':
                if (typeof currentItemPayload === 'string') {
                    currentInvalidPayload = undefined;
                } else if (typeof currentItemPayload === 'object' && currentItemPayload !== null && typeof (currentItemPayload as any).name === 'string' && (currentItemPayload as any).name.trim() !== '') {
                    currentItemPayload = (currentItemPayload as any).name.trim();
                    currentInvalidPayload = undefined;
                    console.warn(`parseAIResponse ('${ic.action}'): Item payload was object, extracted name: "${currentItemPayload}".`);
                } else {
                    currentInvalidPayload = currentItemPayload;
                    currentItemPayload = null;
                    console.warn(`parseAIResponse ('${ic.action}'): Invalid item payload (expected string name). Marked as invalid.`);
                }
                break;
        }
        processedItemChanges.push({ ...ic, item: currentItemPayload, invalidPayload: currentInvalidPayload });
    }
    return processedItemChanges;
}

/**
 * Handles character additions and updates validation/correction logic.
 */
async function handleCharacterChanges(
    rawAdded: any,
    rawUpdated: any,
    baseData: Partial<GameStateFromAI>,
    context: ParserContext
): Promise<{ charactersAdded: Character[]; charactersUpdated: ValidCharacterUpdatePayload[] }> {
    const finalCharactersAdded: Character[] = [];
    if (Array.isArray(rawAdded)) {
        for (const originalCharAdd of rawAdded) {
            if (isValidNewCharacterPayload(originalCharAdd)) {
                finalCharactersAdded.push({
                    ...(originalCharAdd as Character),
                    presenceStatus: originalCharAdd.presenceStatus || 'unknown',
                    lastKnownLocation: originalCharAdd.lastKnownLocation === undefined ? null : originalCharAdd.lastKnownLocation,
                    preciseLocation: originalCharAdd.preciseLocation === undefined ? null : originalCharAdd.preciseLocation,
                    themeName: '',
                });
            } else {
                console.warn(`parseAIResponse ('charactersAdded'): Invalid character structure for "${(originalCharAdd as any)?.name || 'Unknown Name'}". Attempting correction.`);
                const correctedDetails = await fetchCorrectedCharacterDetails_Service(
                    (originalCharAdd as any)?.name || 'Newly Mentioned Character',
                    context.logMessageFromPayload || baseData.logMessage,
                    context.sceneDescriptionFromPayload || baseData.sceneDescription,
                    context.currentTheme,
                    context.allRelevantMainMapNodesForCorrection
                );
                if (correctedDetails) {
                    const correctedCharAddPayload: ValidNewCharacterPayload = {
                        name: (originalCharAdd as any)?.name || (correctedDetails.description.split(' ').slice(0, 2).join(' ') || 'Corrected Character'),
                        description: correctedDetails.description,
                        aliases: correctedDetails.aliases,
                        presenceStatus: correctedDetails.presenceStatus,
                        lastKnownLocation: correctedDetails.lastKnownLocation,
                        preciseLocation: correctedDetails.preciseLocation,
                    };
                    if (isValidNewCharacterPayload(correctedCharAddPayload)) {
                        finalCharactersAdded.push({ ...correctedCharAddPayload, themeName: '' } as Character);
                        console.log(`parseAIResponse ('charactersAdded'): Successfully corrected character:`, correctedCharAddPayload.name);
                    } else {
                        console.warn(`parseAIResponse ('charactersAdded'): Corrected character "${(originalCharAdd as any)?.name || 'Unknown Name'}" still invalid. Discarding. Corrected Data:`, correctedCharAddPayload);
                    }
                } else {
                    console.warn(`parseAIResponse ('charactersAdded'): Failed to correct character "${(originalCharAdd as any)?.name || 'Unknown Name'}". Discarding.`);
                }
            }
        }
    } else if (rawAdded !== undefined) {
        console.warn("parseAIResponse ('charactersAdded'): Field was present but not an array.", rawAdded);
    }

    const rawCharacterUpdates: any[] = Array.isArray(rawUpdated) ? rawUpdated : [];
    const tempFinalCharactersUpdatedPayloads: ValidCharacterUpdatePayload[] = [];

    for (const cUpdate of rawCharacterUpdates) {
        if (typeof cUpdate.name === 'string' && cUpdate.name.trim() !== '') {
            let currentCUpdatePayload: any = { ...cUpdate };
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
                tempFinalCharactersUpdatedPayloads.push(currentCUpdatePayload as ValidCharacterUpdatePayload);
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
                let charInAddedList = finalCharactersAdded[charAddedThisTurnIndex];
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

            let newCharDataFromUpdate: Character = {
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
    logMessageFromPayload?: string | undefined,
    sceneDescriptionFromPayload?: string | undefined,
    allRelevantCharacters: Character[] = [],
    currentThemeMapData: MapData = { nodes: [], edges: [] },
    currentInventoryForCorrection: Item[] = []
): Promise<GameStateFromAI | null> {
    const jsonStr = sanitizeJsonString(responseText);

    const allRelevantMainMapNodesForCorrection: MapNode[] = currentThemeMapData.nodes.filter(node => node.data.nodeType !== 'feature');

    try {
        const parsedData = JSON.parse(jsonStr) as Partial<GameStateFromAI>;

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

        validated.itemChange = await processItemChanges(validated.itemChange ?? [], validated, context);

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
                    validated.options = ['Look around.', 'Ponder the situation.', 'Check inventory.', 'Try to move on.'];
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
            while (validated.options.length < 4) validated.options.push('...');
            if (validated.options.length > 4) validated.options = validated.options.slice(0, 4);
        } else {
            validated.options = [];
        }

        validated.objectiveAchieved = validated.objectiveAchieved ?? false;
        validated.localTime = validated.localTime?.trim() || 'Time Unknown';
        validated.localEnvironment = validated.localEnvironment?.trim() || 'Environment Undetermined';
        validated.localPlace = validated.localPlace?.trim() || 'Undetermined Location';

        delete (validated as any).placesAdded;
        delete (validated as any).placesUpdated;

        return validated as GameStateFromAI;

    } catch (e) {
        console.warn('parseAIResponse: Failed to parse JSON response from AI. This attempt will be considered a failure.', e);
        console.debug('parseAIResponse: Original response text (before any processing):', responseText);
        console.debug('parseAIResponse: JSON string after fence stripping (if any, input to JSON.parse):', jsonStr);
        onParseAttemptFailed?.();
        return null;
    }
}
