/**
 * @file schemaPrompt.ts
 * @description Helper to convert a JSON schema into a textual schema description for system prompts.
 */

import { safeParseJson } from './jsonUtils';

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: Array<string | number>;
  const?: string | number;
  required?: Array<string>;
  description?: string;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

const buildComment = (schema: JsonSchema): string => {
  const parts: Array<string> = [];
  if (schema.minItems !== undefined) parts.push(`minItems ${String(schema.minItems)}`);
  if (schema.maxItems !== undefined) parts.push(`maxItems ${String(schema.maxItems)}`);
  if (schema.minLength !== undefined) parts.push(`minLength ${String(schema.minLength)}`);
  if (schema.maxLength !== undefined) parts.push(`maxLength ${String(schema.maxLength)}`);
  if (schema.description) parts.push(schema.description);
  return parts.length ? ` /* ${parts.join('. ')} */` : '';
};

const renderValue = (
  schema: JsonSchema,
  indent = 0,
): Array<string> => {
  const pad = '  '.repeat(indent);

  if (schema.type === 'object' || schema.properties) {
    const lines: Array<string> = [`${pad}{`];
    const props = schema.properties ?? {};
    const req = new Set(schema.required ?? []);
    const keys = Object.keys(props);
    keys.forEach((key, index) => {
      const childLines = renderValue(props[key], indent + 1);
      const needsNewline = childLines[0].trim().startsWith('{') || childLines[0].trim().startsWith('[');
      childLines[0] = needsNewline
        ? `${pad}  "${key}"${req.has(key) ? '' : '?'}:\n${childLines[0]}`
        : `${pad}  "${key}"${req.has(key) ? '' : '?'}: ${childLines[0]}`;
      const comma = index < keys.length - 1 ? ',' : '';
      childLines[childLines.length - 1] += comma;
      lines.push(...childLines);
    });
    lines.push(`${pad}}${buildComment(schema)}`);
    return lines;
  }

  if (schema.type === 'array' || schema.items) {
    const lines: Array<string> = [`${pad}[`];
    const itemLines = renderValue(schema.items ?? {}, indent + 1);
    lines.push(...itemLines);
    lines.push(`${pad}]${buildComment(schema)}`);
    return lines;
  }

  if (schema.enum) {
    const enums = schema.enum.map(v => JSON.stringify(v)).join(' | ');
    return [`${enums}${buildComment(schema)}`];
  }

  if (schema.const !== undefined) {
    return [`${JSON.stringify(schema.const)}${buildComment(schema)}`];
  }

  if (schema.type) {
    const base = schema.type === 'integer' ? 'number' : schema.type;
    return [`"${base}"${buildComment(schema)}`];
  }

  return [`unknown${buildComment(schema)}`];
};

const render = (schema: JsonSchema): string => {
  return renderValue(schema).join('\n');
};

export const jsonSchemaToPrompt = (schema: JsonSchema | string): string => {
  const parsed = typeof schema === 'string' ? safeParseJson<JsonSchema>(schema) : schema;
  const obj = parsed ?? {};
  return `Respond ONLY with a JSON with the following schema:\n${render(obj)}`;
};
