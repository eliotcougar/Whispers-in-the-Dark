import { useState, useCallback, useMemo, useEffect } from 'react';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';

interface DebugLoreModalProps {
  readonly isVisible: boolean;
  readonly facts: Array<string>;
  readonly onSubmit: (good: Array<string>, bad: Array<string>, proceed: boolean) => void;
  readonly onClose: () => void;
}

function DebugLoreModal({ isVisible, facts, onSubmit, onClose }: DebugLoreModalProps) {
  const [ratings, setRatings] = useState<Record<number, 'good' | 'bad' | undefined>>({});

  useEffect(() => {
    if (isVisible) {
      setRatings({});
    }
  }, [facts, isVisible]);

  const toggle = useCallback((idx: number, val: 'good' | 'bad') => {
    setRatings(prev => ({ ...prev, [idx]: prev[idx] === val ? undefined : val }));
  }, []);

  const handleOk = useCallback(() => {
    const good: Array<string> = [];
    const bad: Array<string> = [];
    facts.forEach((f, i) => {
      if (ratings[i] === 'good') good.push(f);
      if (ratings[i] === 'bad') bad.push(f);
    });
    onSubmit(good, bad, true);
  }, [facts, ratings, onSubmit]);

  const handleSkip = useCallback(() => {
    onSubmit([], [], false);
  }, [onSubmit]);

  const handleMarkGood = useCallback((idx: number) => {
    toggle(idx, 'good');
  }, [toggle]);

  const handleMarkBad = useCallback((idx: number) => {
    toggle(idx, 'bad');
  }, [toggle]);

  const handleGoodHandlers = useMemo(() => (
    facts.map((_, i) => {
      return () => { handleMarkGood(i); };
    })
  ), [facts, handleMarkGood]);

  const handleBadHandlers = useMemo(() => (
    facts.map((_, i) => {
      return () => { handleMarkBad(i); };
    })
  ), [facts, handleMarkBad]);

  return (
    <div
      aria-labelledby="debug-lore-title"
      aria-modal="true"
      className={`animated-frame debug-lore-frame ${isVisible ? 'open' : ''}`}
      role="dialog"
    >
      <div className="animated-frame-content">
        <Button
          ariaLabel="Close debug lore"
          icon={<Icon name="x" size={20} />}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        <h1 className="text-2xl font-bold text-amber-400 mb-3 text-center" id="debug-lore-title">
          Evaluate Extracted Facts
        </h1>

        <ul className="mb-4 space-y-2">
          {facts.map((fact, idx) => (
            <li className="flex items-start gap-2" key={fact}>
              <span className="flex-grow text-slate-300">{fact}</span>
              <Button
                ariaLabel="Mark good"
                label="Good"
                onClick={handleGoodHandlers[idx]}
                preset="green"
                pressed={ratings[idx] === 'good'}
                size="sm"
                variant="toggle"
              />
              <Button
                ariaLabel="Mark bad"
                label="Bad"
                onClick={handleBadHandlers[idx]}
                preset="red"
                pressed={ratings[idx] === 'bad'}
                size="sm"
                variant="toggle"
              />
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2">
          <Button ariaLabel="Skip" label="Skip" onClick={handleSkip} preset="stone" size="sm" />
          <Button ariaLabel="OK" label="OK" onClick={handleOk} preset="sky" size="sm" />
        </div>
      </div>
    </div>
  );
}

export default DebugLoreModal;
