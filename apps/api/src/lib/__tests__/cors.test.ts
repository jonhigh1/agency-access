import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  getCorsOptions,
  parseCorsPreviewOrigins,
  VERCEL_PREVIEW_ORIGIN_PATTERN,
} from '@/lib/cors';

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

  it('includes hardcoded AuthHub apex, www, and review lab origins', () => {
    const options = getCorsOptions();

    expect(options.origin).toEqual(
      expect.arrayContaining([
        'https://www.authhub.co',
        'https://authhub.co',
        'https://review.authhub.co',
      ])
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

describe('Vercel preview origins (CORS_ALLOW_VERCEL_PREVIEWS)', () => {
  const allowedPreviews = [
    'https://agency-access-abc123def-jons-projects-1906288f.vercel.app',
    'https://agency-access-git-staging-jons-projects-1906288f.vercel.app',
    'https://agency-access-git-feat-email-invite-jons-projects-1906288f.vercel.app',
  ];

  const lookAlikes = [
    // Wrong scheme, port, suffix or prefix.
    'http://agency-access-abc123def-jons-projects-1906288f.vercel.app',
    'https://agency-access-abc123def-jons-projects-1906288f.vercel.app:8443',
    'https://agency-access-abc123def-jons-projects-1906288f.vercel.app.evil.com',
    'https://agency-access-abc123def-jons-projects-1906288f.vercel.app/',
    'https://evil-agency-access-abc123def-jons-projects-1906288f.vercel.app',
    'https://evil.com/https://agency-access-abc123def-jons-projects-1906288f.vercel.app',
    // Unescaped-dot and team-slug tricks.
    'https://agency-access-abc123def-jons-projects-1906288fXvercel.app',
    'https://agency-access-abc123def-jons-projects-1906288f.vercelXapp',
    'https://agency-access-abc123def-jons-projects-1906288f-evil.vercel.app',
    'https://agency-access-abc123def-other-team-1906288f.vercel.app',
    'https://agency-access--jons-projects-1906288f.vercel.app.attacker.dev',
    // Character-class tricks.
    'https://agency-access-ABC-jons-projects-1906288f.vercel.app',
    'https://agency-access-a.b-jons-projects-1906288f.vercel.app',
    'https://agency-access-abc123def-jons-projects-1906288f.vercel.app\nhttps://evil.com',
    'https://agency-access-jons-projects-1906288f.vercel.app',
    // Outside our own preview URL shapes (deployment hash is exactly 9 chars; branch URLs start with git-).
    'https://agency-access-x-jons-projects-1906288f.vercel.app',
    'https://agency-access-abc123defg-jons-projects-1906288f.vercel.app',
    'https://agency-access-evil-project-jons-projects-1906288f.vercel.app',
    'https://agency-access--jons-projects-1906288f.vercel.app',
    'https://agency-access-git--jons-projects-1906288f.vercel.app',
    'https://agency-access-git-staging--jons-projects-1906288f.vercel.app',
  ];

  async function preflightAllowOrigin(
    origin: string,
    allowVercelPreviews: boolean,
    previewOrigins: string[] = []
  ) {
    const app = Fastify();
    await app.register(
      cors,
      getCorsOptions('https://authhub.co', [], { allowVercelPreviews, previewOrigins })
    );
    app.get('/ping', async () => ({ ok: true }));
    await app.ready();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/ping',
      headers: { origin, 'access-control-request-method': 'GET' },
    });
    await app.close();
    return res.headers['access-control-allow-origin'];
  }

  it('leaves the origin list unchanged (no regex) by default', () => {
    const defaultOptions = getCorsOptions('https://authhub.co');
    const explicitOff = getCorsOptions('https://authhub.co', [], { allowVercelPreviews: false });

    expect(defaultOptions.origin).toEqual(explicitOff.origin);
    expect((defaultOptions.origin as unknown[]).some((o) => o instanceof RegExp)).toBe(false);
  });

  it('appends the anchored preview pattern only when enabled', () => {
    const options = getCorsOptions('https://authhub.co', [], { allowVercelPreviews: true });
    expect(options.origin).toEqual(expect.arrayContaining([VERCEL_PREVIEW_ORIGIN_PATTERN]));
    expect(VERCEL_PREVIEW_ORIGIN_PATTERN.source.startsWith('^')).toBe(true);
    expect(VERCEL_PREVIEW_ORIGIN_PATTERN.source.endsWith('$')).toBe(true);
    expect(VERCEL_PREVIEW_ORIGIN_PATTERN.flags).toBe('');
  });

  it.each(allowedPreviews)('allows %s when enabled', async (origin) => {
    expect(VERCEL_PREVIEW_ORIGIN_PATTERN.test(origin)).toBe(true);
    expect(await preflightAllowOrigin(origin, true)).toBe(origin);
  });

  it.each(allowedPreviews)('disallows %s when disabled (default)', async (origin) => {
    expect(await preflightAllowOrigin(origin, false)).toBeUndefined();
  });

  it.each(lookAlikes)('rejects look-alike %j even when enabled', async (origin) => {
    expect(VERCEL_PREVIEW_ORIGIN_PATTERN.test(origin)).toBe(false);
    if (!origin.includes('\n')) {
      expect(await preflightAllowOrigin(origin, true)).toBeUndefined();
    }
  });

  it('still allows the canonical origins when enabled', async () => {
    expect(await preflightAllowOrigin('https://authhub.co', true)).toBe('https://authhub.co');
    expect(await preflightAllowOrigin('https://evil.example.com', true)).toBeUndefined();
  });

  describe('explicit allowlist (CORS_PREVIEW_ORIGINS)', () => {
    const staging = 'https://agency-access-git-staging-jons-projects-1906288f.vercel.app';
    const otherPreview = 'https://agency-access-abc123def-jons-projects-1906288f.vercel.app';

    it('uses only the listed origins (no pattern) when enabled', async () => {
      const options = getCorsOptions('https://authhub.co', [], {
        allowVercelPreviews: true,
        previewOrigins: [staging],
      });
      expect((options.origin as unknown[]).some((o) => o instanceof RegExp)).toBe(false);
      expect(options.origin).toEqual(expect.arrayContaining([staging]));

      expect(await preflightAllowOrigin(staging, true, [staging])).toBe(staging);
      expect(await preflightAllowOrigin(otherPreview, true, [staging])).toBeUndefined();
    });

    it('ignores the list while the flag is off', async () => {
      const options = getCorsOptions('https://authhub.co', [], {
        allowVercelPreviews: false,
        previewOrigins: [staging],
      });
      expect(options.origin).not.toEqual(expect.arrayContaining([staging]));
      expect(await preflightAllowOrigin(staging, false, [staging])).toBeUndefined();
    });

    it('rejects entries that are not agency-access preview origins', () => {
      expect(() => parseCorsPreviewOrigins(['https://evil.example.com'])).toThrow(
        /CORS_PREVIEW_ORIGINS/
      );
      expect(() =>
        getCorsOptions('https://authhub.co', [], {
          allowVercelPreviews: true,
          previewOrigins: [staging, 'https://agency-access-x-jons-projects-1906288f.vercel.app'],
        })
      ).toThrow(/CORS_PREVIEW_ORIGINS/);
    });

    it('deduplicates listed origins', () => {
      expect(parseCorsPreviewOrigins([staging, staging])).toEqual([staging]);
    });
  });
});
