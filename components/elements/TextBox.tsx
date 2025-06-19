
import type { ReactNode } from 'react';
import type { HighlightableEntity } from '../../utils/highlightHelper';
import { highlightEntitiesInText } from '../../utils/highlightHelper';

export interface TextBoxProps {
  readonly header: string;
  readonly children?: ReactNode;
  readonly text?: string;
  readonly highlightEntities?: Array<HighlightableEntity>;
  readonly enableMobileTap?: boolean;
  readonly borderColorClass?: string;
  readonly backgroundColorClass?: string;
  readonly borderWidthClass?: string;
  readonly headerFontClass?: string;
  readonly headerColorClass?: string;
  readonly contentFontClass?: string;
  readonly contentColorClass?: string;
}

function TextBox({
  header,
  children,
  text,
  highlightEntities,
  enableMobileTap = false,
  borderColorClass = 'border-amber-700',
  backgroundColorClass = '',
  borderWidthClass = 'border-b',
  headerFontClass = 'text-2xl font-semibold',
  headerColorClass = 'text-amber-400',
  contentFontClass = '',
  contentColorClass = 'text-slate-300',
}: TextBoxProps) {
  const content = text
    ? text.split('\n').map(para => (
      <p
        className="mb-3"
        key={para}
      >
        {highlightEntities
          ? highlightEntitiesInText(
              para,
              highlightEntities,
              enableMobileTap
            )
          : para}
      </p>
    ))
    : children;

  return (
    <section className={`mb-6 ${backgroundColorClass}`}>
      <h2 className={`${headerFontClass} ${headerColorClass} mb-3 pb-1 ${borderWidthClass} ${borderColorClass}`}>
        {header}
      </h2>

      <div className={`${contentFontClass} ${contentColorClass}`}>
        {content}
      </div>
    </section>
  );
}

TextBox.defaultProps = {
  backgroundColorClass: '',
  borderColorClass: 'border-amber-700',
  borderWidthClass: 'border-b',
  children: undefined,
  contentColorClass: 'text-slate-300',
  contentFontClass: '',
  enableMobileTap: false,
  headerColorClass: 'text-amber-400',
  headerFontClass: 'text-2xl font-semibold',
  highlightEntities: undefined,
  text: undefined,
};

export default TextBox;
