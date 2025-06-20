
import type { ReactNode } from 'react';
import HeadingTag, { type HeadingTagProps } from './HeadingTag';
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
  readonly headerFont?: HeadingTagProps['font'];
  readonly headerPreset?: HeadingTagProps['preset'];
  readonly headerWrapperClassName?: string;
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
  headerFont = '2xl',
  headerPreset = 'amber',
  headerWrapperClassName = '',
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

  return (
    <section className={`${containerClassName} ${backgroundColorClass}`}>
      {header ? (
        <div className={`mb-3 pb-1 ${borderWidthClass} ${borderColorClass} ${headerWrapperClassName}`}>
          <HeadingTag
            font={headerFont}
            icon={headerIcon}
            preset={headerPreset}
            tag={headerTag}
          >
            {header}
          </HeadingTag>
        </div>
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
  headerFont: '2xl',
  headerIcon: undefined,
  headerPreset: 'amber',
  headerWrapperClassName: '',
  headerTag: 'h2',
  highlightEntities: undefined,
  text: undefined,
};

export default TextBox;
