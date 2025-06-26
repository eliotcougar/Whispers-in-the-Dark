import { useCallback, useState } from 'react';
import Button from '../../elements/Button';
import DebugSection from '../DebugSection';
import type { DebugPacket } from '../../../types';
import { filterObservationsAndRationale, decodeEscapedString } from './tabUtils';

interface InventoryAITabProps {
  readonly debugPacket: DebugPacket | null;
}

function InventoryAITab({ debugPacket }: InventoryAITabProps) {
  const [showRaw, setShowRaw] = useState(true);
  const [showExtras, setShowExtras] = useState(false);

  const handleShowRaw = useCallback(() => { setShowRaw(true); }, []);
  const handleShowParsed = useCallback(() => { setShowRaw(false); }, []);
  const handleShowReqRes = useCallback(() => { setShowExtras(false); }, []);
  const handleShowInsights = useCallback(() => { setShowExtras(true); }, []);

  return debugPacket?.inventoryDebugInfo ? (
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
          <DebugSection
            content={debugPacket.inventoryDebugInfo.prompt}
            isJson={false}
            title="Inventory AI Request"
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
              content={filterObservationsAndRationale(debugPacket.inventoryDebugInfo.rawResponse)}
              isJson={false}
              title="Inventory AI Response Raw"
            />
          ) : (
            <DebugSection
              content={debugPacket.inventoryDebugInfo.parsedItemChanges}
              title="Inventory AI Response Parsed"
            />
          )}
        </>
      ) : (
        <>
          {debugPacket.inventoryDebugInfo.thoughts && debugPacket.inventoryDebugInfo.thoughts.length > 0 ? (
            <DebugSection
              content={debugPacket.inventoryDebugInfo.thoughts.map(decodeEscapedString).join('\n')}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Inventory Thoughts"
            />
          ) : null}

          {debugPacket.inventoryDebugInfo.observations ? (
            <DebugSection
              content={debugPacket.inventoryDebugInfo.observations}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Inventory Observations"
            />
          ) : null}

          {debugPacket.inventoryDebugInfo.rationale ? (
            <DebugSection
              content={debugPacket.inventoryDebugInfo.rationale}
              isJson={false}
              maxHeightClass="overflow-visible max-h-fit"
              title="Inventory Rationale"
            />
          ) : null}
        </>
      )}
    </>
  ) : (
    <p className="italic text-slate-300">
      No Inventory AI interaction debug packet captured.
    </p>
  );
}

export default InventoryAITab;
