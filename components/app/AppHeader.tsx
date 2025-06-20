import { AdventureTheme } from '../../types';

interface AppHeaderProps {
  readonly hasGameBeenInitialized: boolean;
  readonly isCustomGameMode: boolean;
  readonly currentTheme: AdventureTheme | null;
}

function AppHeader({
  hasGameBeenInitialized,
  isCustomGameMode,
  currentTheme,
}: AppHeaderProps) {
  return (
    <header className="w-full max-w-screen-xl mb-6 text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-sky-400 tracking-wider title-font">
        Whispers in the Dark
      </h1>

      <p className="text-slate-300 text-lg">
        An Adventure in Shifting Realities
      </p>

      {hasGameBeenInitialized ? (
        <p>
          {isCustomGameMode ? (
            <span className="block text-xs text-orange-400">
              (Custom Game - Random Shifts Disabled)
            </span>
          ) : null}

          {currentTheme ? (
            <span className="block text-xs text-purple-400">

              {currentTheme.name}
            </span>
          ) : null}
        </p>
      ) : null}
    </header>
  );
}

export default AppHeader;
