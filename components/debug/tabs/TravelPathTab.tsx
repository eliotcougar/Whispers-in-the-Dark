import DebugSection from '../DebugSection';
import type { MapData } from '../../../types';
import type { TravelStep } from '../../../utils/mapPathfinding';

interface TravelPathTabProps {
  readonly mapData: MapData;
  readonly travelPath?: Array<TravelStep> | null;
}

function TravelPathTab({ mapData, travelPath }: TravelPathTabProps) {
  if (!travelPath || travelPath.length === 0) {
    return (
      <p className="italic text-slate-300">
        No destination set.
      </p>
    );
  }
  const expanded = travelPath.map(step => {
    if (step.step === 'node') {
      const node = mapData.nodes.find(n => n.id === step.id);
      return { step: 'node', data: node ?? { id: step.id, missing: true } };
    }
    if (step.id.startsWith('hierarchy:')) {
      const [from, to] = step.id.split(':')[1].split('->');
      return { step: 'hierarchy', from, to };
    }
    const edge = mapData.edges.find(e => e.id === step.id);
    return { step: 'edge', data: edge ?? { id: step.id, missing: true } };
  });

  return (
    <>
      <DebugSection
        content={travelPath}
        title="Travel Path (IDs)"
      />

      <DebugSection
        content={expanded}
        maxHeightClass="max-h-[70vh]"
        title="Expanded Path Data"
      />
    </>
  );
}

TravelPathTab.defaultProps = { travelPath: null };

export default TravelPathTab;
