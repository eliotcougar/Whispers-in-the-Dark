import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket, LoremasterModeDebugInfo } from '../../../types';
import { filterObservationsAndRationale } from './tabUtils';

interface LoremasterAITabProps {
  readonly debugPacket: DebugPacket | null;
  readonly onDistillFacts: () => void;
}

function LoremasterAITab({ debugPacket, onDistillFacts }: LoremasterAITabProps) {
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});

  const handleShowRaw = useCallback(
    (mode: string) => () => { setShowRaw(prev => ({ ...prev, [mode]: true })); },
    [],
  );
  const handleShowParsed = useCallback(
    (mode: string) => () => { setShowRaw(prev => ({ ...prev, [mode]: false })); },
    [],
  );

  const renderMode = (
    modeLabel: string,
    info: LoremasterModeDebugInfo | null | undefined,
  ) => {
    if (!info) return null;
    const raw = showRaw[modeLabel] ?? true;
    return (
      <div
        className="mb-4"
        key={modeLabel}
      >
        <DebugSection
          content={info.prompt}
          isJson={false}
          title={`${modeLabel} Request`}
        />

        <div className="my-2 flex flex-wrap gap-2">
          <Button
            ariaLabel={`Show raw ${modeLabel} response`}
            label="Raw"
            onClick={handleShowRaw(modeLabel)}
            preset={raw ? 'sky' : 'slate'}
            pressed={raw}
            size="sm"
            variant="toggle"
          />

          <Button
            ariaLabel={`Show parsed ${modeLabel} response`}
            label="Parsed"
            onClick={handleShowParsed(modeLabel)}
            preset={raw ? 'slate' : 'sky'}
            pressed={!raw}
            size="sm"
            variant="toggle"
          />
        </div>

        {raw ? (
          <DebugSection
            content={filterObservationsAndRationale(info.rawResponse)}
            isJson={false}
            title={`${modeLabel} Response Raw`}
          />
        ) : (
          <DebugSection
            content={info.parsedPayload}
            title={`${modeLabel} Response Parsed`}
          />
        )}

        {info.observations ? (
          <DebugSection
            content={info.observations}
            isJson={false}
            title={`${modeLabel} Observations`}
          />
        ) : null}

        {info.rationale ? (
          <DebugSection
            content={info.rationale}
            isJson={false}
            title={`${modeLabel} Rationale`}
          />
        ) : null}
      </div>
    );
  };

  const loremasterInfo = debugPacket?.loremasterDebugInfo;

  return (
    <>
      <Button
        ariaLabel="Trigger distill mode"
        label="Run Distill"
        onClick={onDistillFacts}
        preset="purple"
        size="sm"
        variant="compact"
      />

      {loremasterInfo ? (
        <>
          {renderMode('Collect', loremasterInfo.collect)}

          {renderMode('Extract', loremasterInfo.extract)}

          {renderMode('Integrate', loremasterInfo.integrate)}

          {renderMode('Distill', loremasterInfo.distill)}
        </>
      ) : (
        <p className="italic text-slate-300">
          No Loremaster AI interaction debug packet captured.
        </p>
      )}
    </>
  );
}

export default LoremasterAITab;
