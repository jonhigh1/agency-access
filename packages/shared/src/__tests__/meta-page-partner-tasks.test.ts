import { describe, expect, it } from '@jest/globals';
import {
  metaPagePartnerPermittedTasksSatisfyRequired,
  normalizeMetaPagePartnerTaskName,
} from '../meta-page-partner-tasks';

describe('metaPagePartnerPermittedTasksSatisfyRequired', () => {
  const liveReadbackTasks = [
    'PROFILE_PLUS_MANAGE_LEADS',
    'PROFILE_PLUS_MODERATE',
    'PROFILE_PLUS_MESSAGING',
    'PROFILE_PLUS_ANALYZE',
    'PROFILE_PLUS_ADVERTISE',
    'PROFILE_PLUS_CREATE_CONTENT',
    'PROFILE_PLUS_MANAGE',
  ];

  const reviewDemoRequired = ['MANAGE', 'CREATE_CONTENT', 'MODERATE', 'ADVERTISE'];

  it('verifies true when Meta returns PROFILE_PLUS_* tasks for legacy required names', () => {
    expect(
      metaPagePartnerPermittedTasksSatisfyRequired(liveReadbackTasks, reviewDemoRequired)
    ).toBe(true);
  });

  it('stays false when a required task is genuinely missing after normalization', () => {
    expect(
      metaPagePartnerPermittedTasksSatisfyRequired(
        ['PROFILE_PLUS_ADVERTISE', 'PROFILE_PLUS_CREATE_CONTENT'],
        reviewDemoRequired
      )
    ).toBe(false);
  });

  it('treats plain and PROFILE_PLUS names as equal', () => {
    expect(normalizeMetaPagePartnerTaskName('PROFILE_PLUS_MANAGE')).toBe('MANAGE');
    expect(normalizeMetaPagePartnerTaskName('MANAGE')).toBe('MANAGE');
  });
});
