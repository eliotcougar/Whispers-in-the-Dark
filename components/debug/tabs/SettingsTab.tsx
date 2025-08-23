import { useState, useCallback } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';

interface SettingsTabProps {
  readonly badFacts: Array<string>;
  readonly debugLore: boolean;
  readonly goodFacts: Array<string>;
  readonly onClearFacts: () => void;
  readonly onSaveFacts: (data: string) => void;
  readonly onSimulateVictory: () => void;
  readonly onToggleDebugLore: () => void;
}

function SettingsTab({
  badFacts,
  debugLore,
  goodFacts,
  onClearFacts,
  onSaveFacts,
  onSimulateVictory,
  onToggleDebugLore,
}: SettingsTabProps) {
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
        Debug Lore
      </h2>

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
          ariaLabel="Simulate victory"
          label="Simulate Victory"
          onClick={onSimulateVictory}
          preset="green"
          size="sm"
          variant="compact"
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

export default SettingsTab;
