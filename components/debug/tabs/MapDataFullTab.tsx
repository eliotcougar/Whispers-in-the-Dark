import DebugSection from '../DebugSection';
import type { MapData } from '../../../types';

interface MapDataFullTabProps {
  readonly mapData: MapData;
}

function MapDataFullTab({ mapData }: MapDataFullTabProps) {
  return (
    <DebugSection
      content={mapData}
      maxHeightClass="max-h-[70vh]"
      title="Current Map Data (Full)"
    />
  );
}

export default MapDataFullTab;
