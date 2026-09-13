/**
 * CreateClientModal Design System Compliance Tests
 *
 * Tests that className strings use correct design tokens
 */

import { describe, it, expect } from 'vitest';

describe('CreateClientModal - Static Design Validation', () => {
  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain slate colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/CreateClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)slate-[0-9]/);
    });

    it('should not contain indigo colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/CreateClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)indigo-[0-9]/);
    });

    it('should not contain red colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/CreateClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)red-[0-9]/);
    });

    it('should not contain green colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/CreateClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)green-[0-9]/);
    });
  });

  describe('Component uses brutalist styling', () => {
    it('should not contain soft shadows (shadow-xl)', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/CreateClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/shadow-(xl|2xl)(?!-brutalist)/);
    });

    it('should use coral for primary actions', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/CreateClientModal.tsx',
        'utf-8'
      );

      // Primary action delegates coral fill to the design-system Button (primary variant)
      expect(componentCode).toMatch(/variant="primary"/);
    });

    it('should use teal for success states', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/CreateClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).toMatch(/text-success-ink[^/]/);
    });
  });
});
