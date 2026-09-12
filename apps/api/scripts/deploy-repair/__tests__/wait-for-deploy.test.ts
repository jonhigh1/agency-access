/**
 * Tests for redeploy verification (U5, R13).
 *
 * Every dependency — the Vercel/Render deploy-status clients and the sleep
 * function — is a fake injected via `deps`. No test here ever performs a
 * real network call or waits in real time (the injected `sleep` resolves
 * immediately).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  waitForDeploy,
  type GetVercelDeploymentFn,
  type ListRenderDeploysFn,
  type RenderWaitTarget,
  type VercelWaitTarget,
  type WaitTarget,
} from '../wait-for-deploy';
import type { VercelDeployment } from '../../deploy-status/vercel';
import type { RenderDeploy } from '../../deploy-status/render';

function immediateSleep() {
  return vi.fn(async () => {});
}

function vercelTarget(): VercelWaitTarget {
  return { platform: 'vercel', options: { token: 't', idOrUrl: 'dpl_abc' } };
}

function renderTarget(): RenderWaitTarget {
  return { platform: 'render', options: { apiKey: 'k', serviceId: 'srv-1' }, deployId: 'dep-1' };
}

function sequencedVercelClient(readyStates: Array<string | null>): GetVercelDeploymentFn {
  let call = 0;
  return async () => {
    const state = readyStates[Math.min(call, readyStates.length - 1)];
    call += 1;
    if (state === null) return null;
    return { uid: 'dpl_abc', url: 'x.vercel.app', readyState: state } as VercelDeployment;
  };
}

function sequencedRenderClient(statuses: Array<string | null>): ListRenderDeploysFn {
  let call = 0;
  return async () => {
    const status = statuses[Math.min(call, statuses.length - 1)];
    call += 1;
    if (status === null) return [];
    return [{ id: 'dep-1', status }] as RenderDeploy[];
  };
}

describe('waitForDeploy', () => {
  it('reports deployed when Vercel readyState reaches READY within the poll budget', async () => {
    const sleep = immediateSleep();
    const result = await waitForDeploy(
      vercelTarget(),
      { pollIntervalMs: 10, timeoutMs: 100 },
      { getVercelDeployment: sequencedVercelClient(['BUILDING', 'BUILDING', 'READY']), sleep }
    );
    expect(result).toEqual({ kind: 'deployed' });
    // Polled 3 times, slept between polls (not before the first).
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('reports deployed when Render status reaches live within the poll budget', async () => {
    const result = await waitForDeploy(
      renderTarget(),
      { pollIntervalMs: 10, timeoutMs: 100 },
      { listRenderDeploys: sequencedRenderClient(['build_in_progress', 'live']), sleep: immediateSleep() }
    );
    expect(result).toEqual({ kind: 'deployed' });
  });

  it('reports failed with the classification attached on a Vercel terminal build-time failure', async () => {
    const result = await waitForDeploy(
      vercelTarget(),
      { pollIntervalMs: 10, timeoutMs: 100 },
      { getVercelDeployment: sequencedVercelClient(['ERROR']), sleep: immediateSleep() }
    );
    expect(result).toEqual({ kind: 'failed', classification: 'build-time' });
  });

  it('reports failed with the classification attached on a Render terminal build failure', async () => {
    const result = await waitForDeploy(
      renderTarget(),
      { pollIntervalMs: 10, timeoutMs: 100 },
      { listRenderDeploys: sequencedRenderClient(['build_failed']), sleep: immediateSleep() }
    );
    expect(result).toEqual({ kind: 'failed', classification: 'build-time' });
  });

  it('reports timeout — distinct from failed — when the poll budget is exhausted still in-progress', async () => {
    const result = await waitForDeploy(
      vercelTarget(),
      { pollIntervalMs: 10, timeoutMs: 35 },
      { getVercelDeployment: sequencedVercelClient(['BUILDING']), sleep: immediateSleep() }
    );
    expect(result).toEqual({ kind: 'timeout' });
  });

  it('keeps polling (does not treat as failed) while the deploy is not yet visible (null)', async () => {
    const result = await waitForDeploy(
      vercelTarget(),
      { pollIntervalMs: 10, timeoutMs: 100 },
      { getVercelDeployment: sequencedVercelClient([null, null, 'READY']), sleep: immediateSleep() }
    );
    expect(result).toEqual({ kind: 'deployed' });
  });

  it('never calls a real timer — uses the injected sleep exclusively', async () => {
    const sleep = immediateSleep();
    await waitForDeploy(
      vercelTarget(),
      { pollIntervalMs: 10, timeoutMs: 50 },
      { getVercelDeployment: sequencedVercelClient(['READY']), sleep }
    );
    // Only one poll needed (immediate success) — sleep never called at all.
    expect(sleep).not.toHaveBeenCalled();
  });

  it('defaults pollIntervalMs/timeoutMs when not overridden (configurable, not hardcoded)', () => {
    expect(DEFAULT_POLL_INTERVAL_MS).toBe(10_000);
    expect(DEFAULT_TIMEOUT_MS).toBe(300_000);
  });

  it('accepts a generically-typed WaitTarget union', () => {
    const targets: WaitTarget[] = [vercelTarget(), renderTarget()];
    expect(targets).toHaveLength(2);
  });
});
