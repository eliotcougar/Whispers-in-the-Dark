
import type { ReactNode, ElementType } from 'react';
import type { HighlightableEntity } from '../../utils/highlightHelper';
import { highlightEntitiesInText } from '../../utils/highlightHelper';

export interface TextBoxProps {
  readonly header?: ReactNode;
  readonly children?: ReactNode;
  readonly text?: string;
  readonly highlightEntities?: Array<HighlightableEntity>;
  readonly enableMobileTap?: boolean;
  readonly containerClassName?: string;
  readonly headerTag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
  readonly borderColorClass?: string;
  readonly backgroundColorClass?: string;
  readonly borderWidthClass?: string;
  readonly headerFontClass?: string;
  readonly headerColorClass?: string;
  readonly contentFontClass?: string;
  readonly contentColorClass?: string;
  readonly headerIcon?: ReactNode;
}

function TextBox({
  header,
  headerIcon,
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
        className="mb-3 last:mb-0"
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
      {header ? (
        <HeadingTag
          className={`${headerFontClass} ${headerColorClass} mb-3 pb-1 ${borderWidthClass} ${borderColorClass}`}
        >
          {headerIcon ? (
            <span className="mr-2 inline-flex">
              {headerIcon}
            </span>
          ) : null}

          {header}
        </HeadingTag>
      ) : null}

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
  header: undefined,
  headerColorClass: 'text-amber-400',
  headerFontClass: 'text-2xl font-semibold',
  headerIcon: undefined,
  headerTag: 'h2',
  highlightEntities: undefined,
  text: undefined,
};

export default TextBox;
