import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';

const MAX_CAUSES = 5;

interface SerializedError {
  type: string;
  message?: string;
  stack?: string;
  code?: string | number;
  query?: string;
  severity?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  routine?: string;
  cause?: SerializedError;
}

/**
 * pino `err` serializer. Logged fields are an allow-list, because errors carry data that must stay
 * out of the logs: Drizzle puts query parameters in its message, PostgreSQL quotes values in its
 * message, `detail` and `where`, pg-pool attaches the connection, body-parser the raw body.
 */
export function serializeError(value: unknown): unknown {
  // pino-http passes custom serializers pino's own result, which keeps the error on `raw`.
  const error = isPinoSerialized(value) ? value.raw : value;
  return error instanceof Error ? describe(error, MAX_CAUSES) : value;
}

function isPinoSerialized(value: unknown): value is { raw: unknown } {
  return typeof value === 'object' && value !== null && 'raw' in value;
}

function describe(error: Error, causesLeft: number): SerializedError {
  const serialized: SerializedError = { type: error.constructor.name, ...fieldsOf(error) };
  if (error.cause instanceof Error && causesLeft > 0) {
    serialized.cause = describe(error.cause, causesLeft - 1);
  }
  return serialized;
}

function fieldsOf(error: Error): Omit<SerializedError, 'type' | 'cause'> {
  if (error instanceof DrizzleQueryError) {
    // Parameterized SQL, so the text holds placeholders and no values.
    return { query: error.query, stack: framesOf(error) };
  }
  if (error instanceof DatabaseError) {
    const { severity, code, schema, table, column, dataType, constraint, routine } = error;
    return {
      severity,
      code,
      schema,
      table,
      column,
      dataType,
      constraint,
      routine,
      stack: framesOf(error),
    };
  }
  return { message: error.message, stack: error.stack, code: codeOf(error) };
}

/** The stack without its header, which repeats the message and every value in it. */
function framesOf(error: Error): string | undefined {
  const headerStart = error.stack?.indexOf(error.message) ?? -1;
  if (headerStart === -1) return undefined;
  return error.stack?.slice(headerStart + error.message.length).trimStart();
}

function codeOf(error: Error): string | number | undefined {
  const { code } = error as { code?: unknown };
  return typeof code === 'string' || typeof code === 'number' ? code : undefined;
}
