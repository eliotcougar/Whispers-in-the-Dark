import { useEffect, useState } from 'react';
import { Item } from '../../types';
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
          const generated = await generatePageText(item.name, item.description, length, context);
          if (generated) {
            updateItemContent(item.id, generated, generated);
            setText(generated);
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
          <div className="whitespace-pre-wrap text-slate-200 overflow-y-auto mt-4">
            {text}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PageView;
