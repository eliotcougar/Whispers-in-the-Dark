import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { decodeEscapedString } from './tabUtils';

interface MainAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function MainAITab({ debugPacket }: MainAITabProps) {
  const [showRaw, setShowRaw] = useState(true);
  const [showExtras, setShowExtras] = useState(false);

  const handleShowRaw = useCallback(() => { setShowRaw(true); }, []);
  const handleShowParsed = useCallback(() => { setShowRaw(false); }, []);
  const handleShowReqRes = useCallback(() => { setShowExtras(false); }, []);
  const handleShowInsights = useCallback(() => { setShowExtras(true); }, []);

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
      ) : (
        debugPacket?.storytellerThoughts && debugPacket.storytellerThoughts.length > 0 ? (
          <DebugSection
            content={debugPacket.storytellerThoughts.map(decodeEscapedString).join('\n')}
            isJson={false}
            title="Storyteller Thoughts"
          />
        ) : null
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
