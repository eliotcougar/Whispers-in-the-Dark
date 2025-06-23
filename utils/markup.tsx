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
  const lines = text.replace(/\r\n/g, '\n').split(/\n/);
  const result: Array<ReactNode> = [];
  const listStack: Array<{ level: number; items: Array<ReactNode> }> = [];
  let paragraphLines: Array<string> = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    const pIndex = result.length;
    const content = paragraphLines.map((line, lIndex) => {
      const key = `p-${String(pIndex)}-${String(lIndex)}`;
      const inlineContent = parseInline(line, key);
      const lineBreak = lIndex < paragraphLines.length - 1 ? <br /> : null;
      return (
        <React.Fragment key={key}>
          {inlineContent}

          {lineBreak}
        </React.Fragment>
      );
    });
    result.push(
      <p key={`p-${String(pIndex)}`}>
        {content}
      </p>,
    );
    paragraphLines = [];
  };

  const closeList = () => {
    const last = listStack.pop();
    if (!last) {
      return;
    }
    const { items, level } = last;
    const key = `ul-${String(level)}-${String(result.length)}`;
    const ul = (
      <ul
        className="list-disc list-inside ml-4 space-y-1"
        key={key}
      >
        {items}
      </ul>
    );
    if (listStack.length === 0) {
      result.push(ul);
    } else {
      listStack[listStack.length - 1].items.push(ul);
    }
  };

  const flushLists = (targetLevel: number) => {
    while (listStack.length > targetLevel + 1) {
      closeList();
    }
  };

  const bulletRegex = /^(\s*)\*\s+(.*)$/;
  lines.forEach(rawLine => {
    const bulletMatch = bulletRegex.exec(rawLine);
    if (bulletMatch) {
      flushParagraph();
      const indent = bulletMatch[1].length;
      const level = Math.floor(indent / 2);
      flushLists(level);

      while (listStack.length <= level) {
        listStack.push({ level: listStack.length, items: [] });
      }

      const content = bulletMatch[2];
      const key = `li-${String(level)}-${String(listStack[level].items.length)}`;
      const inline = parseInline(content, key);
      listStack[level].items.push(
        <li key={key}>
          {inline}
        </li>,
      );
    } else if (rawLine.trim() === '') {
      flushParagraph();
      flushLists(-1);
    } else {
      paragraphLines.push(rawLine);
    }
  });

  flushParagraph();
  flushLists(-1);
  return result;
};
