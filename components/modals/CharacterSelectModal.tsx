import { useCallback, useState } from 'react';
import type { AdventureTheme, WorldFacts, CharacterOption, HeroSheet, HeroBackstory } from '../../types';
import Button from '../elements/Button';
import CharacterCard from '../elements/CharacterCard';
import LoadingSpinner from '../LoadingSpinner';
import { Icon } from '../elements/icons';
import { generateHeroData } from '../../services/worldData';

interface CharacterSelectModalProps {
  readonly isVisible: boolean;
  readonly theme: AdventureTheme;
  readonly playerGender: string;
  readonly worldFacts: WorldFacts;
  readonly options: Array<CharacterOption>;
  readonly onComplete: (result: { name: string; heroSheet: HeroSheet | null; heroBackstory: HeroBackstory | null }) => void;
}

function CharacterSelectModal({ isVisible, theme, playerGender, worldFacts, options, onComplete }: CharacterSelectModalProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [heroSheet, setHeroSheet] = useState<HeroSheet | null>(null);
  const [heroBackstory, setHeroBackstory] = useState<HeroBackstory | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSelect = useCallback(
    (option: CharacterOption) => {
      setSelectedName(option.name);
      setIsGenerating(true);
      void (async () => {
        const result = await generateHeroData(
          theme,
          playerGender,
          worldFacts,
          option.name,
          option.description,
        );
        setHeroSheet(result?.heroSheet ?? null);
        setHeroBackstory(result?.heroBackstory ?? null);
        setIsGenerating(false);
      })();
    },
    [theme, playerGender, worldFacts]
  );

  const handleBegin = useCallback(() => {
    if (!selectedName) return;
    onComplete({ name: selectedName, heroSheet, heroBackstory });
  }, [selectedName, heroSheet, heroBackstory, onComplete]);

  const renderOption = useCallback(
    (opt: CharacterOption) => (
      <CharacterCard
        key={opt.name}
        disabled={selectedName === opt.name}
        onSelect={handleSelect}
        option={opt}
      />
    ),
    [selectedName, handleSelect]
  );

  if (!isVisible) return null;

  return (
    <div aria-labelledby="character-select-title" aria-modal="true" className="animated-frame open" role="dialog">
      <div className="animated-frame-content">
        <h1 className="text-3xl font-bold text-sky-300 mb-4 text-center" id="character-select-title">
          Choose Your Hero
        </h1>

        <p className="text-slate-300 mb-6 text-center text-sm max-w-2xl mx-auto">
          Explore the world of {theme.name}. Select a hero to begin your adventure.
        </p>

        {isGenerating ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto px-4">
            {options.map(renderOption)}
          </div>
        )}

        {heroSheet && heroBackstory ? (
          <div className="mt-4 space-y-3 text-slate-300">
            <p className="text-lg font-semibold text-amber-400 text-center">{heroSheet.name}</p>
            <p className="text-center">Occupation: {heroSheet.occupation}</p>
            <p className="text-center">Traits: {heroSheet.traits.join(', ')}</p>
            <p className="text-center">Starting Items: {heroSheet.startingItems.join(', ')}</p>
            <p className="mt-2 whitespace-pre-line text-sm">Backstory:\n- 5 years ago: {heroBackstory.fiveYearsAgo}\n- 1 year ago: {heroBackstory.oneYearAgo}\n- 6 months ago: {heroBackstory.sixMonthsAgo}\n- 1 month ago: {heroBackstory.oneMonthAgo}\n- 1 week ago: {heroBackstory.oneWeekAgo}\n- Yesterday: {heroBackstory.yesterday}</p>
          </div>
        ) : null}

        <div className="mt-6 flex justify-center space-x-4">
          {heroSheet && heroBackstory ? (
            <Button ariaLabel="Begin the adventure" icon={<Icon name="bookOpen" size={20} />} onClick={handleBegin} preset="green" size="lg" label="Begin the Journey" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CharacterSelectModal;
