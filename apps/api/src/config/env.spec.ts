import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const DATABASE_URL = 'postgres://food_delivery:food_delivery@localhost:5432/food_delivery';
// Variables without a default, so each test only states what it is about.
const required = { DATABASE_URL };

describe('loadEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    expect(loadEnv(required)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: [],
      DATABASE_URL,
      DATABASE_POOL_MAX: 10,
    });
  });

  it('parses PORT as a number', () => {
    expect(loadEnv({ ...required, PORT: '8080', NODE_ENV: 'production' })).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      LOG_LEVEL: 'info',
      CORS_ORIGINS: [],
      DATABASE_URL,
      DATABASE_POOL_MAX: 10,
    });
  });

  it('ignores unrelated variables', () => {
    expect(loadEnv({ ...required, HOME: '/home/me' })).not.toHaveProperty('HOME');
  });

  it.each(['0', '65536', '3.5', 'abc', ''])('rejects PORT=%j', (port) => {
    expect(() => loadEnv({ ...required, PORT: port })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadEnv({ ...required, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it.each(['debug', 'silent'])('accepts LOG_LEVEL=%s', (level) => {
    expect(loadEnv({ ...required, LOG_LEVEL: level }).LOG_LEVEL).toBe(level);
  });

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => loadEnv({ ...required, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('parses CORS_ORIGINS as a comma-separated list of origins', () => {
    expect(
      loadEnv({
        ...required,
        CORS_ORIGINS: 'https://dashboard.example.com, http://localhost:3001',
      }).CORS_ORIGINS,
    ).toEqual(['https://dashboard.example.com', 'http://localhost:3001']);
  });

  it.each([
    '*',
    'example.com',
    'https://example.com/',
    'https://example.com/path',
    'https://Example.com',
  ])('rejects CORS_ORIGINS=%j, which is not an exact origin', (origin) => {
    expect(() => loadEnv({ ...required, CORS_ORIGINS: origin })).toThrow(/CORS_ORIGINS/);
  });

  it('rejects more than 20 CORS origins', () => {
    const origins = Array.from({ length: 21 }, (_, i) => `https://app${i}.example.com`).join(',');
    expect(() => loadEnv({ ...required, CORS_ORIGINS: origins })).toThrow(/CORS_ORIGINS/);
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it.each([
    'postgres://app:secret@db.internal:5432/app',
    'postgresql://app:secret@db.internal/app?sslmode=require',
  ])('accepts DATABASE_URL=%j', (url) => {
    expect(loadEnv({ DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it.each(['', 'localhost:5432/app', 'mysql://app:secret@db.internal/app', 'https://db.internal'])(
    'rejects DATABASE_URL=%j',
    (url) => {
      expect(() => loadEnv({ DATABASE_URL: url })).toThrow(/DATABASE_URL/);
    },
  );

  it('parses DATABASE_POOL_MAX as a number', () => {
    expect(loadEnv({ ...required, DATABASE_POOL_MAX: '25' }).DATABASE_POOL_MAX).toBe(25);
  });

  it.each(['0', '101', '2.5', 'abc'])('rejects DATABASE_POOL_MAX=%j', (max) => {
    expect(() => loadEnv({ ...required, DATABASE_POOL_MAX: max })).toThrow(/DATABASE_POOL_MAX/);
  });

  it.each([
    ['PORT', { PORT: 'secret-value' }],
    ['DATABASE_URL', { DATABASE_URL: 'mysql://app:secret-value@db.internal/app' }],
  ])('does not echo a rejected %s', (_name, source) => {
    expect(() => loadEnv({ ...required, ...source })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret-value') }),
    );
  });
});
