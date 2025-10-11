import type { ComponentProps } from 'react';
import MainToolbar from '../MainToolbar';
import ModelUsageIndicators from '../ModelUsageIndicators';
import LoadingSpinner from '../LoadingSpinner';
import SceneDisplay from '../SceneDisplay';
import ActionOptions from '../ActionOptions';
import FreeActionInput from './FreeActionInput';
import GameSidebar from './GameSidebar';

interface GameHudProps {
  readonly hasGameBeenInitialized: boolean;
  readonly showInitialLoadingSpinner: boolean;
  readonly showSceneLoadingOverlay: boolean;
  readonly mainToolbarProps: ComponentProps<typeof MainToolbar>;
  readonly sceneDisplayProps: ComponentProps<typeof SceneDisplay>;
  readonly actionOptionsProps: ComponentProps<typeof ActionOptions>;
  readonly freeActionInputProps: ComponentProps<typeof FreeActionInput>;
  readonly sidebarProps: ComponentProps<typeof GameSidebar>;
}

function GameHud({
  hasGameBeenInitialized,
  showInitialLoadingSpinner,
  showSceneLoadingOverlay,
  mainToolbarProps,
  sceneDisplayProps,
  actionOptionsProps,
  freeActionInputProps,
  sidebarProps,
}: GameHudProps) {
  const {
    adventureName,
    currentSceneExists,
    isLoading: toolbarIsLoading,
    isTurnProcessing,
    onOpenKnowledgeBase,
    onOpenMap,
    onOpenTitleMenu,
    onOpenVisualizer,
    score,
  } = mainToolbarProps;
  const {
    allNPCs: sceneNPCs,
    description,
    inventory: sceneInventory,
    lastActionLog,
    localEnvironment,
    localPlace,
    localTime,
    mapData: sceneMapData,
  } = sceneDisplayProps;
  const {
    allNPCs: actionNPCs,
    disabled: actionsDisabled,
    inventory: actionInventory,
    mapData: actionMapData,
    onActionSelect,
    onClearQueuedActions,
    options,
    queuedActions,
  } = actionOptionsProps;
  const {
    canPerformFreeAction,
    freeFormActionText,
    onChange: handleFreeActionChange,
    onSubmit: handleFreeActionSubmit,
  } = freeActionInputProps;
  const {
    allNPCs: sidebarNPCs,
    currentMapNodeId,
    currentObjective,
    disabled: sidebarDisabled,
    enableMobileTap,
    globalTurnNumber,
    inventory: sidebarInventory,
    itemsHere,
    mapNodes,
    objectiveAnimationType,
    onItemInteract,
    onReadPage,
    onReadPlayerJournal,
    onStashToggle,
    queuedActionIds,
    remainingActionPoints,
    storyArc,
  } = sidebarProps;

  return (
    <>
      <div className="lg:col-span-2 space-y-3 flex flex-col">
        <MainToolbar
          adventureName={adventureName}
          currentSceneExists={currentSceneExists}
          isLoading={toolbarIsLoading}
          isTurnProcessing={isTurnProcessing}
          onOpenKnowledgeBase={onOpenKnowledgeBase}
          onOpenMap={onOpenMap}
          onOpenTitleMenu={onOpenTitleMenu}
          onOpenVisualizer={onOpenVisualizer}
          score={score}
        />

        <ModelUsageIndicators />

        {showInitialLoadingSpinner ? <LoadingSpinner /> : null}

        {!hasGameBeenInitialized ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg flex-grow min-h-48" />
        ) : (
          <>
            <div className="relative">
              <SceneDisplay
                allNPCs={sceneNPCs}
                description={description}
                inventory={sceneInventory}
                lastActionLog={lastActionLog}
                localEnvironment={localEnvironment}
                localPlace={localPlace}
                localTime={localTime}
                mapData={sceneMapData}
              />

              {showSceneLoadingOverlay ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/75 rounded-lg">
                  <LoadingSpinner />
                </div>
              ) : null}
            </div>

            <ActionOptions
              allNPCs={actionNPCs}
              disabled={actionsDisabled}
              inventory={actionInventory}
              mapData={actionMapData}
              onActionSelect={onActionSelect}
              onClearQueuedActions={onClearQueuedActions}
              options={options}
              queuedActions={queuedActions}
            />

            <FreeActionInput
              canPerformFreeAction={canPerformFreeAction}
              freeFormActionText={freeFormActionText}
              onChange={handleFreeActionChange}
              onSubmit={handleFreeActionSubmit}
            />
          </>
        )}
      </div>

      <div className="lg:col-span-2 space-y-2 flex flex-col">
        {!hasGameBeenInitialized ? (
          <div className="hidden lg:block bg-slate-800/50 border border-slate-700 rounded-lg flex-grow min-h-48" />
        ) : (
          <GameSidebar
            allNPCs={sidebarNPCs}
            currentMapNodeId={currentMapNodeId}
            currentObjective={currentObjective}
            disabled={sidebarDisabled}
            enableMobileTap={enableMobileTap}
            globalTurnNumber={globalTurnNumber}
            inventory={sidebarInventory}
            itemsHere={itemsHere}
            mapNodes={mapNodes}
            objectiveAnimationType={objectiveAnimationType}
            onItemInteract={onItemInteract}
            onReadPage={onReadPage}
            onReadPlayerJournal={onReadPlayerJournal}
            onStashToggle={onStashToggle}
            queuedActionIds={queuedActionIds}
            remainingActionPoints={remainingActionPoints}
            storyArc={storyArc}
          />
        )}
      </div>
    </>
  );
}

export default GameHud;
