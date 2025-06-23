import { useCallback } from 'react';
import {
  ICON_NAMES,
  Icon,
  type IconName,
} from '../../elements/icons';
import Button, {
  BUTTON_PRESETS,
  BUTTON_VARIANTS,
  type ButtonProps,
} from '../../elements/Button';
import {
  TEXT_STYLE_TAGS,
  WRITING_TAGS,
} from '../../../constants';

const presets: Array<NonNullable<ButtonProps['preset']>> = [...BUTTON_PRESETS];

const variants: Array<ButtonProps['variant']> = [...BUTTON_VARIANTS];

const iconNames: Array<IconName> = [...ICON_NAMES];

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
          {[...TEXT_STYLE_TAGS, 'gothic', 'runic'].map(style => (
            <div
              className={`p-3 tag-${String(style)} rounded-md`}
              key={style}
            >
              {style}
            </div>
          ))}

          {WRITING_TAGS.filter(
            tag =>
              ![...TEXT_STYLE_TAGS, 'gothic', 'runic'].includes(tag as string),
          ).map(tag => (
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
