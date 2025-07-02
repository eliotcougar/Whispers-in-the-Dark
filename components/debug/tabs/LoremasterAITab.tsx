import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket, LoremasterModeDebugInfo } from '../../../types';
import { jsonSchemaToPrompt, JsonSchema } from '../../../utils/schemaPrompt';
import { filterObservationsAndRationale, decodeEscapedString } from './tabUtils';

interface LoremasterAITabProps {
  readonly debugPacket: DebugPacket | null;
  readonly onDistillFacts: () => void;
}

function LoremasterAITab({ debugPacket, onDistillFacts }: LoremasterAITabProps) {
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'reqres' | 'insights' | 'prompt'>('reqres');

  const handleShowRaw = useCallback(
    (mode: string) => () => { setShowRaw(prev => ({ ...prev, [mode]: true })); },
    [],
  );
  const handleShowParsed = useCallback(
    (mode: string) => () => { setShowRaw(prev => ({ ...prev, [mode]: false })); },
    [],
  );
  const handleShowReqRes = useCallback(() => { setView('reqres'); }, []);
  const handleShowInsights = useCallback(() => { setView('insights'); }, []);
  const handleShowPrompt = useCallback(() => { setView('prompt'); }, []);

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
        {view === 'reqres' ? (
          <>
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
          </>
        ) : view === 'insights' ? (
          <>
            {info.thoughts && info.thoughts.length > 0 ? (
              <DebugSection
                content={info.thoughts.map(decodeEscapedString).join('\n')}
                isJson={false}
                maxHeightClass="overflow-visible max-h-fit"
                title={`${modeLabel} Thoughts`}
              />
            ) : null}

            {info.observations ? (
              <DebugSection
                content={info.observations}
                isJson={false}
                maxHeightClass="overflow-visible max-h-fit"
                title={`${modeLabel} Observations`}
              />
            ) : null}

            {info.rationale ? (
              <DebugSection
                content={info.rationale}
                isJson={false}
                maxHeightClass="overflow-visible max-h-fit"
                title={`${modeLabel} Rationale`}
              />
            ) : null}
          </>
        ) : (
          <>
            <DebugSection
              content={info.systemInstruction ?? 'N/A'}
              isJson={false}
              title={`${modeLabel} System Prompt`}
            />

            {info.jsonSchema ? (
              <>
                <DebugSection
                  content={info.jsonSchema}
                  title="Raw Schema"
                />

                <DebugSection
                  content={jsonSchemaToPrompt(info.jsonSchema as JsonSchema)}
                  isJson={false}
                  title="Schema as Prompt"
                />
              </>
            ) : null}
          </>
        )}
      </div>
    );
  };

  const loremasterInfo = debugPacket?.loremasterDebugInfo;

  return (
    <>
      <div className="my-2 flex flex-wrap gap-2">
        <Button
          ariaLabel="Show request and response"
          label="Req/Res"
          onClick={handleShowReqRes}
          preset={view === 'reqres' ? 'sky' : 'slate'}
          pressed={view === 'reqres'}
          size="sm"
          variant="toggle"
        />

        <Button
          ariaLabel="Show insights"
          label="Insights"
          onClick={handleShowInsights}
          preset={view === 'insights' ? 'sky' : 'slate'}
          pressed={view === 'insights'}
          size="sm"
          variant="toggle"
        />

        <Button
          ariaLabel="Show system prompt"
          label="Prompt"
          onClick={handleShowPrompt}
          preset={view === 'prompt' ? 'sky' : 'slate'}
          pressed={view === 'prompt'}
          size="sm"
          variant="toggle"
        />
      </div>

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

          {renderMode('Journal', loremasterInfo.journal)}
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
