
/**
 * @file LoadingSpinner.tsx
 * @description Loading spinner indicating in-progress actions.
 */
import React from 'react';
import { LoadingReason } from '../types'; // Import LoadingReason

interface LoadingSpinnerProps {
  loadingReason?: LoadingReason;
}

/**
 * Displays a spinner with a reason message while the game is busy.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ loadingReason }) => {
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

  return (
    <div 
      className={`flex justify-center items-center my-8`} 
      role="status" 
      aria-live="polite"
    >
      <div className={spinnerClass} aria-hidden="true"></div>
      <p className={`ml-4 text-xl ${textColor}`}>{textMessage}</p>
    </div>
  );
};

export default LoadingSpinner;
