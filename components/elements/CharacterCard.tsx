import { useCallback } from 'react';
import type { CharacterOption } from '../../types';
import Button from './Button';

interface CharacterCardProps {
  readonly option: CharacterOption;
  readonly onSelect: (option: CharacterOption) => void;
  readonly disabled?: boolean;
}

function CharacterCard({ option, onSelect, disabled = false }: CharacterCardProps) {
  const handleClick = useCallback(() => { onSelect(option); }, [onSelect, option]);

  return (
    <Button
      ariaLabel={`Select character ${option.name}${disabled ? ' (selected)' : ''}`}
      disabled={disabled}
      label={(
        <div
          className="flex flex-col items-start text-left w-full"
          style={{ minHeight: '120px' }}
        >
          <h3 className="text-xl font-semibold text-amber-400 mb-2">
            {option.name}
          </h3>

          <p className="text-sm text-slate-300 leading-snug line-clamp-8">
            {option.description}
          </p>

          {disabled ? (
            <p className="text-xs text-orange-300 mt-1 italic">
              (Selected)
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

CharacterCard.defaultProps = { disabled: false };

export default CharacterCard;
