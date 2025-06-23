import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { filterObservationsAndRationale } from './tabUtils';

interface LoremasterAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function LoremasterAITab({ debugPacket }: LoremasterAITabProps) {
  const [showRaw, setShowRaw] = useState(true);

  const handleShowRaw = useCallback(() => { setShowRaw(true); }, []);
  const handleShowParsed = useCallback(() => { setShowRaw(false); }, []);

  return debugPacket?.loremasterDebugInfo ? (
    <>
      <DebugSection
        content={debugPacket.loremasterDebugInfo.prompt}
        isJson={false}
        title="Loremaster AI Request"
      />

      <div className="my-2 flex flex-wrap gap-2">
        <Button
          ariaLabel="Show raw loremaster response"
          label="Raw"
          onClick={handleShowRaw}
          preset={showRaw ? 'sky' : 'slate'}
          pressed={showRaw}
          size="sm"
          variant="toggle"
        />

        <Button
          ariaLabel="Show parsed loremaster response"
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
          content={filterObservationsAndRationale(debugPacket.loremasterDebugInfo.rawResponse)}
          isJson={false}
          title="Loremaster AI Response Raw"
        />
      ) : (
        <DebugSection
          content={debugPacket.loremasterDebugInfo.parsedPayload}
          title="Loremaster AI Response Parsed"
        />
      )}

      {debugPacket.loremasterDebugInfo.observations ? (
        <DebugSection
          content={debugPacket.loremasterDebugInfo.observations}
          isJson={false}
          title="Loremaster Observations"
        />
      ) : null}

      {debugPacket.loremasterDebugInfo.rationale ? (
        <DebugSection
          content={debugPacket.loremasterDebugInfo.rationale}
          isJson={false}
          title="Loremaster Rationale"
        />
      ) : null}
    </>
  ) : (
    <p className="italic text-slate-300">
      No Loremaster AI interaction debug packet captured.
    </p>
  );
}

export default LoremasterAITab;
