import { HttpException } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import { AppError, ValidationFailedError, type FieldError } from './app-error.js';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** RFC 9457 Problem Details, extended with a stable `code` and the request's id. */
export interface ProblemDetails {
  type: 'about:blank';
  title: string;
  status: number;
  detail: string;
  code: string;
  requestId: string;
  errors?: FieldError[];
}

interface CodeAndDetail {
  code: string;
  detail: string;
}

// Errors raised by Nest or Express (unknown route, unparsable JSON, ...) carry framework or
// parser text in their message, so clients get these fixed texts instead.
const frameworkErrors: Partial<Record<number, CodeAndDetail>> = {
  400: { code: 'malformed_request', detail: 'The request could not be parsed.' },
  401: { code: 'unauthenticated', detail: 'Authentication is required.' },
  403: { code: 'forbidden', detail: 'You are not allowed to do this.' },
  404: { code: 'not_found', detail: 'The requested resource was not found.' },
  405: { code: 'method_not_allowed', detail: 'This method is not allowed on this resource.' },
  409: { code: 'conflict', detail: 'The request conflicts with the current state.' },
  413: { code: 'payload_too_large', detail: 'The request body is too large.' },
  415: { code: 'unsupported_media_type', detail: 'This content type is not supported.' },
  422: { code: 'business_rule_violated', detail: 'The request breaks a business rule.' },
  429: { code: 'rate_limited', detail: 'Too many requests. Try again later.' },
  503: { code: 'service_unavailable', detail: 'The service is temporarily unavailable.' },
};

const otherClientError: CodeAndDetail = { code: 'request_failed', detail: 'The request failed.' };
const internalError: CodeAndDetail = {
  code: 'internal_error',
  detail: 'An unexpected error occurred.',
};

export function toProblem(error: unknown, requestId: string): ProblemDetails {
  if (error instanceof AppError) {
    const errors = error instanceof ValidationFailedError ? error.errors : undefined;
    return problem(error.status, { code: error.code, detail: error.detail }, requestId, errors);
  }
  if (error instanceof HttpException && error.getStatus() >= 400) {
    const status = error.getStatus();
    const known = frameworkErrors[status] ?? (status < 500 ? otherClientError : internalError);
    return problem(status, known, requestId);
  }
  return problem(500, internalError, requestId);
}

function problem(
  status: number,
  { code, detail }: CodeAndDetail,
  requestId: string,
  errors?: FieldError[],
): ProblemDetails {
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail,
    code,
    requestId,
    ...(errors && { errors }),
  };
}
