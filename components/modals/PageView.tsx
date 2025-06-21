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
            'Write it in English.'
          );
          if (actual) {
            let visible = actual;
            if (item.tags?.includes('foreign')) {
              const fake = await generatePageText(
                item.name,
                item.description,
                length,
                context,
                'Generate text in an artificial nonexistent language.'
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
            className={`whitespace-pre-wrap text-slate-200 text-lg overflow-y-auto mt-4 ${(() => {
              const font = item?.tags?.includes('handwritten')
                ? 'font-handwritten'
                : item?.tags?.includes('typed')
                  ? 'font-typed'
                  : item?.tags?.includes('digital')
                    ? 'font-digital'
                    : '';
              const extras = [
                item?.tags?.includes('faded') ? 'tag-faded' : '',
                item?.tags?.includes('smudged') ? 'tag-smudged' : '',
                item?.tags?.includes('torn') ? 'tag-torn' : '',
                item?.tags?.includes('glitching') ? 'tag-glitching' : '',
                item?.tags?.includes('encrypted') ? 'tag-encrypted' : '',
                item?.tags?.includes('foreign') ? 'tag-foreign' : '',
                item?.tags?.includes('runic') ? 'tag-runic' : '',
                item?.tags?.includes('bloodstained') ? 'tag-bloodstained' : '',
                item?.tags?.includes('water-damaged') ? 'tag-water-damaged' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return `${font} ${extras}`.trim();
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
