/**
 * Dashboard Page Design System Compliance Tests
 *
 * Tests that className strings use correct design tokens
 */

import { describe, it, expect } from 'vitest';
import path from 'path';

const COMPONENT_PATH = path.resolve(__dirname, '../page.tsx');

describe('Dashboard Page - Static Design Validation', () => {
  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain slate colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)slate-[0-9]/);
    });

    it('should not contain indigo colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)indigo-[0-9]/);
    });

    it('should not contain red colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)red-[0-9]/);
    });

    it('should not contain blue colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)blue-[0-9]/);
    });

    it('should not contain yellow colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      expect(componentCode).not.toMatch(/className=[^}]*\b(text-|bg-|border-|hover:bg-|hover:border-)yellow-[0-9]/);
    });

    it('should not contain gray colors', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('gray-');
    });
  });

  describe('Component uses brutalist styling', () => {
    it('should not contain soft shadows (shadow-sm)', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      expect(componentCode).not.toMatch(/shadow-(sm|md|lg|xl|2xl)(?!-brutalist)/);
    });

    it('should use coral for primary actions (via Button component or direct)', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      // Coral is used either directly (bg-coral) or via brutalist Button variants
      expect(componentCode).toMatch(/bg-coral|variant="brutalist"/);
      // Consolidation guard: the deprecated rounded brutalist variants stay gone.
      // Without this, swapping variant="brutalist" for variant="brutalist-rounded" still passes.
      expect(componentCode).not.toMatch(/variant="brutalist-(ghost-)?rounded"/);
    });

    it('renders success states through the teal-bearing badge system', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Success color lives in StatusBadge (teal fills per v2.0 contract);
      // the dashboard itself no longer hand-rolls teal states.
      expect(componentCode).toMatch(/StatusBadge/);
    });

    it('should use coral for accent states', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      expect(componentCode).toMatch(/bg-coral[^/]/);
    });

    it('should use ink for headings', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');

      expect(componentCode).toMatch(/text-ink[^/]/);
    });
  });

  describe('Component uses Button component for actions', () => {
    it('should not have inline coral button styles on raw Link/button elements', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Should not have raw Link or button with inline bg-coral + rounded-lg styling
      const inlineButtonPattern = /<(Link|button)\s[^>]*className="[^"]*bg-coral[^"]*rounded-lg[^"]*"/;
      expect(componentCode).not.toMatch(inlineButtonPattern);
    });
  });

  describe('Platform icon chips are square (binary radius)', () => {
    it('does not wrap PlatformIcon in rounded-full chips', () => {
      // Brandfetch logos are square; a round chip shows the ground behind
      // the logo corners. Binary radius: logo chips are square.
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      const roundChipPattern = /rounded-full[^"]*"[^>]*>\s*<PlatformIcon/;
      const roundChipPattern2 = /<PlatformIcon[^>]*\/>\s*<\/div>/; // sanity: wrapper closes after icon
      expect(componentCode).not.toMatch(roundChipPattern);
      expect(componentCode).toMatch(roundChipPattern2);
    });

    it('uses rounded-none for platform chip wrappers', () => {
      const fs = require('fs');
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Both chip wrappers (requests row + connections stack) are square,
      // regardless of class order inside the className string.
      const classNames = componentCode.match(/className="[^"]*"/g) ?? [];
      const squareChips = classNames.filter(
        (cls) => cls.includes('rounded-none') && cls.includes('shrink-0')
      );
      expect(squareChips.length).toBeGreaterThanOrEqual(2);
    });
  });
});
