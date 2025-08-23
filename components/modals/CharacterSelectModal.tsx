import { useCallback, useState } from 'react';
import type { AdventureTheme, WorldFacts, CharacterOption, HeroSheet, HeroBackstory, StoryArc } from '../../types';
import Button from '../elements/Button';
import CharacterCard from '../elements/CharacterCard';
import LoadingSpinner from '../LoadingSpinner';
import { Icon } from '../elements/icons';
import { generateHeroData } from '../../services/worldData';

interface CharacterSelectModalProps {
  readonly isVisible: boolean;
  readonly theme: AdventureTheme;
  readonly heroGender: string;
  readonly worldFacts: WorldFacts;
  readonly options: Array<CharacterOption>;
  readonly onComplete: (
    result: {
      name: string;
      heroSheet: HeroSheet | null;
      heroBackstory: HeroBackstory | null;
      storyArc: StoryArc | null;
    }
  ) => void;
}

function CharacterSelectModal({ isVisible, theme, heroGender, worldFacts, options, onComplete }: CharacterSelectModalProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [heroSheet, setHeroSheet] = useState<HeroSheet | null>(null);
  const [heroBackstory, setHeroBackstory] = useState<HeroBackstory | null>(null);
  const [storyArc, setStoryArc] = useState<StoryArc | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSelect = useCallback(
    (option: CharacterOption) => {
      setSelectedName(option.name);
      setIsGenerating(true);
      void (async () => {
        const result = await generateHeroData(
          theme,
          heroGender,
          worldFacts,
          option.name,
          option.description,
        );
        setHeroSheet(result?.heroSheet ?? null);
        setHeroBackstory(result?.heroBackstory ?? null);
        setStoryArc(result?.storyArc ?? null);
        setIsGenerating(false);
      })();
    },
    [theme, heroGender, worldFacts]
  );

  const handleBegin = useCallback(() => {
    if (!selectedName) return;
    onComplete({ name: selectedName, heroSheet, heroBackstory, storyArc });
  }, [selectedName, heroSheet, heroBackstory, storyArc, onComplete]);

  const renderOption = useCallback(
    (opt: CharacterOption) => (
      <CharacterCard
        disabled={selectedName === opt.name}
        key={opt.name}
        onSelect={handleSelect}
        option={opt}
      />
    ),
    [selectedName, handleSelect]
  );

  if (!isVisible) return null;

  return (
    <div
      aria-labelledby="character-select-title"
      aria-modal="true"
      className="animated-frame open"
      role="dialog"
    >
      <div className="animated-frame-content character-select-content-area flex max-h-[80vh] w-full flex-col items-center p-8 text-center">
        <h1
          className="mb-4 text-center text-3xl font-bold text-sky-300"
          id="character-select-title"
        >
          Choose Your Character
        </h1>

        <p className="mb-6 max-w-2xl text-center text-sm text-slate-300">
          Explore the world of{' '}
          <span className="font-semibold">{theme.name}</span>
          {'. '}
          Select a character to begin your adventure.
        </p>

        {isGenerating ? (
          <LoadingSpinner />
        ) : heroSheet && heroBackstory ? (
          <>
            <div className="mt-4 w-4/5 flex-1 max-h-[60vh] overflow-y-auto rounded p-4 text-left text-slate-300 space-y-8">
              <section className="space-y-2 text-lg">
                <h2 className="text-center font-semibold text-amber-400">
                  {heroSheet.name}
                </h2>

                <p className="text-center">
                  Occupation: {heroSheet.occupation}
                </p>

                <p className="text-center">
                  Traits: {heroSheet.traits.join(', ')}
                </p>

                <p className="text-center">
                  Starting Items: {heroSheet.startingItems.join(', ')}
                </p>
              </section>

              <section className="space-y-2 text-lg">
                <h3 className="text-center font-semibold">
                  Backstory
                </h3>

                <ul className="list-inside list-disc space-y-2 whitespace-pre-line">
                  <li>
                    5 years ago: {heroBackstory.fiveYearsAgo}
                  </li>

                  <li>
                    1 year ago: {heroBackstory.oneYearAgo}
                  </li>

                  <li>
                    6 months ago: {heroBackstory.sixMonthsAgo}
                  </li>

                  <li>
                    1 month ago: {heroBackstory.oneMonthAgo}
                  </li>

                  <li>
                    1 week ago: {heroBackstory.oneWeekAgo}
                  </li>

                  <li>
                    Yesterday: {heroBackstory.yesterday}
                  </li>

                  <li>
                    Now: {heroBackstory.now}
                  </li>
                </ul>
              </section>

              <section className="space-y-2 text-lg">
                <h3 className="text-center font-semibold text-sky-300">
                  World Information
                </h3>

                <p>
                  Geography: {worldFacts.geography}
                </p>

                <p>
                  Climate: {worldFacts.climate}
                </p>

                <p>
                  Technology Level: {worldFacts.technologyLevel}
                </p>

                <p>
                  Supernatural Elements: {worldFacts.supernaturalElements}
                </p>

                <p>
                  Major Factions: {worldFacts.majorFactions.join(', ')}
                </p>

                <p>
                  Key Resources: {worldFacts.keyResources.join(', ')}
                </p>

                <p>
                  Cultural Notes: {worldFacts.culturalNotes.join(', ')}
                </p>

                <p>
                  Notable Locations: {worldFacts.notableLocations.join(', ')}
                </p>
              </section>
            </div>

            <div className="mt-8 self-center">
              <Button
                ariaLabel="Begin the adventure"
                icon={
                  <Icon name="bookOpen" size={20} />
                }
                label="Begin the Journey"
                onClick={handleBegin}
                preset="green"
                size="lg"
              />
            </div>
          </>
        ) : (
          <div className="mt-4 w-4/5 flex-1 grid grid-cols-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
            {options.map(renderOption)}
          </div>
        )}
      </div>
    </div>
  );
}

export default CharacterSelectModal;
