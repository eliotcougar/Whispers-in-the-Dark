import { useCallback, useState } from 'react';
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
  WRITTEN_TAGS,
} from '../../../constants';

const presets: Array<NonNullable<ButtonProps['preset']>> = [...BUTTON_PRESETS];
const variants: Array<ButtonProps['variant']> = [...BUTTON_VARIANTS];
const iconNames: Array<IconName> = [...ICON_NAMES];

const additionalTags = WRITTEN_TAGS.filter(
  tag =>
    !TEXT_STYLE_TAGS.includes(tag as (typeof TEXT_STYLE_TAGS)[number]) &&
    tag !== 'glitching',
);

function PlaygroundTab() {
  const [pressed, setPressed] = useState<Set<string>>(new Set());

  const handleToggle = useCallback(
    (id: string) => () => {
      setPressed(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    []
  );

  const noop = useCallback(() => {
    // noop for design showcase
  }, []);
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg text-slate-300 mb-2">
          Buttons
        </h3>

        {variants.map(variant => {
          const isToggle = variant === 'toggle';
          const isClose = variant === 'close';
          const buttons = (isClose ? presets.slice(0, 1) : presets);
          return (
            <div
              className="mb-4"
              key={variant}
            >
              <h4 className="text-slate-400 mb-1">
                {variant}
              </h4>

              <div className={`flex flex-wrap gap-1${isClose ? ' relative h-12' : ''}`}>
                {buttons.map(preset => {
                  const id = `${String(variant)}-${String(preset)}`;
                  return (
                    <Button
                      ariaLabel={id}
                      icon={isClose ? (
                        <Icon
                          name="x"
                          size={16}
                        />
                      ) : undefined}
                      key={id}
                      label={isClose ? undefined : preset}
                      onClick={isToggle ? handleToggle(id) : noop}
                      preset={preset}
                      pressed={isToggle ? pressed.has(id) : undefined}
                      size="sm"
                      variant={variant}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            {TEXT_STYLE_TAGS.map(style => (
              <div
                className={`p-3 tag-${String(style)} rounded-md`}
                key={style}
              >
                {style}
              </div>
            ))}

            {TEXT_STYLE_TAGS.flatMap(style =>
              additionalTags.map(tag => (
                <div
                  className={`p-3 tag-${String(style)} tag-${String(tag)} rounded-md`}
                  key={`${style}-${tag}`}
                >
                  {`${style} ${tag}`}
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            {TEXT_STYLE_TAGS.map(style => (
              <div
                className={`p-3 tag-${String(style)} tag-recovered rounded-md`}
                key={`${style}-recovered`}
              >
                {`${style} recovered`}
              </div>
            ))}

            {TEXT_STYLE_TAGS.flatMap(style =>
              additionalTags.map(tag => (
                <div
                  className={`p-3 tag-${String(style)} tag-${String(tag)} tag-recovered rounded-md`}
                  key={`${style}-${tag}-recovered`}
                >
                  {`${style} ${tag} recovered`}
                </div>
              ))
            )}
          </div>
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
