import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { highlightEntitiesInText } from '../utils/highlightHelper';
import type { HighlightableEntity } from '../utils/highlightHelper';

describe('highlightEntitiesInText', () => {
  it('highlights entity occurrences', () => {
    const entities: Array<HighlightableEntity> = [
      { name: 'Torch', type: 'item', description: 'A bright torch' },
    ];
    const nodes = highlightEntitiesInText('Take the Torch and go.', entities);
    const html = nodes
      .map(n => (typeof n === 'string' ? n : renderToStaticMarkup(n)))
      .join('');
    expect(html).toContain('<span');
    expect(html).toContain('Torch');
    expect(html).toContain('title="A bright torch"');
  });
});

export default {};
