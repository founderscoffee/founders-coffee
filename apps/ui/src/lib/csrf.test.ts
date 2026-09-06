import { describe, expect, it } from 'vitest';

import { isStateChangingRequest } from './csrf';

const request = (method: string) =>
  new Request('http://localhost:3000/', { method });

describe('isStateChangingRequest', () => {
  it('exempts the methods a browser uses to navigate', () => {
    expect(isStateChangingRequest(request('GET'))).toBe(false);
    expect(isStateChangingRequest(request('HEAD'))).toBe(false);
    expect(isStateChangingRequest(request('OPTIONS'))).toBe(false);
  });

  it('still guards every method that can write', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(isStateChangingRequest(request(method))).toBe(true);
    }
  });

  it('is case-insensitive, so a lowercase verb cannot slip the check', () => {
    expect(isStateChangingRequest(request('get'))).toBe(false);
  });
});
