/**
 * @file useGameLogicContext.ts
 * @description Context wrapper for sharing the game logic API across the app.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { UseGameLogicReturn } from './useGameLogic';

const GameLogicContext = createContext<UseGameLogicReturn | null>(null);

interface GameLogicProviderProps {
  readonly value: UseGameLogicReturn;
  readonly children: ReactNode;
}

export function GameLogicProvider({ value, children }: GameLogicProviderProps) {
  return (
    <GameLogicContext.Provider value={value}>
      {children}
    </GameLogicContext.Provider>
  );
}

export function useGameLogicContext(): UseGameLogicReturn {
  const context = useContext(GameLogicContext);
  if (!context) {
    throw new Error('useGameLogicContext must be used within a GameLogicProvider.');
  }
  return context;
}
