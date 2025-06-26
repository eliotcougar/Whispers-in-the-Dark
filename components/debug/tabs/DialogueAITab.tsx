import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { decodeEscapedString } from './tabUtils';

interface DialogueAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function DialogueAITab({ debugPacket }: DialogueAITabProps) {
  const [showExtras, setShowExtras] = useState(false);

  const handleShowReqRes = useCallback(() => { setShowExtras(false); }, []);
  const handleShowInsights = useCallback(() => { setShowExtras(true); }, []);

  return debugPacket?.dialogueDebugInfo ? (
    <>
      <div className="my-2 flex flex-wrap gap-2">
        <Button
          ariaLabel="Show request and response"
          label="Req/Res"
          onClick={handleShowReqRes}
          preset={!showExtras ? 'sky' : 'slate'}
          pressed={!showExtras}
          size="sm"
          variant="toggle"
        />

        <Button
          ariaLabel="Show insights"
          label="Insights"
          onClick={handleShowInsights}
          preset={showExtras ? 'sky' : 'slate'}
          pressed={showExtras}
          size="sm"
          variant="toggle"
        />
      </div>

      {!showExtras ? (
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
      ) : (
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
      )}
    </>
  ) : (
    <p className="italic text-slate-300">
      No Dialogue debug info captured.
    </p>
  )
}

export default DialogueAITab;
