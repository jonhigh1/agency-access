/**
 * Per DEC-015 Phase 3: walker catches set-shaped drift; this test catches
 * transformation-shaped drift — every id the normalizer emits is a registry id.
 */
import { describe, expect, it } from 'vitest';
import { PLATFORMS } from '@agency-platform/shared';
import { normalizePlatformToGroup } from '../transform-platforms';

const REGISTRY_IDS = Object.keys(PLATFORMS);

describe('normalizePlatformToGroup emitted ids', () => {
  it('emits a registry id for every registry id', () => {
    for (const id of REGISTRY_IDS) {
      const group = normalizePlatformToGroup(id);
      expect(REGISTRY_IDS, `normalizePlatformToGroup('${id}') emitted '${group}', which is not a registry id`).toContain(group);
    }
  });

  it('maps the three legacy payload ids to their registry parents', () => {
    expect(normalizePlatformToGroup('whatsapp_business')).toBe('meta');
    expect(normalizePlatformToGroup('youtube_studio')).toBe('google');
    expect(normalizePlatformToGroup('display_video_360')).toBe('google');
  });
});
