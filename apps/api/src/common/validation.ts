import {
  StandardSchemaValidationPipe,
  type StandardSchemaValidationPipeOptions,
} from '@nestjs/common';
import { ValidationFailedError, type FieldError } from './errors/app-error.js';

type Issue = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0][number];

export function toFieldErrors(issues: readonly Issue[]): FieldError[] {
  return issues.map((issue) => ({
    path: (issue.path ?? [])
      .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
      .join('.'),
    message: issue.message,
  }));
}

/**
 * Validates every `@Body`, `@Query` and `@Param` that declares a `schema`, and passes the parsed
 * value to the handler. Parameters without a schema are not validated.
 */
export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) => new ValidationFailedError(toFieldErrors(issues)),
  });
}
