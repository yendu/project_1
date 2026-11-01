import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(loadEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('parses PORT as a number', () => {
    expect(loadEnv({ PORT: '8080', NODE_ENV: 'production' })).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
    });
  });

  it('ignores unrelated variables', () => {
    expect(loadEnv({ HOME: '/home/me' })).not.toHaveProperty('HOME');
  });

  it.each(['0', '65536', '3.5', 'abc', ''])('rejects PORT=%j', (port) => {
    expect(() => loadEnv({ PORT: port })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('does not echo the rejected value', () => {
    expect(() => loadEnv({ PORT: 'secret-value' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret-value') }),
    );
  });
});
