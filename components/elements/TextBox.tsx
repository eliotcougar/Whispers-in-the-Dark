
import type { ReactNode } from 'react';

export interface TextBoxProps {
  readonly header: string;
  readonly children: ReactNode;
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
  borderColorClass = 'border-amber-700',
  backgroundColorClass = '',
  borderWidthClass = 'border-b',
  headerFontClass = 'text-2xl font-semibold',
  headerColorClass = 'text-amber-400',
  contentFontClass = '',
  contentColorClass = 'text-slate-300',
}: TextBoxProps) {
  return (
    <section className={`mb-6 ${backgroundColorClass}`}>
      <h2 className={`${headerFontClass} ${headerColorClass} mb-3 pb-1 ${borderWidthClass} ${borderColorClass}`}>
        {header}
      </h2>

      <div className={`${contentFontClass} ${contentColorClass}`}>
        {children}
      </div>
    </section>
  );
}

export default TextBox;
