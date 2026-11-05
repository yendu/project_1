import { ServiceUnavailableException } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { stdSerializers } from 'pino';
import { describe, expect, it } from 'vitest';
import { serializeError } from './serialize-error.js';

const SECRET = 'secret.customer@example.com';

function postgresError(): DatabaseError {
  const error = new DatabaseError(`duplicate key: "${SECRET}"`, 120, 'error');
  return Object.assign(error, {
    severity: 'ERROR',
    code: '23505',
    detail: `Key (email)=(${SECRET}) already exists.`,
    hint: `Try another value than ${SECRET}`,
    where: `unnamed portal parameter $1 = '${SECRET}'`,
    internalQuery: `select '${SECRET}'`,
    schema: 'public',
    table: 'customers',
    column: 'email',
    dataType: 'text',
    constraint: 'customers_email_key',
    routine: '_bt_check_unique',
    client: { user: 'app', secretKey: SECRET },
  });
}

function failedQuery(cause: Error = postgresError()): DrizzleQueryError {
  return new DrizzleQueryError('insert into customers values ($1)', [SECRET], cause);
}

describe('serializeError', () => {
  it('keeps only the identifying fields of a PostgreSQL error', () => {
    expect(serializeError(postgresError())).toEqual({
      type: 'DatabaseError',
      severity: 'ERROR',
      code: '23505',
      schema: 'public',
      table: 'customers',
      column: 'email',
      dataType: 'text',
      constraint: 'customers_email_key',
      routine: '_bt_check_unique',
      stack: expect.stringContaining('serialize-error.spec'),
    });
  });

  it('keeps the SQL of a failed query and drops its parameters', () => {
    const serialized = serializeError(failedQuery());

    expect(serialized).toMatchObject({
      type: 'DrizzleQueryError',
      query: 'insert into customers values ($1)',
      stack: expect.stringContaining('serialize-error.spec'),
      cause: { type: 'DatabaseError', code: '23505' },
    });
    expect(JSON.stringify(serialized)).not.toContain(SECRET);
  });

  it('drops values that imitate a stack frame', () => {
    const query = new DrizzleQueryError('select $1', [`x\n    at ${SECRET}`]);
    expect(JSON.stringify(serializeError(query))).not.toContain(SECRET);
  });

  it('keeps the cause of an HTTP exception, without any of its other fields', () => {
    const exception = new ServiceUnavailableException('Not ready', { cause: failedQuery() });
    const serialized = serializeError(exception);

    expect(serialized).toEqual({
      type: 'ServiceUnavailableException',
      message: 'Not ready',
      stack: expect.any(String),
      cause: expect.objectContaining({ type: 'DrizzleQueryError' }),
    });
    expect(JSON.stringify(serialized)).not.toContain(SECRET);
  });

  it('keeps the message, stack and code of an ordinary error', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    expect(serializeError(error)).toEqual({
      type: 'Error',
      message: 'connect ECONNREFUSED 127.0.0.1:5432',
      code: 'ECONNREFUSED',
      stack: expect.stringContaining('serialize-error.spec'),
    });
  });

  it('drops every other field of an ordinary error', () => {
    // body-parser puts the raw request body on its errors; pg-pool attaches the connection.
    const error = Object.assign(new SyntaxError('Unexpected token'), {
      body: SECRET,
      client: { user: SECRET },
    });
    expect(JSON.stringify(serializeError(error))).not.toContain(SECRET);
  });

  it('accepts what pino-http passes: an error already serialized by pino', () => {
    const serialized = serializeError(stdSerializers.err(failedQuery()));

    expect(serialized).toMatchObject({ type: 'DrizzleQueryError' });
    expect(JSON.stringify(serialized)).not.toContain(SECRET);
  });

  it('survives a cause that points back at the error', () => {
    const error = new Error('loop');
    error.cause = error;
    expect(() => JSON.stringify(serializeError(error))).not.toThrow();
  });

  it('leaves anything that is not an error alone', () => {
    expect(serializeError('text')).toBe('text');
    expect(serializeError({ reason: 'plain' })).toEqual({ reason: 'plain' });
  });
});
