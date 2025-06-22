import React, { type ReactNode } from 'react';

const parseInline = (text: string, keyPrefix: string): Array<ReactNode> => {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${String(index)}-${token}`;
    if (token.startsWith('**') && token.endsWith('**')) {
      const value = token.slice(2, -2);
      return (
        <strong key={`b-${key}`}>
          {value}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      const value = token.slice(1, -1);
      return (
        <em key={`i-${key}`}>
          {value}
        </em>
      );
    }
    return (
      <React.Fragment key={`t-${key}`}> 
        {token}
      </React.Fragment>
    );
  });
};

export const applyBasicMarkup = (text: string): Array<ReactNode> => {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((paragraph, pIndex) => {
    const lines = paragraph.split(/\n/);
    const lineNodes = lines.map((line, lIndex) => {
      const key = `l-${String(pIndex)}-${String(lIndex)}`;
      const inlineContent = parseInline(line, `${String(pIndex)}-${String(lIndex)}`);
      const lineBreak = lIndex < lines.length - 1 ? <br /> : null;
      return (
        <React.Fragment key={key}>
          {inlineContent}

          {lineBreak}
        </React.Fragment>
      );
    });
    return (
      <p key={`p-${String(pIndex)}`}>
        {lineNodes}
      </p>
    );
  });
};
