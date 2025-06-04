
import { GameStateFromAI, Item, ItemChange, Character, MapData,
    ValidCharacterUpdatePayload, ValidNewCharacterPayload, DialogueSetupPayload, CharacterPresenceInfo, MapNode, AdventureTheme } from '../types';
import {
    isValidItem,
    isValidCharacterUpdate,
    isValidNewCharacterPayload,
    isDialogueSetupPayloadStructurallyValid
} from './validationUtils';
import {
    fetchCorrectedItemAction_Service,
    fetchCorrectedItemPayload_Service,
    fetchCorrectedName_Service,
    fetchCorrectedCharacterDetails_Service,
    fetchCorrectedDialogueSetup_Service,
    fetchCorrectedPlaceDetails_Service, 
} from './correctionService';


/**
 * Parses the AI's JSON response, validates its structure against GameStateFromAI,
 * and attempts to correct malformed sections using correction services.
 * @param responseText - The raw text response from the AI.
 * @param playerGender - The player's gender (for dialogue correction context).
 * @param currentTheme - The current adventure theme object.
 * @param onParseAttemptFailed - Optional callback for when parsing or validation fails.
 * @param logMessageFromPayload - Optional log message from the current turn's payload (for correction context).
 * @param sceneDescriptionFromPayload - Optional scene description from the current turn's payload (for correction context).
 * @param allRelevantCharacters - Array of all characters relevant to the current theme (for name correction context).
 * @param currentThemeMapData - The map data for the current theme (for deriving main map node context if needed by corrections).
 * @param currentInventoryForCorrection - The player's current inventory (for item name correction context).
 * @returns A validated (and potentially corrected) GameStateFromAI object, or null if parsing/validation fails irrecoverably.
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
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
  const fenceMatch = jsonStr.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  }

  // Derive known main map nodes from map data for correction context
  const allRelevantMainMapNodesForCorrection: MapNode[] = currentThemeMapData.nodes
      .filter(node => !node.data.isLeaf);


  try {
    const parsedData = JSON.parse(jsonStr) as Partial<GameStateFromAI>;

    // --- Initial structural validation ---
    if (!parsedData || typeof parsedData !== 'object') {
        console.warn("parseAIResponse: Parsed data is not a valid object.", parsedData);
        onParseAttemptFailed?.();
        return null;
    }

    if (typeof parsedData.sceneDescription !== 'string' || parsedData.sceneDescription.trim() === '') {
        console.warn("parseAIResponse: sceneDescription is missing or empty.", parsedData);
        onParseAttemptFailed?.(); return null;
    }

    // Base fields validation (excluding placesAdded/placesUpdated)
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
      console.warn("parseAIResponse: Basic field validation failed (pre-dialogue specifics and array checks).", parsedData);
      onParseAttemptFailed?.();
      return null;
    }

    // --- Dialogue setup validation and correction ---
    let isDialogueTurn = false;
    if (parsedData.dialogueSetup) {
        let dialogueSetupIsValid = isDialogueSetupPayloadStructurallyValid(parsedData.dialogueSetup);

        if (!dialogueSetupIsValid) {
            console.warn("parseAIResponse: 'dialogueSetup' is present but malformed. Attempting correction.");
            const charactersForDialogueContext: Character[] = [ ...allRelevantCharacters ];
             (parsedData.charactersAdded || []).forEach(cAdd => {
                if (isValidNewCharacterPayload(cAdd)) {
                    charactersForDialogueContext.push({ ...cAdd, themeName: "", presenceStatus: cAdd.presenceStatus || 'unknown', lastKnownLocation: cAdd.lastKnownLocation === undefined ? null : cAdd.lastKnownLocation, preciseLocation: cAdd.preciseLocation === undefined ? null : cAdd.preciseLocation } as Character);
                }
            });
            (parsedData.charactersUpdated || []).forEach(cUpd => {
                 if (isValidCharacterUpdate(cUpd)) {
                    const existing = allRelevantCharacters.find(ex => ex.name === cUpd.name);
                    charactersForDialogueContext.push({
                        name: cUpd.name,
                        description: cUpd.newDescription || existing?.description || "Updated character",
                        aliases: cUpd.newAliases || existing?.aliases || [],
                        themeName: "",
                        presenceStatus: cUpd.newPresenceStatus || existing?.presenceStatus || 'unknown',
                        lastKnownLocation: cUpd.newLastKnownLocation === undefined ? (existing?.lastKnownLocation ?? null) : cUpd.newLastKnownLocation,
                        preciseLocation: cUpd.newPreciseLocation === undefined ? (existing?.preciseLocation ?? null) : cUpd.newPreciseLocation,
                    } as Character);
                 }
            });
            
            const correctedDialogueSetup = await fetchCorrectedDialogueSetup_Service(
                logMessageFromPayload || parsedData.logMessage,
                sceneDescriptionFromPayload || parsedData.sceneDescription,
                currentTheme,
                charactersForDialogueContext,
                allRelevantMainMapNodesForCorrection,
                currentInventoryForCorrection,
                playerGender,
                parsedData.dialogueSetup 
            );

            if (correctedDialogueSetup && isDialogueSetupPayloadStructurallyValid(correctedDialogueSetup)) {
                parsedData.dialogueSetup = correctedDialogueSetup;
                dialogueSetupIsValid = true;
                console.log("parseAIResponse: Successfully corrected 'dialogueSetup'.");
            } else {
                console.warn("parseAIResponse: Failed to correct 'dialogueSetup' or corrected version is still invalid. Discarding dialogue attempt.");
                parsedData.dialogueSetup = undefined; 
                dialogueSetupIsValid = false;
            }
        }
        isDialogueTurn = dialogueSetupIsValid && !!parsedData.dialogueSetup; 
        if (isDialogueTurn) {
            parsedData.options = []; 
        }
    }
    
    if (!isDialogueTurn) {
        parsedData.dialogueSetup = undefined; 
        if (!Array.isArray(parsedData.options) || !parsedData.options.every((opt: unknown) => typeof opt === 'string')) {
            console.warn("parseAIResponse: options are missing or invalid (must be array of strings) when not in dialogue.", parsedData);
            onParseAttemptFailed?.(); return null;
        }
    }

    // --- ItemChange processing and correction ---
    parsedData.itemChange = parsedData.itemChange ?? [];
    if (!Array.isArray(parsedData.itemChange)) {
        console.warn("parseAIResponse: Invalid itemChange format (expected array). Discarding itemChange.", parsedData.itemChange);
        parsedData.itemChange = [];
    }

    const processedItemChanges: ItemChange[] = [];
    for (const rawIc of parsedData.itemChange) {
      let ic = { ...rawIc } as ItemChange;
      if (typeof ic === 'object' && ic !== null && Object.keys(ic).length === 0 && ic.constructor === Object) {
        console.warn("parseAIResponse ('itemChange'): Skipping empty itemChange object:", ic);
        continue;
      }

      if (typeof ic.action !== 'string' || !['gain', 'lose', 'use', 'update'].includes(ic.action)) {
        console.warn("parseAIResponse ('itemChange'): Invalid itemChange 'action'. Attempting correction.", ic);
        const correctedAction = await fetchCorrectedItemAction_Service(
            logMessageFromPayload || parsedData.logMessage,
            sceneDescriptionFromPayload || parsedData.sceneDescription,
            JSON.stringify(ic),
            currentTheme
        );
        if (correctedAction && ['gain', 'lose', 'use', 'update'].includes(correctedAction)) {
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
            const corrected = await fetchCorrectedItemPayload_Service(ic.action, logMessageFromPayload || parsedData.logMessage, sceneDescriptionFromPayload || parsedData.sceneDescription, JSON.stringify(currentItemPayload), currentTheme);
            if (corrected && isValidItem(corrected, 'gain')) {
              currentItemPayload = corrected; currentInvalidPayload = undefined;
            } else {
              currentInvalidPayload = currentItemPayload; currentItemPayload = null;
            }
          }
          if (currentItemPayload) {
            (currentItemPayload as Item).newName = undefined; (currentItemPayload as Item).addKnownUse = undefined;
            (currentItemPayload as Item).isJunk = (currentItemPayload as Item).isJunk ?? false;
            (currentItemPayload as Item).isActive = (currentItemPayload as Item).isActive ?? false;
          }
          break;
        case 'update':
          let originalNameForUpdate: string | undefined = undefined;
          if (typeof currentItemPayload === 'object' && currentItemPayload !== null && typeof (currentItemPayload as Item).name === 'string') {
            originalNameForUpdate = (currentItemPayload as Item).name;
            if (!currentInventoryForCorrection.some(invItem => invItem.name === originalNameForUpdate) && originalNameForUpdate.trim() !== '') {
              console.warn(`parseAIResponse ('update'): Original item name "${originalNameForUpdate}" not found in inventory. Attempting name correction.`);
              const correctedOriginalName = await fetchCorrectedName_Service("item", originalNameForUpdate, logMessageFromPayload || parsedData.logMessage, sceneDescriptionFromPayload || parsedData.sceneDescription, currentInventoryForCorrection.map(invItem => invItem.name), currentTheme);
              if (correctedOriginalName && correctedOriginalName.trim() !== '') {
                (currentItemPayload as Item).name = correctedOriginalName; console.log(`parseAIResponse ('update'): Corrected original item name to "${correctedOriginalName}".`);
              } else {
                console.warn(`parseAIResponse ('update'): Failed to correct original item name "${originalNameForUpdate}".`);
              }
            }
          }
          if (!isValidItem(currentItemPayload, 'update')) {
            console.warn(`parseAIResponse ('update'): Invalid item structure. Attempting full payload correction.`, currentItemPayload);
            const corrected = await fetchCorrectedItemPayload_Service(ic.action, logMessageFromPayload || parsedData.logMessage, sceneDescriptionFromPayload || parsedData.sceneDescription, JSON.stringify(currentItemPayload), currentTheme);
            if (corrected && isValidItem(corrected, 'update')) {
              currentItemPayload = corrected; currentInvalidPayload = undefined;
            } else {
              currentInvalidPayload = currentItemPayload; currentItemPayload = null;
            }
          }
          if (currentItemPayload) {
            (currentItemPayload as Item).isJunk = (currentItemPayload as Item).isJunk ?? false;
            (currentItemPayload as Item).isActive = (currentItemPayload as Item).isActive ?? false;
          }
          break;
        case 'lose': case 'use':
          if (typeof currentItemPayload === 'string') {
            currentInvalidPayload = undefined;
          } else if (typeof currentItemPayload === 'object' && currentItemPayload !== null && typeof (currentItemPayload as any).name === 'string' && (currentItemPayload as any).name.trim() !== '') {
            currentItemPayload = (currentItemPayload as any).name.trim(); currentInvalidPayload = undefined;
            console.warn(`parseAIResponse ('${ic.action}'): Item payload was object, extracted name: "${currentItemPayload}".`);
          } else {
            currentInvalidPayload = currentItemPayload; currentItemPayload = null;
            console.warn(`parseAIResponse ('${ic.action}'): Invalid item payload (expected string name). Marked as invalid.`);
          }
          break;
      }
      processedItemChanges.push({ ...ic, item: currentItemPayload, invalidPayload: currentInvalidPayload });
    }
    parsedData.itemChange = processedItemChanges;

    // --- Character Add processing with corrections ---
    const finalCharactersAdded: Character[] = [];
    if (Array.isArray(parsedData.charactersAdded)) {
        for (const originalCharAdd of parsedData.charactersAdded) {
            if (isValidNewCharacterPayload(originalCharAdd)) {
                finalCharactersAdded.push({
                    ...(originalCharAdd as Character),
                    presenceStatus: originalCharAdd.presenceStatus || 'unknown',
                    lastKnownLocation: originalCharAdd.lastKnownLocation === undefined ? null : originalCharAdd.lastKnownLocation,
                    preciseLocation: originalCharAdd.preciseLocation === undefined ? null : originalCharAdd.preciseLocation,
                    themeName: "", // Will be set by useGameLogic
                });
            } else {
                console.warn(`parseAIResponse ('charactersAdded'): Invalid character structure for "${(originalCharAdd as any)?.name || 'Unknown Name'}". Attempting correction.`);
                const correctedDetails = await fetchCorrectedCharacterDetails_Service(
                    (originalCharAdd as any)?.name || "Newly Mentioned Character",
                    logMessageFromPayload || parsedData.logMessage,
                    sceneDescriptionFromPayload || parsedData.sceneDescription,
                    currentTheme,
                    allRelevantMainMapNodesForCorrection
                );
                if (correctedDetails) {
                    const correctedCharAddPayload: ValidNewCharacterPayload = {
                        name: (originalCharAdd as any)?.name || (correctedDetails.description.split(" ").slice(0,2).join(" ") || "Corrected Character"),
                        description: correctedDetails.description, aliases: correctedDetails.aliases,
                        presenceStatus: correctedDetails.presenceStatus,
                        lastKnownLocation: correctedDetails.lastKnownLocation, preciseLocation: correctedDetails.preciseLocation,
                    };
                    if (isValidNewCharacterPayload(correctedCharAddPayload)) {
                        finalCharactersAdded.push({ ...correctedCharAddPayload, themeName: "" } as Character);
                        console.log(`parseAIResponse ('charactersAdded'): Successfully corrected character:`, correctedCharAddPayload.name);
                    } else {
                        console.warn(`parseAIResponse ('charactersAdded'): Corrected character "${(originalCharAdd as any)?.name || 'Unknown Name'}" still invalid. Discarding. Corrected Data:`, correctedCharAddPayload);
                    }
                } else {
                    console.warn(`parseAIResponse ('charactersAdded'): Failed to correct character "${(originalCharAdd as any)?.name || 'Unknown Name'}". Discarding.`);
                }
            }
        }
    } else if (parsedData.charactersAdded !== undefined) {
        console.warn("parseAIResponse ('charactersAdded'): Field was present but not an array. Discarding.", parsedData.charactersAdded);
    }
    parsedData.charactersAdded = finalCharactersAdded; 

    // Process charactersUpdated: validate, correct names, and convert to adds if target not found.
    const rawCharacterUpdates: any[] = parsedData.charactersUpdated || [];
    const tempFinalCharactersUpdatedPayloads: ValidCharacterUpdatePayload[] = [];

    for (const cUpdate of rawCharacterUpdates) {
        if (typeof cUpdate.name === 'string' && cUpdate.name.trim() !== '') {
            let currentCUpdatePayload: any = { ...cUpdate };
            const allKnownAndCurrentlyAddedCharNames = new Set([
                ...allRelevantCharacters.map(c => c.name),
                ...finalCharactersAdded.map(c => c.name) 
            ]);

            if (!allKnownAndCurrentlyAddedCharNames.has(currentCUpdatePayload.name)) {
                console.warn(`parseAIResponse ('charactersUpdated'): Original target name "${currentCUpdatePayload.name}" not found. Attempting name correction.`);
                const correctedName = await fetchCorrectedName_Service(
                    "character name",
                    currentCUpdatePayload.name,
                    logMessageFromPayload || parsedData.logMessage,
                    sceneDescriptionFromPayload || parsedData.sceneDescription,
                    Array.from(allKnownAndCurrentlyAddedCharNames),
                    currentTheme
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
        const targetName = (charUpdatePayload as ValidCharacterUpdatePayload).name; 
        const isAlreadyKnownFromPreviousTurns = allRelevantCharacters.some(char => char.name === targetName);
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
                themeName: "", // Will be set by useGameLogic
                presenceStatus: charUpdatePayload.newPresenceStatus || 'unknown',
                lastKnownLocation: charUpdatePayload.newLastKnownLocation === undefined ? null : charUpdatePayload.newLastKnownLocation,
                preciseLocation: charUpdatePayload.newPreciseLocation === undefined ? null : charUpdatePayload.newPreciseLocation,
            };

            if (newCharDataFromUpdate.description === `Details for ${targetName} are emerging.`) {
                const correctedDetails = await fetchCorrectedCharacterDetails_Service(
                    targetName, logMessageFromPayload || parsedData.logMessage, sceneDescriptionFromPayload || parsedData.sceneDescription,
                    currentTheme, allRelevantMainMapNodesForCorrection
                );
                if (correctedDetails) {
                    newCharDataFromUpdate.description = correctedDetails.description;
                    newCharDataFromUpdate.aliases = Array.from(new Set([...newCharDataFromUpdate.aliases, ...correctedDetails.aliases]));
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
    parsedData.charactersAdded = finalCharactersAdded; 
    parsedData.charactersUpdated = finalCharacterUpdateInstructions;

    // --- Final Dialogue Participant Name Validation (using dialogueSetup.participants if present) ---
    if (isDialogueTurn && parsedData.dialogueSetup && parsedData.dialogueSetup.participants) {
        const allAvailableCharacterNamesThisTurn = new Set([
            ...allRelevantCharacters.map(c => c.name),
            ...(parsedData.charactersAdded?.map(c => c.name) || []), 
            ...(parsedData.charactersUpdated?.map(cUpd => cUpd.name) || []) 
        ]);

        const finalValidParticipants: string[] = [];
        for (const participant of parsedData.dialogueSetup.participants) {
            if (allAvailableCharacterNamesThisTurn.has(participant)) {
                finalValidParticipants.push(participant);
            } else {
                console.warn(`parseAIResponse: Dialogue participant "${participant}" is not among known or newly added/updated characters. Attempting name correction against this turn's characters.`);
                const correctedParticipantName = await fetchCorrectedName_Service(
                    "dialogue participant",
                    participant,
                    logMessageFromPayload || parsedData.logMessage,
                    sceneDescriptionFromPayload || parsedData.sceneDescription,
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
        
        if (finalValidParticipants.length === 0 && parsedData.dialogueSetup.participants.length > 0) {
            console.warn("parseAIResponse: No valid dialogue participants remain after final name validation. Discarding dialogue attempt.");
            parsedData.dialogueSetup = undefined;
            isDialogueTurn = false; 
             if (!Array.isArray(parsedData.options) || parsedData.options.length === 0 || !parsedData.options.every((opt: unknown) => typeof opt === 'string' && opt.trim() !== '')) {
                 console.warn("parseAIResponse: options invalid after dialogue cancellation. Resetting to default failsafe.", parsedData.options);
                 parsedData.options = ["Look around.", "Ponder the situation.", "Check inventory.", "Try to move on."];
            }
        } else if (parsedData.dialogueSetup) { 
            parsedData.dialogueSetup.participants = finalValidParticipants;
        }
    }


    // --- Final normalizations and defaults ---
    if (!isDialogueTurn) { 
        if (!Array.isArray(parsedData.options) || parsedData.options.length === 0 || !parsedData.options.every((opt: unknown) => typeof opt === 'string' && opt.trim() !== '')) {
            console.warn("parseAIResponse: options are missing, empty, or invalid when not inDialogue (final check).", parsedData.options);
            onParseAttemptFailed?.(); return null;
        }
        while (parsedData.options.length < 4) parsedData.options.push("...");
        if (parsedData.options.length > 4) parsedData.options = parsedData.options.slice(0, 4);
    } else {
        parsedData.options = [];
    }

    parsedData.objectiveAchieved = parsedData.objectiveAchieved ?? false;
    parsedData.localTime = parsedData.localTime?.trim() || "Time Unknown";
    parsedData.localEnvironment = parsedData.localEnvironment?.trim() || "Environment Undetermined";
    parsedData.localPlace = parsedData.localPlace?.trim() || "Undetermined Location";

    // Remove placesAdded and placesUpdated as they are no longer expected from storyteller AI
    delete (parsedData as any).placesAdded;
    delete (parsedData as any).placesUpdated;

    return parsedData as GameStateFromAI;

  } catch (e) {
    console.warn("parseAIResponse: Failed to parse JSON response from AI. This attempt will be considered a failure.", e);
    console.debug("parseAIResponse: Original response text (before any processing):", responseText);
    console.debug("parseAIResponse: JSON string after fence stripping (if any, input to JSON.parse):", jsonStr);
    onParseAttemptFailed?.();
    return null;
  }
}
