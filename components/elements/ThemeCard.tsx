import { useCallback } from 'react';
import type { AdventureTheme } from '../../types';
import Button from './Button';

interface ThemeCardProps {
  readonly theme: AdventureTheme;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
}

function ThemeCard({ theme, onSelect, disabled = false }: ThemeCardProps) {
  const handleClick = useCallback(
    () => { onSelect(); },
    [onSelect]
  );

  return (
    <Button
      ariaLabel={`Start a new game in the theme: ${theme.name}${disabled ? ' (Current theme, cannot select)' : ''}`}
      disabled={disabled}
      label={(
        <div
          className="flex flex-col items-start text-left w-full"
          style={{ minHeight: '180px' }}
        >
          <h3 className="text-xl font-semibold text-amber-400 mb-2">
            {theme.name}
          </h3>

          <p className="text-sm text-slate-300 leading-snug line-clamp-8">
            {theme.initialSceneDescriptionSeed}
          </p>

          {disabled ? (
            <p className="text-xs text-orange-300 mt-1 italic">
              (Currently active theme)
            </p>
          ) : null}
        </div>
      )}
      onClick={handleClick}
      preset="slate"
      variant="standard"
    />
  );
}

ThemeCard.defaultProps = { disabled: false };

export default ThemeCard;
