/**
 * CancelSubscriptionModal Design System Compliance Tests
 *
 * Tests that className strings use correct design tokens
 */

import { describe, it, expect } from 'vitest';

describe('CancelSubscriptionModal - Static Design Validation', () => {
  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain slate colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/settings/billing/cancel-subscription-modal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toContain('slate-');
    });

    it('should not contain indigo colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/settings/billing/cancel-subscription-modal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toContain('indigo-');
    });

    it('should not contain red colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/settings/billing/cancel-subscription-modal.tsx',
        'utf-8'
      );

      // Should use coral instead of red
      expect(componentCode).not.toContain('red-');
    });

    it('should not contain gray colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/settings/billing/cancel-subscription-modal.tsx',
        'utf-8'
      );

      // Neutrals come from the token layer (muted-foreground, border), not gray-*
      expect(componentCode).not.toContain('gray-');
    });
  });

  describe('Component uses brutalist styling', () => {
    it('should not contain soft shadows (shadow-xl)', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/settings/billing/cancel-subscription-modal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/shadow-xl(?!-brutalist)/);
    });

    it('should use coral for danger states', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/settings/billing/cancel-subscription-modal.tsx',
        'utf-8'
      );

      expect(componentCode).toMatch(/bg-coral/);
    });

    it('should use teal for success states', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/settings/billing/cancel-subscription-modal.tsx',
        'utf-8'
      );

      expect(componentCode).toMatch(/text-success-ink/);
    });
  });
});
