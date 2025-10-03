const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const decodeHtmlEntities = (value: string): string => {
  return value.replace(/&(#x?[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match: string, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (Object.prototype.hasOwnProperty.call(HTML_ENTITY_MAP, entity)) {
      return HTML_ENTITY_MAP[entity];
    }
    return match;
  });
};

export const sanitizePlayerName = (value: string): string => {
  return value
    .replace(/[^a-zA-Z0-9\s\-"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const stripMarkupFormatting = (value: string): string => {
  const withoutHtml = value.replace(/<[^>]*>/g, ' ');
  const withoutLinks = withoutHtml.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  const withoutCode = withoutLinks.replace(/`{1,3}([^`]+)`{1,3}/g, '$1');
  const flattened = withoutCode.replace(/[*_~>#]/g, ' ');
  const decoded = decodeHtmlEntities(flattened);
  return decoded.replace(/\s+/g, ' ').trim();
};
