import { describe, expect, it } from 'vitest';
import { toFieldErrors } from './validation.js';

describe('toFieldErrors', () => {
  it('joins nested paths with dots', () => {
    expect(toFieldErrors([{ message: 'Too big', path: ['items', 0, 'quantity'] }])).toEqual([
      { path: 'items.0.quantity', message: 'Too big' },
    ]);
  });

  it('reads keys from path segment objects', () => {
    expect(
      toFieldErrors([{ message: 'Required', path: [{ key: 'address' }, { key: 'zip' }] }]),
    ).toEqual([{ path: 'address.zip', message: 'Required' }]);
  });

  it('uses an empty path for issues about the whole value', () => {
    expect(toFieldErrors([{ message: 'Expected object' }])).toEqual([
      { path: '', message: 'Expected object' },
    ]);
  });
});
