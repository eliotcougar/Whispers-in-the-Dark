/**
 * @file MapControls.tsx
 * @description UI component displaying map layout sliders and actions.
 */

import { useCallback, useState } from 'react';
import Button from '../elements/Button';

import ParameterControl from './ParameterControl';

interface MapControlsProps {
  readonly padding: number;
  readonly setPadding: (val: number) => void;
  readonly anglePadding: number;
  readonly setAnglePadding: (val: number) => void;
  readonly overlapMargin: number;
  readonly setOverlapMargin: (val: number) => void;
  readonly itemIconScale: number;
  readonly setItemIconScale: (val: number) => void;
  readonly onReset: () => void;
  readonly onRefreshLayout: () => void;
}


/**
 * Collapsible panel for adjusting map layout parameters.
 */
function MapControls(props: MapControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const handleToggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);
  const {
    padding,
    setPadding,
    anglePadding,
    setAnglePadding,
    overlapMargin,
    setOverlapMargin,
    itemIconScale,
    setItemIconScale,
    onReset,
    onRefreshLayout
  } = props;

  return (
    <div className={`map-controls-container ${expanded ? 'controls-expanded' : ''}`}>
      {expanded ? <div className="map-layout-sliders-wrapper">
        <ParameterControl
          explanation="Distance between parent and child levels"
          id="layoutPadding"
          label="Padding"
          max={60}
          min={5}
          onChange={setPadding}
          step={1}
          value={padding}
        />

        <ParameterControl
          explanation="Extra spacing between siblings"
          id="layoutAnglePadding"
          label="Angle Padding"
          max={0.5}
          min={0}
          onChange={setAnglePadding}
          step={0.01}
          value={anglePadding}
        />

        <ParameterControl
          explanation="Extra spacing when labels overlap"
          id="overlapMargin"
          label="Overlap Margin"
          max={10}
          min={0}
          onChange={setOverlapMargin}
          step={1}
          value={overlapMargin}
        />

        <ParameterControl
          explanation="Relative size of item markers"
          id="itemIconScale"
          label="Icon Size"
          max={1.0}
          min={0.2}
          onChange={setItemIconScale}
          step={0.1}
          value={itemIconScale}
        />

        <div className="mt-2">
          <Button
            ariaLabel="Reset to Defaults"
            label="Reset to Defaults"
            onClick={onReset}
            preset="orange"
            variant="standard"
          />
        </div>
      </div> : null}

      <div className="map-action-buttons-row">
        <Button
          ariaLabel="Toggle Layout Controls"
          label={`${expanded ? 'Hide' : 'Show'} Layout Controls`}
          onClick={handleToggleExpanded}
          preset="blue"
          size='sm'
          variant="compact"
        />

        <Button
          ariaLabel="Refresh Layout"
          label="Refresh Layout"
          onClick={onRefreshLayout}
          preset="blue"
          size='sm'
          variant="compact"
        />
      </div>
    </div>
  );
}

export default MapControls;
