import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { jsonSchemaToPrompt, JsonSchema } from '../../../utils/schemaPrompt';
import { decodeEscapedString } from './tabUtils';

interface MainAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function MainAITab({ debugPacket }: MainAITabProps) {
  const [showRaw, setShowRaw] = useState(true);
  const [view, setView] = useState<'reqres' | 'insights' | 'prompt'>('reqres');

  const handleShowRaw = useCallback(() => { setShowRaw(true); }, []);
  const handleShowParsed = useCallback(() => { setShowRaw(false); }, []);
  const handleShowReqRes = useCallback(() => { setView('reqres'); }, []);
  const handleShowInsights = useCallback(() => { setView('insights'); }, []);
  const handleShowPrompt = useCallback(() => { setView('prompt'); }, []);

  const timestamp = debugPacket?.timestamp ? new Date(debugPacket.timestamp).toLocaleString() : 'N/A';

  return (
    <>
      <p className="text-sm text-slate-300 mb-2">
        Timestamp:
        {timestamp}
      </p>

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

      {view === 'reqres' ? (
        <>
          <DebugSection
            content={debugPacket?.prompt}
            isJson={false}
            title="Last Storyteller AI Request"
          />

          <div className="my-2 flex flex-wrap gap-2">
            <Button
              ariaLabel="Show raw response"
              label="Raw"
              onClick={handleShowRaw}
              preset={showRaw ? 'sky' : 'slate'}
              pressed={showRaw}
              size="sm"
              variant="toggle"
            />

            <Button
              ariaLabel="Show parsed response"
              label="Parsed"
              onClick={handleShowParsed}
              preset={showRaw ? 'slate' : 'sky'}
              pressed={!showRaw}
              size="sm"
              variant="toggle"
            />
          </div>

          {showRaw ? (
            <DebugSection
              content={debugPacket?.rawResponseText}
              isJson={false}
              title="Storyteller AI Response Raw"
            />
          ) : (
            <DebugSection
              content={debugPacket?.parsedResponse}
              title="Storyteller AI Response Parsed "
            />
          )}
        </>
      ) : view === 'insights' ? (
        debugPacket?.storytellerThoughts && debugPacket.storytellerThoughts.length > 0 ? (
          <DebugSection
            content={debugPacket.storytellerThoughts.map(decodeEscapedString).join('\n')}
            isJson={false}
            maxHeightClass="overflow-visible max-h-fit"
            title="Storyteller Thoughts"
          />
        ) : null
      ) : (
        <>
          <DebugSection
            content={debugPacket?.systemInstruction ?? 'N/A'}
            isJson={false}
            title="System Prompt"
          />

          {debugPacket?.jsonSchema ? (
            <>
              <DebugSection
                content={debugPacket.jsonSchema}
                title="Raw Schema"
              />

              <DebugSection
                content={jsonSchemaToPrompt(debugPacket.jsonSchema as JsonSchema)}
                isJson={false}
                title="Schema as Prompt"
              />
            </>
          ) : null}
        </>
      )}

      {debugPacket?.error ? (
        <DebugSection
          content={debugPacket.error}
          isJson={false}
          title="Error During Storyteller AI Interaction"
        />
      ) : null}
    </>
  );
}

export default MainAITab;
