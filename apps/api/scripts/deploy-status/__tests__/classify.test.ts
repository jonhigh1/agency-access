/**
 * Tests for the deploy-failure classifier (U2, R6).
 *
 * classifyDeployStatus is pure and has no external dependency, so it is
 * proven first: build-time failures must be repair targets, everything
 * else must route to a human without spending a repair attempt, and an
 * unrecognized status must fail safe to human review rather than being
 * guessed as repairable.
 */

import { describe, expect, it } from 'vitest';
import { classifyDeployStatus, type DeployStatusInput } from '../classify';

describe('classifyDeployStatus', () => {
  describe('Vercel', () => {
    it('classifies READY as success', () => {
      const input: DeployStatusInput = { platform: 'vercel', readyState: 'READY' };
      expect(classifyDeployStatus(input)).toBe('success');
    });

    it('classifies ERROR with an errorCode as build-time', () => {
      const input: DeployStatusInput = {
        platform: 'vercel',
        readyState: 'ERROR',
        errorCode: 'BUILD_FAILED',
      };
      expect(classifyDeployStatus(input)).toBe('build-time');
    });

    it('classifies ERROR without an errorCode as build-time', () => {
      // The plan's happy-path example pairs ERROR with an errorCode, but the
      // readyState itself is the authoritative failure signal; a missing
      // errorCode must not silently downgrade a real build failure.
      const input: DeployStatusInput = { platform: 'vercel', readyState: 'ERROR' };
      expect(classifyDeployStatus(input)).toBe('build-time');
    });

    it('classifies CANCELED as non-actionable, never as a repair target', () => {
      const input: DeployStatusInput = { platform: 'vercel', readyState: 'CANCELED' };
      const result = classifyDeployStatus(input);
      expect(result).toBe('non-actionable');
      expect(result).not.toBe('build-time');
    });

    it('fails safe to platform for an unrecognized readyState', () => {
      const input: DeployStatusInput = { platform: 'vercel', readyState: 'SOME_FUTURE_STATE' };
      expect(classifyDeployStatus(input)).toBe('platform');
    });
  });

  describe('Render', () => {
    it('classifies live as success', () => {
      const input: DeployStatusInput = { platform: 'render', status: 'live' };
      expect(classifyDeployStatus(input)).toBe('success');
    });

    it('classifies build_failed as build-time', () => {
      const input: DeployStatusInput = { platform: 'render', status: 'build_failed' };
      expect(classifyDeployStatus(input)).toBe('build-time');
    });

    it('classifies update_failed as build-time', () => {
      const input: DeployStatusInput = { platform: 'render', status: 'update_failed' };
      expect(classifyDeployStatus(input)).toBe('build-time');
    });

    it('classifies canceled as non-actionable, never as a repair target', () => {
      const input: DeployStatusInput = { platform: 'render', status: 'canceled' };
      const result = classifyDeployStatus(input);
      expect(result).toBe('non-actionable');
      expect(result).not.toBe('build-time');
    });

    it('classifies deactivated (free-plan spin-down) as non-actionable, never as a repair target', () => {
      const input: DeployStatusInput = { platform: 'render', status: 'deactivated' };
      const result = classifyDeployStatus(input);
      expect(result).toBe('non-actionable');
      expect(result).not.toBe('build-time');
    });

    it('fails safe to platform for an unrecognized status', () => {
      const input: DeployStatusInput = { platform: 'render', status: 'some_future_status' };
      expect(classifyDeployStatus(input)).toBe('platform');
    });

    it('fails safe to platform for in-progress statuses (not a repair target while still running)', () => {
      // These are not failures at all; classify must never guess a
      // still-running deploy is repairable.
      for (const status of [
        'created',
        'queued',
        'build_in_progress',
        'update_in_progress',
        'pre_deploy_in_progress',
      ] as const) {
        const input: DeployStatusInput = { platform: 'render', status };
        expect(classifyDeployStatus(input)).toBe('platform');
      }
    });

    it('classifies pre_deploy_failed as build-time', () => {
      // A pre-deploy hook failure is still a build-time / repo-caused
      // failure the agent can inspect logs for and attempt to repair.
      const input: DeployStatusInput = { platform: 'render', status: 'pre_deploy_failed' };
      expect(classifyDeployStatus(input)).toBe('build-time');
    });
  });

  it('never returns build-time for a platform it was not asked to classify as such', () => {
    // Guard against a copy-paste mistake swapping the platform branches.
    const vercelCanceled = classifyDeployStatus({ platform: 'vercel', readyState: 'CANCELED' });
    const renderCanceled = classifyDeployStatus({ platform: 'render', status: 'canceled' });
    expect([vercelCanceled, renderCanceled]).not.toContain('build-time');
  });
});
