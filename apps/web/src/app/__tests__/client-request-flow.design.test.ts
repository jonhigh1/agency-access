import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FILES_TO_VALIDATE = [
  'src/app/(authenticated)/access-requests/new/page.tsx',
  'src/app/(authenticated)/access-requests/[id]/success/page.tsx',
  'src/app/invite/[token]/page.tsx',
  'src/app/invite/oauth-callback/page.tsx',
  'src/app/invite/[token]/beehiiv/manual/page.tsx',
  'src/app/invite/[token]/kit/manual/page.tsx',
  'src/app/invite/[token]/mailchimp/manual/page.tsx',
  'src/app/invite/[token]/klaviyo/manual/page.tsx',
  'src/app/invite/[token]/pinterest/manual/page.tsx',
  'src/app/invite/[token]/shopify/manual/page.tsx',
  'src/components/client-selector.tsx',
  'src/components/template-selector.tsx',
  'src/components/hierarchical-platform-selector.tsx',
  'src/components/save-as-template-modal.tsx',
  'src/components/flow/flow-shell.tsx',
  'src/components/flow/invite-flow-shell.tsx',
  'src/components/flow/invite-hero-header.tsx',
  'src/components/flow/invite-support-card.tsx',
  'src/components/flow/invite-platform-stage.tsx',
  'src/components/flow/invite-platform-queue-item.tsx',
  'src/components/flow/invite-trust-note.tsx',
  'src/components/flow/invite-load-state-card.tsx',
  'src/components/flow/manual-invite-header.tsx',
  'src/components/flow/manual-checklist-wizard.tsx',
];

const GENERIC_COLOR_REGEX = /\b(?:slate|indigo|gray|red|green|yellow|amber|purple|blue)-\d{2,3}\b/;

describe('Client Request Flow Design Compliance', () => {
  it('does not use generic Tailwind palette classes in scoped flow files', () => {
    for (const filePath of FILES_TO_VALIDATE) {
      const source = readFileSync(filePath, 'utf-8');
      expect(source).not.toMatch(GENERIC_COLOR_REGEX);
    }
  });

  it('uses shared flow shell primitives in creator and invite core pages', () => {
    const creatorSource = readFileSync(
      'src/app/(authenticated)/access-requests/new/page.tsx',
      'utf-8'
    );
    const inviteSource = readFileSync(
      'src/app/invite/[token]/client-invite-page.tsx',
      'utf-8'
    );

    expect(creatorSource).toContain('FlowShell');
    expect(inviteSource).toContain('InviteFlowShell');
  });
});
