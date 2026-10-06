import { describe, expect, it } from 'vitest';
import {
  META_GRANT_ROW_COPY,
  agencyUnresolvedStatusLabel,
  metaGrantRowClientAction,
  resolveMetaGrantPhaseHeader,
  resolveMetaGrantPrimaryStatus,
} from '../client-invite-status';
import { buildMetaGrantChecklist } from '../meta-grant-checklist';

describe('client-invite-status (CF-01)', () => {
  it('treats manual ad-account pending as Needs you, not Preparing or Waiting', () => {
    const checklist = buildMetaGrantChecklist({
      selectedKinds: { adAccounts: 1, pages: 0, instagramAccounts: 0, catalogs: 0, datasets: 0 },
    });
    const item = checklist.items[0];
    expect(item.primaryStatus).toBe('needs_you');
    expect(item.clientAction).toBe(META_GRANT_ROW_COPY.needsYouManual);
    expect(item.clientAction).not.toMatch(/preparing/i);
  });

  it('uses Waiting only when automatic share is in flight on the server', () => {
    const primary = resolveMetaGrantPrimaryStatus(
      'pending',
      'automatic',
      [{ status: 'sharing_attempted' } as never]
    );
    expect(primary).toBe('waiting');
    expect(
      metaGrantRowClientAction('pending', 'automatic', [{ status: 'sharing_attempted' } as never])
    ).toBe(META_GRANT_ROW_COPY.waitingOnMeta);
  });

  it('does not use success Connected header copy while grant work remains', () => {
    const checklist = buildMetaGrantChecklist({
      selectedKinds: { adAccounts: 1, pages: 0, instagramAccounts: 0, catalogs: 0, datasets: 0 },
    });
    const header = resolveMetaGrantPhaseHeader(checklist);
    expect(header.successTone).toBe(false);
    expect(header.title).toBe('Meta signed in');
    expect(header.subtitle).toMatch(/needs you/i);
  });

  it('maps agency unresolved reasons to the same vocabulary', () => {
    expect(agencyUnresolvedStatusLabel('selected')).toBe('Needs you');
    expect(agencyUnresolvedStatusLabel('sharing_attempted')).toBe('Waiting');
    expect(agencyUnresolvedStatusLabel('verified')).toBe('Waiting');
  });
});
