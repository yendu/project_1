import {
  BadRequestException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationFailedError,
} from './app-error.js';
import { toProblem } from './problem.js';

describe('toProblem', () => {
  it('maps an error a service throws on purpose', () => {
    const error = new ConflictError(
      'order_not_cancellable',
      'Delivered orders cannot be cancelled.',
    );
    expect(toProblem(error, 'req-1')).toEqual({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Delivered orders cannot be cancelled.',
      code: 'order_not_cancellable',
      requestId: 'req-1',
    });
  });

  it.each([
    [new NotFoundError(), 404, 'not_found'],
    [
      new BusinessRuleError('restaurant_closed', 'The restaurant is closed.'),
      422,
      'restaurant_closed',
    ],
  ])('maps %o to %i %s', (error, status, code) => {
    expect(toProblem(error, 'req-1')).toMatchObject({ status, code });
  });

  it('adds field errors for a validation failure', () => {
    const error = new ValidationFailedError([{ path: 'items.0.quantity', message: 'Too small' }]);
    expect(toProblem(error, 'req-1')).toMatchObject({
      status: 400,
      code: 'validation_failed',
      errors: [{ path: 'items.0.quantity', message: 'Too small' }],
    });
  });

  it.each([
    [new BadRequestException('Unexpected token } in JSON at position 7'), 400, 'malformed_request'],
    [new NotFoundException('Cannot GET /v1/nope'), 404, 'not_found'],
    [new PayloadTooLargeException('request entity too large'), 413, 'payload_too_large'],
    [new ServiceUnavailableException('pool exhausted'), 503, 'service_unavailable'],
    [new HttpException('teapot', 418), 418, 'request_failed'],
  ])('maps framework error %o to %i %s with a fixed detail', (error, status, code) => {
    const problem = toProblem(error, 'req-1');
    expect(problem).toMatchObject({ status, code });
    expect(problem.detail).not.toContain(error.message);
  });

  it.each([
    new Error('connect ECONNREFUSED db.internal:5432'),
    'a thrown string',
    new HttpException('redirect is not an error', 302),
  ])('hides everything about the unexpected error %o', (error) => {
    const problem = toProblem(error, 'req-1');
    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred.',
      code: 'internal_error',
      requestId: 'req-1',
    });
  });
});
