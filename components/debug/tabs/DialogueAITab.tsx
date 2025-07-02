import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { jsonSchemaToPrompt, JsonSchema } from '../../../utils/schemaPrompt';
import { decodeEscapedString } from './tabUtils';

interface DialogueAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function DialogueAITab({ debugPacket }: DialogueAITabProps) {
  const [view, setView] = useState<'reqres' | 'insights' | 'prompt'>('reqres');

  const handleShowReqRes = useCallback(() => { setView('reqres'); }, []);
  const handleShowInsights = useCallback(() => { setView('insights'); }, []);
  const handleShowPrompt = useCallback(() => { setView('prompt'); }, []);

  return debugPacket?.dialogueDebugInfo ? (
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
          {debugPacket.dialogueDebugInfo.turns.map((t, idx) => {
            const thoughtsText = t.thoughts && t.thoughts.length > 0
              ? t.thoughts.map(th => `Narrator THOUGHTS: "${decodeEscapedString(th)}"`).join('\n')
              : null;
            const responseWithThoughts = thoughtsText ? `${thoughtsText}\n${t.rawResponse}` : t.rawResponse;
            return (
              <div
                className="mb-2"
                key={t.prompt}
              >
                <DebugSection
                  content={t.prompt}
                  isJson={false}
                  title={`Turn ${String(idx + 1)} Request`}
                />

                <DebugSection
                  content={responseWithThoughts}
                  isJson={false}
                  title={`Turn ${String(idx + 1)} Response`}
                />
              </div>
            );
          })}
        </>
      ) : view === 'insights' ? (
        <>
          {debugPacket.dialogueDebugInfo.summaryThoughts &&
          debugPacket.dialogueDebugInfo.summaryThoughts.length > 0 ? (
            <DebugSection
              content={debugPacket.dialogueDebugInfo.summaryThoughts.map(decodeEscapedString).join('\n')}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Dialogue Summary Thoughts"
            />
          ) : null}

          {debugPacket.dialogueDebugInfo.summaryPrompt ? (
            <DebugSection
              content={debugPacket.dialogueDebugInfo.summaryPrompt}
              isJson={false}
              title="Dialogue Summary Prompt"
            />
          ) : null}

          {debugPacket.dialogueDebugInfo.summaryRawResponse ? (
            <DebugSection
              content={debugPacket.dialogueDebugInfo.summaryRawResponse}
              isJson={false}
              title="Dialogue Summary Response"
            />
          ) : null}
        </>
      ) : (
        <>
          <DebugSection
            content={debugPacket.dialogueDebugInfo.systemInstruction ?? 'N/A'}
            isJson={false}
            title="System Prompt"
          />

          {debugPacket.dialogueDebugInfo.jsonSchema ? (
            <>
              <DebugSection
                content={debugPacket.dialogueDebugInfo.jsonSchema}
                title="Raw Schema"
              />

              <DebugSection
                content={jsonSchemaToPrompt(debugPacket.dialogueDebugInfo.jsonSchema as JsonSchema)}
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
      No Dialogue debug info captured.
    </p>
  )
}

export default DialogueAITab;
