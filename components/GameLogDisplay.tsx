
/**
 * @file GameLogDisplay.tsx
 * @description Shows the running log of game events.
 */
import React, { useEffect, useRef } from 'react';
import { LogIcon } from './icons.tsx'; // Updated import

interface GameLogDisplayProps {
  messages: string[];
}

const GameLogDisplay: React.FC<GameLogDisplayProps> = ({ messages }) => {
  const logEndRef = useRef<null | HTMLDivElement>(null);
  return (
    <div className="mt-6 bg-slate-800 p-6 rounded-lg shadow-lg border border-slate-700 max-h-80 overflow-y-auto">
      <h3 className="text-xl font-bold text-emerald-400 mb-4 border-b-2 border-emerald-700 pb-2 flex items-center">
        <LogIcon /> Game Log
      </h3>
      <ul className="space-y-2 text-sm">
        {messages.map((message, index) => (
          <li key={index} className="text-slate-400 leading-snug">
            <span className="text-emerald-500">&raquo;</span> {message}
          </li>
        ))}
        <div ref={logEndRef} />
      </ul>
    </div>
  );
};

export default GameLogDisplay;
