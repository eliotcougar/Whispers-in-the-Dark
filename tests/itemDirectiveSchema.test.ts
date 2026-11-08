import { describe, expect, it } from 'vitest';
import { INVENTORY_JSON_SCHEMA } from '../services/inventory/api';
import { LIBRARIAN_JSON_SCHEMA } from '../services/librarian/api';
import { SYSTEM_INSTRUCTION as INVENTORY_INSTRUCTION } from '../services/inventory/systemPrompt';
import { SYSTEM_INSTRUCTION as LIBRARIAN_INSTRUCTION } from '../services/librarian/systemPrompt';
import { parseInventoryResponse } from '../services/inventory/responseParser';
import { parseLibrarianResponse } from '../services/librarian/responseParser';
import { safeParseJson } from '../utils/jsonUtils';
import { COMMON_TAGS } from '../constants';

interface SchemaNode {
  readonly type?: string | ReadonlyArray<string>;
  readonly enum?: ReadonlyArray<unknown>;
  readonly properties?: Partial<Record<string, SchemaNode>>;
  readonly items?: SchemaNode;
  readonly required?: ReadonlyArray<string>;
  readonly propertyOrdering?: ReadonlyArray<string>;
  readonly additionalProperties?: boolean;
}

const actions = ['create', 'change', 'addDetails', 'move', 'destroy'] as const;

// Check the object boundaries that matter for metadata placement, including nested chapters/uses.
function expectAllowedFields(value: unknown, schema: SchemaNode): void {
  if (Array.isArray(value)) {
    if (!schema.items) throw new Error('Missing array item schema');
    value.forEach(item => { expectAllowedFields(item, schema.items ?? {}); });
    return;
  }
  if (!value || typeof value !== 'object') return;
  const object = value as Record<string, unknown>;
  const properties = schema.properties ?? {};
  if (schema.additionalProperties === false) {
    expect(Object.keys(object).filter(key => !(key in properties))).toEqual([]);
  }
  expect((schema.required ?? []).filter(key => !(key in object))).toEqual([]);
  Object.entries(object).forEach(([key, child]) => {
    const property = properties[key];
    if (property) expectAllowedFields(child, property);
  });
}

describe.each([
  { name: 'Inventory', schema: INVENTORY_JSON_SCHEMA, instruction: INVENTORY_INSTRUCTION, parse: parseInventoryResponse },
  { name: 'Librarian', schema: LIBRARIAN_JSON_SCHEMA, instruction: LIBRARIAN_INSTRUCTION, parse: parseLibrarianResponse },
])('$name directive metadata contract', ({ schema, instruction, parse }) => {
  it.each(actions)('requires directiveId on the %s action, rather than in item content', action => {
    const actionSchema = schema.properties[action].items;
    expect(actionSchema.properties.directiveId).toMatchObject({ type: 'string', minLength: 1 });
    expect(actionSchema.required).toContain('directiveId');
    expect(actionSchema.propertyOrdering).toContain('directiveId');
    // Nested player-facing data must not acquire an action's tracking field.
    const checkNested = (node: SchemaNode): void => {
      if (node.properties) expect(node.properties).not.toHaveProperty('directiveId');
      Object.values(node.properties ?? {}).forEach(child => { if (child) checkNested(child); });
      if (node.items) checkNested(node.items);
    };
    Object.values(actionSchema.properties).forEach(checkNested);
  });

  it('keeps its JSON examples compatible with the schema and separates metadata when parsed', () => {
    const examples = Array.from(instruction.matchAll(/Response:\s*(\{[\s\S]*?\n {2}\})/g));
    expect(examples).toHaveLength(2);
    for (const example of examples) {
      const payload = safeParseJson<Record<string, unknown>>(example[1]);
      if (!payload) throw new Error('The prompt example must be valid JSON');
      for (const action of actions) {
        if (payload[action]) expectAllowedFields(payload[action], schema.properties[action]);
      }
      const parsed = parse(example[1]);
      if (!parsed?.itemChanges.length) throw new Error('The prompt example must produce valid item actions');
      for (const change of parsed.itemChanges) {
        expect(change.directiveId).toMatch(/^note-/);
        expect(change.item).not.toHaveProperty('directiveId');
        expect(JSON.stringify(change.item)).not.toContain(change.directiveId);
      }
    }
  });
});

it('allows regular tag strings when adding item details', () => {
  expect(INVENTORY_JSON_SCHEMA.properties.addDetails.items.properties.tags.items.enum).toEqual(COMMON_TAGS);
});
