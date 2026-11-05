import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app.js';

function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
  expect(response.body).toMatchObject({ type: 'about:blank', status, code });
  expect(typeof response.body.title).toBe('string');
  expect(typeof response.body.detail).toBe('string');
  expect(response.body.requestId).toBe(response.headers['x-request-id']);
}

describe('Problem Details errors', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers an unknown route with 404 not_found', async () => {
    const response = await request(app.getHttpServer()).get('/v1/nope');
    expectProblem(response, 404, 'not_found');
    expect(JSON.stringify(response.body)).not.toContain('Cannot GET');
  });

  it.each([
    ['not-found', 404, 'not_found'],
    ['conflict', 409, 'probe_conflict'],
    ['business-rule', 422, 'probe_rule_broken'],
  ])('maps the error thrown by /probe/%s to %i %s', async (path, status, code) => {
    const response = await request(app.getHttpServer()).get(`/v1/probe/${path}`);
    expectProblem(response, status, code);
  });

  it('passes the detail of an error a service throws on purpose', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe/conflict');
    expect(response.body.detail).toBe('The probe is in the wrong state.');
  });

  it('answers an unexpected exception with 500 and no internals', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe/crash');
    expectProblem(response, 500, 'internal_error');
    const body = JSON.stringify(response.body);
    expect(body).not.toContain('secret');
    expect(body).not.toContain('db.internal');
    expect(body).not.toContain('stack');
    expect(body).not.toContain('.ts:');
  });

  it('answers malformed JSON with 400 malformed_request and no parser message', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/probe/echo')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expectProblem(response, 400, 'malformed_request');
    expect(JSON.stringify(response.body)).not.toMatch(/Unexpected|position|JSON/);
  });

  it('answers a body over the limit with 413 payload_too_large', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/probe/echo')
      .send({ padding: 'x'.repeat(200 * 1024) });
    expectProblem(response, 413, 'payload_too_large');
  });

  it('still accepts a normal JSON body', async () => {
    const response = await request(app.getHttpServer()).post('/v1/probe/echo').send({ a: 1 });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ a: 1 });
  });
});
