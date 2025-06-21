import { useEffect, useState } from 'react';
import { Item } from '../../types';
import { rot13 } from '../../utils/textTransforms';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';
import LoadingSpinner from '../LoadingSpinner';
import { generatePageText } from '../../services/page';

interface PageViewProps {
  readonly item: Item | null;
  readonly context: string;
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly updateItemContent: (itemId: string, actual: string, visible: string) => void;
}

function PageView({ item, context, isVisible, onClose, updateItemContent }: PageViewProps) {
  const [text, setText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVisible && item) {
      if (item.visibleContent) {
        setText(item.visibleContent);
      } else {
        setIsLoading(true);
        void (async () => {
          const length = item.contentLength ?? 30;
          const actual = await generatePageText(
            item.name,
            item.description,
            length,
            context,
            'Write it exclusively in English without any foreign, encrypted, or gibberish text.'
          );
          if (actual) {
            let visible = actual;
            if (item.tags?.includes('foreign')) {
              const fake = await generatePageText(
                item.name,
                item.description,
                length,
                context,
                'Generate text exclusively in an artificial nonexistent language without any English words.'
              );
              visible = fake ?? actual;
            } else if (item.tags?.includes('encrypted')) {
              visible = rot13(actual);
            }
            updateItemContent(item.id, actual, visible);
            setText(visible);
          }
          setIsLoading(false);
        })();
      }
    } else {
      setText(null);
    }
  }, [isVisible, item, context, updateItemContent]);

  return (
    <div
      aria-modal="true"
      className={`animated-frame ${isVisible ? 'open' : ''}`}
      role="dialog"
    >
      <div className="animated-frame-content page-view-content-area">
        <Button
          ariaLabel="Close page"
          icon={(
            <Icon
              name="x"
              size={20}
            />
          )}
          onClick={onClose}
          size="sm"
          variant="close"
        />

        {isLoading ? (
          <LoadingSpinner loadingReason="page" />
        ) : text ? (
          <div
            className={`whitespace-pre-wrap text-lg overflow-y-auto p-5 mt-4 ${(() => {
              const tags = item?.tags ?? [];
              const classes: Array<string> = [];
              const hasForeign = tags.includes('foreign');

              if (tags.includes('handwritten')) {
                classes.push(
                  hasForeign ? 'tag-handwritten-foreign' : 'tag-handwritten',
                );
              } else if (tags.includes('typed')) {
                classes.push(hasForeign ? 'tag-typed-foreign' : 'tag-typed');
              } else if (tags.includes('digital')) {
                classes.push(hasForeign ? 'tag-digital-foreign' : 'tag-digital');
              }

              if (tags.includes('faded')) classes.push('tag-faded');
              if (tags.includes('smudged')) classes.push('tag-smudged');
              if (tags.includes('torn')) classes.push('tag-torn');
              if (tags.includes('glitching')) classes.push('tag-glitching');
              if (tags.includes('encrypted')) classes.push('tag-encrypted');
              if (tags.includes('foreign')) classes.push('tag-foreign');
              if (tags.includes('runic')) classes.push('tag-runic');
              if (tags.includes('bloodstained')) classes.push('tag-bloodstained');
              if (tags.includes('water-damaged')) classes.push('tag-water-damaged');

              return classes.join(' ');
            })()}`}
          >
            {text}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PageView;
