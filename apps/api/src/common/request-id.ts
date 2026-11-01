import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// Short and free of whitespace and markup, so a client-sent id can't forge or flood log lines.
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

const requestIds = new WeakMap<IncomingMessage, string>();

/** Keeps a valid client-sent id so requests can be traced across services; otherwise generates one. */
export function resolveRequestId(header: string | string[] | undefined): string {
  return typeof header === 'string' && VALID_REQUEST_ID.test(header) ? header : randomUUID();
}

/**
 * Express-level middleware registered before the body parser, so even requests that fail
 * while parsing get an id.
 */
export function requestIdMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  const id = resolveRequestId(req.headers['x-request-id']);
  requestIds.set(req, id);
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

export function getRequestId(req: IncomingMessage): string | undefined {
  return requestIds.get(req);
}
