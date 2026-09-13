/**
 * UnifiedWizard Design System Compliance Tests
 *
 * Tests that className strings use correct design tokens
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { resolve } from 'path';

// Test file is in: apps/web/src/components/onboarding/__tests__/
// unified-wizard.tsx is in: ../

const COMPONENT_PATH = resolve(__dirname, '../unified-wizard.tsx');

describe('UnifiedWizard - Static Design Validation', () => {
  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain gray colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('gray-');
    });

    it('should not contain indigo colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Component should NOT have indigo (should be coral or teal)
      expect(componentCode).not.toContain('indigo-');
    });

    it('should not contain purple gradients', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Component should NOT have purple gradients
      expect(componentCode).not.toContain('purple-');
    });

    it('should not contain pink gradients', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Component should NOT have pink gradients
      expect(componentCode).not.toContain('pink-');
    });
  });

  describe('Component uses brutalist shadows', () => {
    it('should not contain soft shadows (shadow-xl, shadow-2xl, shadow-lg)', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Should NOT have soft shadows
      expect(componentCode).not.toMatch(/shadow-(xl|2xl|lg)(?!-brutalist)/);
    });

    it('should use shadow-brutalist for main containers', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Should have at least one brutalist shadow class
      expect(componentCode).toMatch(/shadow-brutalist/);
    });
  });

  describe('Component uses appropriate border radius', () => {
    it('should not contain over-rounded borders (rounded-2xl, rounded-3xl)', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Should NOT have over-rounded borders
      expect(componentCode).not.toMatch(/rounded-(2xl|3xl)/);
    });

    it('should use rounded-lg or rounded-xl for containers', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Should have rounded-lg or rounded-xl
      expect(componentCode).toMatch(/rounded-(lg|xl)(?!-2xl)/);
    });
  });

  describe('Component uses brand colors for CTAs', () => {
    it('should use coral for primary actions', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Primary CTA delegates the coral fill to the design-system Button (brutalist variant)
      expect(componentCode).toMatch(/variant="brutalist"/);
    });
  });

  describe('Light onboarding shell', () => {
    it('should avoid forcing a dark onboarding background', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('min-h-screen bg-ink');
      expect(componentCode).toContain('min-h-screen bg-paper');
    });
  });
});
