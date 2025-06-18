
/**
 * @file GameLogDisplay.tsx
 * @description Shows the running log of game events.
 */
import { useRef } from 'react';

import { Icon } from './icons.tsx';

interface GameLogDisplayProps {
  readonly messages: string[];
}

/**
 * Shows a scrollable log of important game events.
 */
function GameLogDisplay({ messages }: GameLogDisplayProps) {
  const logEndRef = useRef<null | HTMLDivElement>(null);
  return (
    <div className="mt-6 bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 max-h-80 overflow-y-auto">
      <h3 className="text-xl font-bold text-emerald-400 mb-4 border-b-2 border-emerald-700 pb-2 flex items-center">
        <Icon name="log" className="h-5 w-5 mr-2 inline-block text-emerald-400" />

        {' '}
        Game Log
      </h3>

      <ul className="space-y-2 text-sm">
        {(() => {
          const counts = new Map<string, number>();
          return messages.map(message => {
            const count = counts.get(message) ?? 0;
            counts.set(message, count + 1);
            return (
              <li className="text-slate-400 leading-snug" key={`${message}-${count}`}>
                <span className="text-emerald-500">
                  &raquo;
                </span>{' '}
                {message}
              </li>
            );
          });
        })()}

        <div ref={logEndRef} />
      </ul>
    </div>
  );
}

export default GameLogDisplay;
