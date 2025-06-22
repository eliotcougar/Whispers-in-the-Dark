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
});

export default {};
