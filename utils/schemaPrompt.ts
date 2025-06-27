/**
 * @file schemaPrompt.ts
 * @description Helper to convert a JSON schema into a textual schema description for system prompts.
 */

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: Array<string | number>;
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

const render = (schema: JsonSchema, indent = 0): string => {
  const pad = '  '.repeat(indent);
  if (schema.type === 'object') {
    const lines: Array<string> = ['{'];
    const props = schema.properties ?? {};
    const req = schema.required ?? [];
    const keys = Object.keys(props);
    keys.forEach((key, index) => {
      const child = props[key];
      const inner = render(child, indent + 1);
      const comment = buildComment(child);
      const comma = index < keys.length - 1 ? ',' : '';
      lines.push(`${pad}  "${key}"${req.includes(key) ? '' : '?'}: ${inner}${comment}${comma}`);
    });
    lines.push(`${pad}}`);
    return lines.join('\n');
  }

  if (schema.type === 'array') {
    const inner = schema.items ? render(schema.items, indent + 1) : 'unknown';
    const comment = buildComment(schema);
    if (inner.startsWith('{') || inner.startsWith('[')) {
      const lines = ['[', inner, `${pad}]${comment}`];
      return lines.join('\n');
    }
    return `[${inner}]${comment}`;
  }

  if (schema.enum) {
    return schema.enum.map(v => JSON.stringify(v)).join(' | ');
  }

  if (schema.type) {
    let base = schema.type;
    if (base === 'integer') base = 'number';
    return base + buildComment(schema);
  }

  return 'unknown';
};

export const jsonSchemaToPrompt = (schema: JsonSchema): string => {
  return `Respond ONLY with a JSON with the following schema:\n${render(schema)}`;
};
