import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getRequestId } from '../request-id.js';
import { PROBLEM_CONTENT_TYPE, toProblem } from './problem.js';

/** Answers every exception, thrown anywhere in the app, with RFC 9457 Problem Details. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<IncomingMessage>();
    const response = http.getResponse<ServerResponse>();
    const requestId = getRequestId(request) ?? 'unknown';
    const problem = toProblem(exception, requestId);

    if (problem.status >= 500) {
      // The client gets a generic problem; the details only go to the server log. req.log is
      // set by pino-http, which runs before anything else, and is bound to the request id.
      request.log.error({ err: exception }, 'Unhandled exception');
    }

    const { httpAdapter } = this.adapterHost;
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, problem, problem.status);
  }
}
