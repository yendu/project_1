import { describe, expect, it } from 'vitest';
import { resolveRequestId } from './request-id.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it.each(['abc-123', 'trace.id_1', 'a'.repeat(64)])('keeps the valid inbound id %j', (id) => {
    expect(resolveRequestId(id)).toBe(id);
  });

  it('generates a UUID when the header is missing', () => {
    expect(resolveRequestId(undefined)).toMatch(uuid);
  });

  it.each(['', 'a'.repeat(65), 'has space', 'line\nbreak', '<script>', 'a, b'])(
    'replaces the invalid inbound id %j',
    (id) => {
      expect(resolveRequestId(id)).toMatch(uuid);
    },
  );

  it('replaces a repeated header', () => {
    expect(resolveRequestId(['abc', 'def'])).toMatch(uuid);
  });

  it('generates a different id each time', () => {
    expect(resolveRequestId(undefined)).not.toBe(resolveRequestId(undefined));
  });
});
