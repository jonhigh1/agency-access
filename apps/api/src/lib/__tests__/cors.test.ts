import { describe, it, expect } from 'vitest';
import { getCorsOptions } from '@/lib/cors';

describe('getCorsOptions', () => {
  it('includes x-agency-id headers and exposes cache headers', () => {
    const options = getCorsOptions('http://localhost:3000');

    expect(options.allowedHeaders).toEqual(
      expect.arrayContaining(['x-agency-id', 'X-Agency-Id'])
    );

    expect(options.exposedHeaders).toEqual(
      expect.arrayContaining(['x-cache', 'x-response-time', 'x-cache-hit-rate', 'server-timing'])
    );

    expect(options.methods).toEqual(
      expect.arrayContaining(['OPTIONS'])
    );
  });

  it('includes additional allowed origins for preview frontends', () => {
    const options = getCorsOptions('https://authhub.co', [
      'https://agency-access-beta.vercel.app',
      'https://staging.authhub.co',
    ]);

    expect(options.origin).toEqual(
      expect.arrayContaining([
        'https://authhub.co',
        'https://agency-access-beta.vercel.app',
        'https://staging.authhub.co',
      ])
    );
  });

  it('deduplicates repeated origins across canonical and additional lists', () => {
    const options = getCorsOptions('https://authhub.co', [
      'https://authhub.co',
      'https://agency-access-beta.vercel.app',
      'https://agency-access-beta.vercel.app',
    ]);

    expect(options.origin).toEqual([
      'http://localhost:3000',
      'https://www.authhub.co',
      'https://authhub.co',
      'https://review.authhub.co',
      'https://agency-access-beta.vercel.app',
    ]);
  });
});
