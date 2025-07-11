import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyBasicMarkup } from '../utils/markup';

describe('applyBasicMarkup', () => {
  it('converts simple markup to HTML', () => {
    const text = 'Hello **World**\n\nSecond *line*';
    const nodes = applyBasicMarkup(text);
    const html = nodes
      .map(n => renderToStaticMarkup(n as React.ReactElement))
      .join('');
    expect(html).toBe('<p>Hello <strong>World</strong></p><p>Second <em>line</em></p>');
  });

  it('formats bullet lists', () => {
    const text = '* First\n* Second **bold**';
    const nodes = applyBasicMarkup(text);
    const html = nodes
      .map(n => renderToStaticMarkup(n as React.ReactElement))
      .join('');
    expect(html).toBe('<ul class="list-disc list-inside ml-4 space-y-1"><li>First</li><li>Second <strong>bold</strong></li></ul>');
  });

  it('formats headings as strong', () => {
    const text = '# Heading 1';
    const nodes = applyBasicMarkup(text);
    const html = nodes
      .map(n => renderToStaticMarkup(n as React.ReactElement))
      .join('');
    expect(html).toBe('<p><strong>Heading 1</strong></p>');
  });
});

export default {};
