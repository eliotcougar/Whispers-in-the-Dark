
/**
 * @file LoadingSpinner.tsx
 * @description Loading spinner indicating in-progress actions.
 */
import React from 'react';
import { LoadingReason } from '../types'; // Import LoadingReason
import { useLoadingProgress } from '../hooks/useLoadingProgress';

interface LoadingSpinnerProps {
  loadingReason?: LoadingReason;
}

/**
 * Displays a spinner with a reason message while the game is busy.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ loadingReason }) => {
  const { progress } = useLoadingProgress();
  const spinnerBaseClass = "rounded-full h-16 w-16 border-t-4 border-b-4";
  const spinnerClass = `${spinnerBaseClass} animate-spin border-sky-600`;
  const textColor = "text-sky-400";
  
  let textMessage = "Loading..."; // Default
  
  switch (loadingReason) {
    case 'initial_load':
      textMessage = "Loading...";
      break;
    case 'reality_shift_load':
      textMessage = "Reality is shifting...";
      break;
    case 'storyteller':
      textMessage = "Dungeon Master is thinking...";
      break;
    case 'map':
      textMessage = "Dungeon Master is drawing the map...";
      break;
    case 'correction':
      textMessage = "Dungeon Master is fixing mistakes...";
      break;
    case 'inventory':
      textMessage = "Dungeon Master is handling items...";
      break;
    case 'dialogue_turn':
      textMessage = "The conversation continues...";
      break;
    case 'dialogue_summary': 
      textMessage = "Concluding dialogue...";
      break;
    case 'dialogue_memory_creation': 
      textMessage = "Forming memories...";
      break;
    case 'dialogue_conclusion_summary': 
      textMessage = "Returning to the world...";
      break;
    default:
      if (loadingReason === null) { 
          textMessage = "Hmmmmmm...";
      }
      break;
  }

  const progressDisplay = progress
    ? progress + progress.split('').reverse().join('')
    : '';

  return (
    <div
      className={`flex flex-col items-center my-8`}
      role="status"
      aria-live="polite"
    >
      <div className={spinnerClass} aria-hidden="true"></div>
      <p className={`mt-2 text-xl ${textColor}`}>{textMessage}</p>
      {progressDisplay && (
        <div className="mt-2 text-2xl text-sky-300 font-mono">
          {progressDisplay}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;
