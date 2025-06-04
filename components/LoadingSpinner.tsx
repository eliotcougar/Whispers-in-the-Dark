
/**
 * @file LoadingSpinner.tsx
 * @description Loading spinner indicating in-progress actions.
 */
import React from 'react';
import { LoadingReason } from '../types'; // Import LoadingReason

interface LoadingSpinnerProps {
  loadingReason?: LoadingReason; 
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ loadingReason }) => {
  const spinnerBaseClass = "rounded-full h-16 w-16 border-t-4 border-b-4";
  const spinnerClass = `${spinnerBaseClass} animate-spin border-sky-600`;
  const textColor = "text-sky-400";
  
  let textMessage = "Loading..."; // Default
  
  switch (loadingReason) {
    case 'initial_load':
      textMessage = "Loading game data...";
      break;
    case 'reality_shift_load':
      textMessage = "Reality is shifting...";
      break;
    case 'storyteller':
      textMessage = "The Dungeon Master is thinking...";
      break;
    case 'map':
      textMessage = "Updating the map...";
      break;
    case 'correction':
      textMessage = "Fixing mistakes...";
      break;
    case 'dialogue_turn':
      textMessage = "The conversation continues...";
      break;
    case 'dialogue_summary': 
      textMessage = "Concluding dialogue...";
      break;
    case 'dialogue_memory_creation': 
      textMessage = "Processing dialogue memories..."; 
      break;
    case 'dialogue_conclusion_summary': 
      textMessage = "Finalizing conversation results..."; 
      break;
    default:
      if (loadingReason === null) { 
          textMessage = "The Dungeon Master is thinking...";
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
