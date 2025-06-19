
import type { ReactNode, ElementType } from 'react';
import type { HighlightableEntity } from '../../utils/highlightHelper';
import { highlightEntitiesInText } from '../../utils/highlightHelper';

export interface TextBoxProps {
  readonly header: string;
  readonly children?: ReactNode;
  readonly text?: string;
  readonly highlightEntities?: Array<HighlightableEntity>;
  readonly enableMobileTap?: boolean;
  readonly containerClassName?: string;
  readonly headerTag?: 'h2' | 'h3' | 'h4' | 'h5';
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
  containerClassName = 'mb-6',
  headerTag = 'h2',
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

  const HeadingTag: ElementType = headerTag;

  return (
    <section className={`${containerClassName} ${backgroundColorClass}`}>
      <HeadingTag className={`${headerFontClass} ${headerColorClass} mb-3 pb-1 ${borderWidthClass} ${borderColorClass}`}>
        {header}
      </HeadingTag>

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
  containerClassName: 'mb-6',
  contentColorClass: 'text-slate-300',
  contentFontClass: '',
  enableMobileTap: false,
  headerColorClass: 'text-amber-400',
  headerFontClass: 'text-2xl font-semibold',
  headerTag: 'h2',
  highlightEntities: undefined,
  text: undefined,
};

export default TextBox;
