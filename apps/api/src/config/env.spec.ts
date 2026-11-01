import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: [],
    });
  });

  it('parses PORT as a number', () => {
    expect(loadEnv({ PORT: '8080', NODE_ENV: 'production' })).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: [],
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

  it.each(['debug', 'silent'])('accepts LOG_LEVEL=%s', (level) => {
    expect(loadEnv({ LOG_LEVEL: level }).LOG_LEVEL).toBe(level);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => loadEnv({ LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('parses CORS_ORIGINS as a comma-separated list of origins', () => {
    expect(
      loadEnv({ CORS_ORIGINS: 'https://dashboard.example.com, http://localhost:3001' })
        .CORS_ORIGINS,
    ).toEqual(['https://dashboard.example.com', 'http://localhost:3001']);
  });

  it.each([
    '*',
    'example.com',
    'https://example.com/',
    'https://example.com/path',
    'https://Example.com',
  ])('rejects CORS_ORIGINS=%j, which is not an exact origin', (origin) => {
    expect(() => loadEnv({ CORS_ORIGINS: origin })).toThrow(/CORS_ORIGINS/);
  });

  it('rejects more than 20 CORS origins', () => {
    const origins = Array.from({ length: 21 }, (_, i) => `https://app${i}.example.com`).join(',');
    expect(() => loadEnv({ CORS_ORIGINS: origins })).toThrow(/CORS_ORIGINS/);
  });

  it('does not echo the rejected value', () => {
    expect(() => loadEnv({ PORT: 'secret-value' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret-value') }),
    );
  });
});
