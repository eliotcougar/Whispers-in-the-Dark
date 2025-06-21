import { extractJsonFromFence } from '../../../utils/jsonUtils';

export const decodeEscapedString = (text: string): string => {
  try {
    return JSON.parse(`"${text.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return text.replace(/\\n/g, '\n');
  }
};

export const filterObservationsAndRationale = (raw: string | undefined | null): string => {
  if (!raw) return '';
  const jsonStr = extractJsonFromFence(raw);
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    const strip = (obj: unknown) => {
      if (obj && typeof obj === 'object') {
        delete (obj as Record<string, unknown>).observations;
        delete (obj as Record<string, unknown>).rationale;
        Object.values(obj).forEach(strip);
      }
    };
    strip(parsed);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw
      .replace(/"?(observations|rationale)"?\s*:\s*"[^"\\]*(?:\\.[^"\\]*)*"\s*,?/gi, '')
      .trim();
  }
};
