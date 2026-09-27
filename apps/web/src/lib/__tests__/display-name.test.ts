import { describe, it, expect } from 'vitest';
import { toDisplayName } from '@/lib/display-name';

describe('toDisplayName', () => {
  it('title-cases lowercase words', () => {
    expect(toDisplayName('jon high')).toBe('Jon High');
    expect(toDisplayName('microsoft')).toBe('Microsoft');
  });

  it('preserves any token that already carries an uppercase letter', () => {
    expect(toDisplayName('IBM Studio')).toBe('IBM Studio');
    expect(toDisplayName('B2B')).toBe('B2B');
    expect(toDisplayName('acme LLC')).toBe('Acme LLC');
  });

  it('lifts common lowercase entity tokens to caps', () => {
    expect(toDisplayName('acme llc')).toBe('Acme LLC');
    expect(toDisplayName('acme pty ltd')).toBe('Acme PTY LTD');
    expect(toDisplayName('smith & co gmb')).toBe('Smith & Co GMB');
    expect(toDisplayName('b2b partners')).toBe('B2B Partners');
    expect(toDisplayName('acme inc')).toBe('Acme INC');
  });

  it('trims surrounding whitespace', () => {
    expect(toDisplayName('  jon high  ')).toBe('Jon High');
  });

  it('collapses double spaces', () => {
    expect(toDisplayName('jon  high')).toBe('Jon High');
  });

  it('returns an empty string for empty or whitespace input so callers fall back', () => {
    expect(toDisplayName('')).toBe('');
    expect(toDisplayName('   ')).toBe('');
  });

  it('leaves non-letter tokens untouched', () => {
    expect(toDisplayName('studio 2.0')).toBe('Studio 2.0');
    expect(toDisplayName('at&t')).toBe('At&t');
  });

  it('is idempotent', () => {
    expect(toDisplayName(toDisplayName('jon high llc'))).toBe('Jon High LLC');
  });
});
