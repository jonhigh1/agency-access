/**
 * Minimal Zod → JSON Schema converter for the v1 OpenAPI generator.
 *
 * Covers exactly the shapes used in `../routes/v1-schemas.ts`: objects
 * (strict), strings (email/url/min/max), numbers (int/min/max/coerce),
 * booleans, enums, arrays (min/max), optionals, and defaults. Anything
 * else throws so the spec can never silently drift from validation.
 */

import { z } from 'zod';

type JsonSchema = Record<string, unknown>;

function baseOf(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; required: boolean } {
  let inner = schema;
  let required = true;
  for (;;) {
    const typeName = (inner._def as { typeName: string }).typeName;
    if (typeName === 'ZodOptional') {
      required = false;
      inner = (inner._def as unknown as { innerType: z.ZodTypeAny }).innerType;
    } else if (typeName === 'ZodDefault') {
      required = false;
      inner = (inner._def as unknown as { innerType: z.ZodTypeAny }).innerType;
    } else {
      return { inner, required };
    }
  }
}

function defaultOf(schema: z.ZodTypeAny): unknown {
  const typeName = (schema._def as { typeName: string }).typeName;
  if (typeName === 'ZodDefault') {
    return (schema._def as unknown as { defaultValue: () => unknown }).defaultValue();
  }
  return undefined;
}

export function zodToJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const { inner } = baseOf(schema);
  return zodToJsonSchemaWithDefault(inner, defaultOf(schema));
}

function zodToJsonSchemaWithDefault(inner: z.ZodTypeAny, fallbackDefault: unknown): JsonSchema {
  const def = inner._def as { typeName: string; [key: string]: unknown };
  const withDefault = (out: JsonSchema): JsonSchema =>
    fallbackDefault === undefined ? out : { ...out, default: fallbackDefault };

  switch (def.typeName) {
    case 'ZodString': {
      const out: JsonSchema = { type: 'string' };
      for (const check of (def.checks as Array<{ kind: string; value?: unknown }>) ?? []) {
        if (check.kind === 'email') out.format = 'email';
        if (check.kind === 'url') out.format = 'uri';
        if (check.kind === 'min') out.minLength = check.value;
        if (check.kind === 'max') out.maxLength = check.value;
      }
      return withDefault(out);
    }
    case 'ZodNumber': {
      const checks = (def.checks as Array<{ kind: string; value?: unknown }>) ?? [];
      const out: JsonSchema = {
        type: checks.some((c) => c.kind === 'int') ? 'integer' : 'number',
      };
      for (const check of checks) {
        if (check.kind === 'min') out.minimum = check.value;
        if (check.kind === 'max') out.maximum = check.value;
      }
      if ((def as { coerce?: boolean }).coerce === true) out['x-coerce'] = 'query parameters arrive as strings';
      return withDefault(out);
    }
    case 'ZodBoolean':
      return withDefault({ type: 'boolean' });
    case 'ZodEnum':
      return withDefault({ type: 'string', enum: def.values });
    case 'ZodArray': {
      const t = def.type as z.ZodTypeAny;
      const out: JsonSchema = { type: 'array', items: zodToJsonSchema(t) };
      if (typeof def.minLength === 'object' && def.minLength !== null) {
        out.minItems = (def.minLength as { value: number }).value;
      }
      if (typeof def.maxLength === 'object' && def.maxLength !== null) {
        out.maxItems = (def.maxLength as { value: number }).value;
      }
      return withDefault(out);
    }
    case 'ZodObject': {
      const shape = (def.shape as () => Record<string, z.ZodTypeAny>)();
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const [key, field] of Object.entries(shape)) {
        const base = baseOf(field);
        properties[key] = zodToJsonSchemaWithDefault(base.inner, defaultOf(field));
        if (base.required) required.push(key);
      }
      const out: JsonSchema = {
        type: 'object',
        properties,
        additionalProperties: false,
      };
      if (required.length > 0) out.required = required;
      return withDefault(out);
    }
    default:
      throw new Error(`v1 OpenAPI converter: unsupported zod type ${def.typeName}`);
  }
}
