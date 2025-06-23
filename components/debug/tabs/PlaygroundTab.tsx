import type { IconName } from '../../elements/icons';
import { Icon } from '../../elements/icons';
import { useCallback } from 'react';
import Button, { type ButtonProps } from '../../elements/Button';

const presets: Array<NonNullable<ButtonProps['preset']>> = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];

const variants: Array<ButtonProps['variant']> = [
  'standard',
  'center',
  'compact',
  'toolbar',
  'toggle',
  'close',
  'tab',
];

const iconNames: Array<IconName> = [
  'realityShift',
  'coin',
  'visualize',
  'bookOpen',
  'menu',
  'info',
  'scroll',
  'map',
  'inventory',
  'trash',
  'log',
  'companion',
  'nearbyNpc',
  'mapItemBox',
  'mapWheel',
  'clock',
  'error',
  'x',
];

function PlaygroundTab() {
  const noop = useCallback(() => {
    // noop for design showcase
  }, []);
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg text-slate-300 mb-2">
          Buttons
        </h3>

        {variants.map(variant => (
          <div
            className="mb-4"
            key={variant}
          >
            <h4 className="text-slate-400 mb-1">
              {variant}
            </h4>

            <div className="flex flex-wrap gap-1">
              {presets.map(preset => (
                <Button
                  ariaLabel={`${String(variant)}-${String(preset)}`}
                  key={`${String(variant)}-${String(preset)}`}
                  label={preset}
                  onClick={noop}
                  preset={preset}
                  size="sm"
                  variant={variant}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3 className="text-lg text-slate-300 mb-2">
          Text Fields
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {presets.slice(0, 8).map(color => (
            <input
              aria-label={color}
              className={`p-2 rounded-md bg-${String(color)}-700 text-${String(color)}-200 border border-${String(color)}-500`}
              key={color}
              placeholder={color}
              readOnly
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg text-slate-300 mb-2">
          Page Blocks
        </h3>

        <div className="space-y-3">
          {['handwritten', 'typed', 'printed', 'digital', 'gothic', 'runic'].map(style => (
            <div
              className={`p-3 tag-${String(style)} rounded-md`}
              key={style}
            >
              {style}
            </div>
          ))}

          {['faded', 'smudged', 'torn', 'glitching', 'encrypted', 'foreign', 'bloodstained', 'water-damaged', 'recovered'].map(tag => (
            <div
              className={`p-3 tag-handwritten tag-${String(tag)} rounded-md`}
              key={tag}
            >
              {tag}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg text-slate-300 mb-2">
          Icons
        </h3>

        <div className="flex flex-wrap gap-3">
          {iconNames.map(name => (
            <div
              className="flex flex-col items-center text-slate-300"
              key={name}
            >
              <Icon
                name={name}
                size={32}
              />

              <span className="text-xs mt-1">
                {name}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default PlaygroundTab;
