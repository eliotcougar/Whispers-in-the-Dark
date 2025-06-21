import { structuredCloneGameState } from '../../utils/cloneUtils';

interface DebugSectionProps {
  readonly title: string;
  readonly content: unknown;
  readonly isJson?: boolean;
  readonly maxHeightClass?: string;
}


/** Displays a section of debug information. */
function DebugSection({
  title,
  content,
  isJson = true,
  maxHeightClass = 'max-h-60',
}: DebugSectionProps) {
  const displayContent: string = (() => {
    if (content === null || content === undefined) return 'N/A';
    if (typeof content === 'string') return content;
    if (isJson) {
      try {
        const contentForDisplay = structuredCloneGameState(content);

        if (title.toLowerCase().includes('parsed')) {
          const strip = (obj: unknown) => {
            if (obj && typeof obj === 'object') {
              delete (obj as Record<string, unknown>).observations;
              delete (obj as Record<string, unknown>).rationale;
              Object.values(obj).forEach(strip);
            }
          };
          strip(contentForDisplay);
        }

        return JSON.stringify(contentForDisplay, null, 2);
      } catch (e: unknown) {

        console.error('Error stringifying debug content:', e, content);
         
        return 'Error stringifying JSON content.';
      }
    }
    return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  })();

  return (
    <section className="mb-4">
      <h3 className="text-lg font-semibold text-sky-400 mb-1">
        {title}
      </h3>

      <pre className={`bg-slate-900 p-2 rounded-md text-sm  font-mono text-white overflow-auto ${maxHeightClass} whitespace-pre-wrap break-words`}>
        <code>
          {displayContent}
        </code>
      </pre>
    </section>
  );
}

DebugSection.defaultProps = {
  isJson: true,
  maxHeightClass: 'max-h-60',
};

export default DebugSection;
