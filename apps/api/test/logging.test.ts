import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LogCapture } from './support/log-capture.js';
import { createTestApp } from './support/test-app.js';

describe('logging', () => {
  const capture = new LogCapture();
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp({ env: { LOG_LEVEL: 'info' }, logDestination: capture });
  });

  afterAll(async () => {
    await app.close();
  });

  /** The access log line is written when the response finishes, so wait for it. */
  function accessLog(requestId: string): Promise<Record<string, unknown>> {
    return vi.waitFor(() => {
      const entry = capture.entries().find((e) => e.requestId === requestId && 'res' in e);
      if (!entry) throw new Error(`no access log for ${requestId} yet`);
      return entry;
    });
  }

  it('writes one line per request with id, method, path, status and duration', async () => {
    await request(app.getHttpServer()).get('/v1/probe/ok').set('X-Request-Id', 'log-ok');

    const entry = await accessLog('log-ok');
    expect(entry).toMatchObject({
      level: 30,
      requestId: 'log-ok',
      req: { method: 'GET', path: '/v1/probe/ok' },
      res: { statusCode: 200 },
    });
    expect(entry.responseTime).toEqual(expect.any(Number));
  });

  it('logs client errors as warn and server errors as error', async () => {
    await request(app.getHttpServer()).get('/v1/nope').set('X-Request-Id', 'log-404');
    await request(app.getHttpServer()).get('/v1/probe/crash').set('X-Request-Id', 'log-500');

    expect(await accessLog('log-404')).toMatchObject({ level: 40, res: { statusCode: 404 } });
    expect(await accessLog('log-500')).toMatchObject({ level: 50, res: { statusCode: 500 } });
  });

  it('logs the stack of an unexpected exception under the request id', async () => {
    await request(app.getHttpServer()).get('/v1/probe/crash').set('X-Request-Id', 'log-crash');

    const entry = await vi.waitFor(() => {
      const found = capture
        .entries()
        .find((e) => e.requestId === 'log-crash' && e.msg === 'Unhandled exception');
      if (!found) throw new Error('no exception log yet');
      return found;
    });
    expect(entry).toMatchObject({
      level: 50,
      err: {
        message: expect.stringContaining('secret internal detail'),
        stack: expect.stringContaining('probe.module'),
      },
    });
  });

  it('logs requests that fail while the body is parsed', async () => {
    await request(app.getHttpServer())
      .post('/v1/probe/echo')
      .set('X-Request-Id', 'log-malformed')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(await accessLog('log-malformed')).toMatchObject({ level: 40, res: { statusCode: 400 } });
  });

  it('never logs headers, cookies, query strings or bodies', async () => {
    await request(app.getHttpServer())
      .post('/v1/probe/echo?email=someone@example.com')
      .set('X-Request-Id', 'log-private')
      .set('Authorization', 'Bearer secret-token')
      .set('Cookie', 'session=secret-cookie')
      .send({ password: 'secret-password' });

    const entry = await accessLog('log-private');
    expect(entry.req).toEqual({ method: 'POST', path: '/v1/probe/echo' });
    for (const secret of [
      'secret-token',
      'secret-cookie',
      'someone@example.com',
      'secret-password',
    ]) {
      expect(capture.text).not.toContain(secret);
    }
    expect(capture.text.toLowerCase()).not.toMatch(/authorization|cookie|user-agent/);
  });

  it('does not access-log health checks', async () => {
    await request(app.getHttpServer()).get('/healthz').set('X-Request-Id', 'log-health');
    await request(app.getHttpServer()).get('/v1/probe/ok').set('X-Request-Id', 'log-after-health');
    await accessLog('log-after-health');

    expect(capture.entries().some((e) => e.requestId === 'log-health')).toBe(false);
  });

  it("writes Nest's own logs as JSON too", () => {
    const contexts = capture.entries().map((e) => e.context);
    expect(contexts).toContain('RoutesResolver');
  });
});
