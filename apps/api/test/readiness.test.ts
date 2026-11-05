import { createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LogCapture } from './support/log-capture.js';
import { createTestApp, type TestAppOptions } from './support/test-app.js';

const UNREACHABLE_DATABASE_URL = 'postgres://app:readiness-secret@127.0.0.1:1/app';

const notReady = {
  type: 'about:blank',
  title: 'Service Unavailable',
  status: 503,
  detail: 'The service is temporarily unavailable.',
  code: 'service_unavailable',
  requestId: expect.any(String),
};

describe('GET /readyz', () => {
  let app: NestExpressApplication | undefined;

  async function start(options?: TestAppOptions): Promise<NestExpressApplication> {
    app = await createTestApp(options);
    return app;
  }

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns 200 when the database answers', async () => {
    const response = await request((await start()).getHttpServer()).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('is unversioned', async () => {
    const response = await request((await start()).getHttpServer()).get('/v1/readyz');
    expect(response.status).toBe(404);
  });

  it('returns 503 Problem Details when the database is unreachable', async () => {
    const server = (
      await start({ env: { DATABASE_URL: UNREACHABLE_DATABASE_URL } })
    ).getHttpServer();
    const response = await request(server).get('/readyz');

    expect(response.status).toBe(503);
    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toEqual(notReady);
  });

  it('logs why it is not ready, without the connection URL', async () => {
    const logs = new LogCapture();
    const server = (
      await start({
        env: { DATABASE_URL: UNREACHABLE_DATABASE_URL, LOG_LEVEL: 'info' },
        logDestination: logs,
      })
    ).getHttpServer();
    await request(server).get('/readyz');

    expect(logs.entries()).toContainEqual(
      expect.objectContaining({
        level: 50,
        err: expect.objectContaining({
          message: 'Database is not ready',
          cause: expect.objectContaining({
            query: 'select 1',
            cause: expect.objectContaining({ code: 'ECONNREFUSED' }),
          }),
        }),
      }),
    );
    expect(logs.text).not.toContain('readiness-secret');
  });

  describe('when the database accepts connections but never answers', () => {
    let silentServer: Server;
    const sockets = new Set<Socket>();

    beforeAll(async () => {
      silentServer = createServer((socket) => sockets.add(socket));
      await new Promise<void>((resolve) => silentServer.listen(0, '127.0.0.1', resolve));
    });

    afterAll(async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => silentServer.close(resolve));
    });

    it('returns 503 within its time limit', async () => {
      const { port } = silentServer.address() as AddressInfo;
      const server = (
        await start({ env: { DATABASE_URL: `postgres://app:app@127.0.0.1:${port}/app` } })
      ).getHttpServer();

      const startedAt = performance.now();
      const response = await request(server).get('/readyz');
      const elapsed = performance.now() - startedAt;

      expect(response.status).toBe(503);
      expect(response.body).toEqual(notReady);
      expect(elapsed).toBeGreaterThanOrEqual(1_900);
      expect(elapsed).toBeLessThan(3_000);
      // Let the pool's pending connection fail now instead of at its 5 s connect timeout.
      for (const socket of sockets) socket.destroy();
    });
  });
});
