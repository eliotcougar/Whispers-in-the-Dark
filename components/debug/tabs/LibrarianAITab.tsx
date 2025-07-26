import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { jsonSchemaToPrompt, JsonSchema } from '../../../utils/schemaPrompt';
import { filterObservationsAndRationale, decodeEscapedString } from './tabUtils';

interface LibrarianAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function LibrarianAITab({ debugPacket }: LibrarianAITabProps) {
  const [showRaw, setShowRaw] = useState(true);
  const [view, setView] = useState<'reqres' | 'insights' | 'prompt'>('reqres');

  const handleShowRaw = useCallback(() => { setShowRaw(true); }, []);
  const handleShowParsed = useCallback(() => { setShowRaw(false); }, []);
  const handleShowReqRes = useCallback(() => { setView('reqres'); }, []);
  const handleShowInsights = useCallback(() => { setView('insights'); }, []);
  const handleShowPrompt = useCallback(() => { setView('prompt'); }, []);

  return debugPacket?.librarianDebugInfo ? (
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

      {view === 'reqres' ? (
        <>
          <DebugSection
            content={debugPacket.librarianDebugInfo.prompt}
            isJson={false}
            title="Librarian AI Request"
          />

          <div className="my-2 flex flex-wrap gap-2">
            <Button
              ariaLabel="Show raw inventory response"
              label="Raw"
              onClick={handleShowRaw}
              preset={showRaw ? 'sky' : 'slate'}
              pressed={showRaw}
              size="sm"
              variant="toggle"
            />

            <Button
              ariaLabel="Show parsed inventory response"
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
              content={filterObservationsAndRationale(debugPacket.librarianDebugInfo.rawResponse)}
              isJson={false}
              title="Librarian AI Response Raw"
            />
          ) : (
            <DebugSection
              content={debugPacket.librarianDebugInfo.parsedItemChanges}
              title="Librarian AI Response Parsed"
            />
          )}
        </>
      ) : view === 'insights' ? (
        <>
          {debugPacket.librarianDebugInfo.thoughts && debugPacket.librarianDebugInfo.thoughts.length > 0 ? (
            <DebugSection
              content={debugPacket.librarianDebugInfo.thoughts.map(decodeEscapedString).join('\n')}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Librarian Thoughts"
            />
          ) : null}

          {debugPacket.librarianDebugInfo.observations ? (
            <DebugSection
              content={debugPacket.librarianDebugInfo.observations}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Librarian Observations"
            />
          ) : null}

          {debugPacket.librarianDebugInfo.rationale ? (
            <DebugSection
              content={debugPacket.librarianDebugInfo.rationale}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Librarian Rationale"
            />
          ) : null}
        </>
      ) : (
        <>
          <DebugSection
            content={debugPacket.librarianDebugInfo.systemInstruction ?? 'N/A'}
            isJson={false}
            title="System Prompt"
          />

          {debugPacket.librarianDebugInfo.jsonSchema ? (
            <>
              <DebugSection
                content={debugPacket.librarianDebugInfo.jsonSchema}
                title="Raw Schema"
              />

              <DebugSection
                content={jsonSchemaToPrompt(debugPacket.librarianDebugInfo.jsonSchema as JsonSchema)}
                isJson={false}
                title="Schema as Prompt"
              />
            </>
          ) : null}
        </>
      )}
    </>
  ) : (
    <p className="italic text-slate-300">
      No Librarian AI interaction debug packet captured.
    </p>
  );
}

export default LibrarianAITab;
