/**
 * EditClientModal Design System Compliance Tests
 *
 * Tests that className strings use correct design tokens
 */

import { describe, it, expect } from 'vitest';

describe('EditClientModal - Static Design Validation', () => {
  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain slate colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/EditClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)slate-[0-9]/);
    });

    it('should not contain indigo colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/EditClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)indigo-[0-9]/);
    });

    it('should not contain red colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/EditClientModal.tsx',
        'utf-8'
      );

      // Check for actual red color shades (red-50, 100, 200, 300, 400, 500, 600, 700, 900)
      // but NOT coral or other colors containing "red"
      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)red-[0-9]/);
    });

    it('should not contain green colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/EditClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)green-[0-9]/);
    });
  });

  describe('Component uses brutalist styling', () => {
    it('should not contain soft shadows (shadow-xl)', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/EditClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).not.toMatch(/shadow-(xl|2xl)(?!-brutalist)/);
    });

    it('should use shared Button primitives for primary actions', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/EditClientModal.tsx',
        'utf-8'
      );

      expect(componentCode).toMatch(/import\s+\{\s*Button\s*\}\s+from ['"]@\/components\/ui['"]/);
      expect(componentCode).toMatch(/<Button/g);
    });

    it('closes on verified save without an in-modal success banner', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(
        'src/components/client-detail/EditClientModal.tsx',
        'utf-8'
      );

      // Craft plan P1: the modal closes on verified save and success feedback
      // lives at the destination, not inside the modal.
      expect(componentCode).not.toMatch(/useState.*success|success &&/i);
      expect(componentCode).not.toMatch(/Client updated successfully/);
    });
  });
});
