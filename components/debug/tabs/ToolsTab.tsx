import { useState, useCallback } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';

interface ToolsTabProps {
  readonly badFacts: Array<string>;
  readonly debugLore: boolean;
  readonly goodFacts: Array<string>;
  readonly onClearFacts: () => void;
  readonly onSaveFacts: (data: string) => void;
  readonly onSimulateVictory: () => void;
  readonly onToggleDebugLore: () => void;
  readonly onTriggerMainQuestAchieved: () => void;
  readonly onSpawnNpcAtLocation: () => void;
  readonly onSpawnBook: () => void;
  readonly onSpawnMap: () => void;
  readonly onSpawnPicture: () => void;
  readonly onSpawnPage: () => void;
  readonly onSpawnVehicle: () => void;
}

function ToolsTab({
  badFacts,
  debugLore,
  goodFacts,
  onClearFacts,
  onSaveFacts,
  onSimulateVictory,
  onToggleDebugLore,
  onTriggerMainQuestAchieved,
  onSpawnNpcAtLocation,
  onSpawnBook,
  onSpawnMap,
  onSpawnPicture,
  onSpawnPage,
  onSpawnVehicle,
}: ToolsTabProps) {
  const [showFacts, setShowFacts] = useState(false);

  const handleToggleView = useCallback(() => {
    setShowFacts(prev => !prev);
  }, []);

  const handleSave = useCallback(() => {
    const data = JSON.stringify({ goodFacts, badFacts }, null, 2);
    onSaveFacts(data);
  }, [goodFacts, badFacts, onSaveFacts]);

  const handleClear = useCallback(() => {
    onClearFacts();
  }, [onClearFacts]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-sky-300 mb-2">
        Tools
      </h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          ariaLabel="Trigger main quest achieved"
          label="Main Quest Achieved"
          onClick={onTriggerMainQuestAchieved}
          preset="purple"
          size="sm"
          variant="compact"
        />

        <Button
          ariaLabel="Simulate victory"
          label="Simulate Victory"
          onClick={onSimulateVictory}
          preset="green"
          size="sm"
          variant="compact"
        />

      </div>

      <h3 className="text-base font-semibold text-amber-200 mb-2">
        Spawn
      </h3>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          ariaLabel="Spawn NPC at current location"
          label="Spawn NPC (Here)"
          onClick={onSpawnNpcAtLocation}
          preset="orange"
          size="sm"
          variant="compact"
        />

        <Button
          ariaLabel="Spawn book in inventory"
          label="Spawn Book"
          onClick={onSpawnBook}
          preset="sky"
          size="sm"
          variant="compact"
        />

        <Button
          ariaLabel="Spawn map in inventory"
          label="Spawn Map"
          onClick={onSpawnMap}
          preset="sky"
          size="sm"
          variant="compact"
        />

        <Button
          ariaLabel="Spawn picture in inventory"
          label="Spawn Picture"
          onClick={onSpawnPicture}
          preset="sky"
          size="sm"
          variant="compact"
        />

        <Button
          ariaLabel="Spawn page in inventory"
          label="Spawn Page"
          onClick={onSpawnPage}
          preset="sky"
          size="sm"
          variant="compact"
        />

        <Button
          ariaLabel="Spawn vehicle in inventory"
          label="Spawn Vehicle"
          onClick={onSpawnVehicle}
          preset="sky"
          size="sm"
          variant="compact"
        />
      </div>

      <h3 className="text-base font-semibold text-sky-200 mb-2">
        Debug Lore
      </h3>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          ariaLabel="Toggle Debug Lore"
          label={debugLore ? 'Disable' : 'Enable'}
          onClick={onToggleDebugLore}
          preset="purple"
          pressed={debugLore}
          size="sm"
          variant="toggle"
        />

        <Button
          ariaLabel="View collected facts"
          label={showFacts ? 'Hide Facts' : 'View Facts'}
          onClick={handleToggleView}
          preset="sky"
          size="sm"
          variant="compact"
        />

        {showFacts ? (
          <Button
            ariaLabel="Save facts to file"
            label="Save JSON"
            onClick={handleSave}
            preset="green"
            size="sm"
            variant="compact"
          />
        ) : null}

        {showFacts ? (
          <Button
            ariaLabel="Clear collected facts"
            label="Clear Facts"
            onClick={handleClear}
            preset="red"
            size="sm"
            variant="compact"
          />
        ) : null}
      </div>

      {showFacts ? (
        <DebugSection
          content={{ goodFacts, badFacts }}
          title="Collected Facts"
        />
      ) : null}
    </div>
  );
}

export default ToolsTab;
