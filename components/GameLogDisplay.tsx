
/**
 * @file GameLogDisplay.tsx
 * @description Shows the running log of game events.
 */
import { useRef } from 'react';

import { Icon } from './elements/icons';
import TextBox from './elements/TextBox';

interface GameLogDisplayProps {
  readonly messages: Array<string>;
}

/**
 * Shows a scrollable log of important game events.
 */
function GameLogDisplay({ messages }: GameLogDisplayProps) {
  const logEndRef = useRef<null | HTMLDivElement>(null);
  const header = 'Game Log';
  const headerIcon = (
    <Icon
      color="emerald"
      inline
      marginRight={8}
      name="log"
      size={20}
    />
  );

  const logItems = (() => {
    const counts = new Map<string, number>();
    return messages.map(message => {
      const count = counts.get(message) ?? 0;
      counts.set(message, count + 1);
        return (
          <li
            className="text-slate-200 leading-snug"
            key={`${message}-${String(count)}`}
          >
            <span className="mr-1 text-emerald-500">
              &raquo;
            </span>

            {message}
          </li>
        );
    });
  })();

  return (
    <TextBox
      borderColorClass="border-emerald-700"
      borderWidthClass="border-b-2"
      containerClassName="mt-6 bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 max-h-80 overflow-y-auto"
      contentColorClass=""
      contentFontClass=""
      header={header}
      headerFont="xl"
      headerIcon={headerIcon}
      headerPreset="emerald"
      headerTag="h3"
      headerWrapperClassName="flex items-center"
    >
      <ul className="space-y-2 text-sm">
        {logItems}

        <div ref={logEndRef} />
      </ul>
    </TextBox>
  );
}

export default GameLogDisplay;
