import { pino, stdSerializers, type DestinationStream, type LevelWithSilent } from 'pino';
import { pinoHttp, type HttpLogger } from 'pino-http';
import { getRequestId, resolveRequestId } from '../request-id.js';

export const HTTP_LOGGER = Symbol('HTTP_LOGGER');

const UNLOGGED_PATHS = new Set(['/healthz', '/readyz']);

/**
 * pino-http middleware writing one JSON line per request. Logged fields are an allow-list:
 * headers, cookies, query strings and bodies never reach the logs, since they can carry
 * tokens and personal data.
 */
export function createHttpLogger(
  level: LevelWithSilent,
  destination?: DestinationStream,
): HttpLogger {
  return pinoHttp({
    logger: destination ? pino({ level }, destination) : pino({ level }),
    genReqId: (req) => getRequestId(req) ?? resolveRequestId(undefined),
    customAttributeKeys: { reqId: 'requestId' },
    // req.log carries only the request id; the access log line adds method and path.
    quietReqLogger: true,
    serializers: {
      req: (req: { method: string; url: string }) => ({
        method: req.method,
        path: pathOf(req.url),
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      err: stdSerializers.err,
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      return res.statusCode >= 400 ? 'warn' : 'info';
    },
    // Load balancers poll these constantly.
    autoLogging: { ignore: (req) => UNLOGGED_PATHS.has(pathOf(req.url ?? '')) },
  });
}

function pathOf(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}
