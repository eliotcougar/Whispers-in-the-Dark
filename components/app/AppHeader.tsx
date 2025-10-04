import { AdventureTheme } from '../../types';

interface AppHeaderProps {
  readonly hasGameBeenInitialized: boolean;
  readonly theme: AdventureTheme | null;
}

function AppHeader({ hasGameBeenInitialized, theme }: AppHeaderProps) {
  return (
    <header className="w-full max-w-screen-xl mb-6 text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-sky-400 tracking-wider title-font">
        Whispers in the Dark
      </h1>

      <p className="text-slate-300 text-lg">
        An AI-Powered Adventure
      </p>

      {hasGameBeenInitialized ? (
        <p>
          {theme ? (
            <span className="block text-xs text-purple-400">

              {theme.name}
            </span>
          ) : null}
        </p>
      ) : null}
    </header>
  );
}

export default AppHeader;
