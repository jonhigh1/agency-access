/**
 * Onboarding Screens Design System Compliance Tests
 *
 * Tests that className strings use correct design tokens
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { resolve } from 'path';

// Test file is in: apps/web/src/components/onboarding/screens/__tests__/
// Screen files are in: ../ (sibling directory, no subfolder)
// onboarding/ files are in: ../../ (parent directory)

describe('Platform Selection Screen - Static Design Validation', () => {
  const COMPONENT_PATH = resolve(__dirname, '../platform-selection-screen.tsx');

  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain indigo colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('indigo-');
    });

    it('should not contain blue colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('blue-');
    });

    it('should not contain gray colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('gray-');
    });
  });

  describe('Component uses brutalist styling', () => {
    it('should not contain soft shadows (shadow-xl, shadow-2xl)', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toMatch(/shadow-(xl|2xl)(?!-brutalist)/);
    });

    it('should not contain rounded-2xl', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toMatch(/rounded-2xl/);
    });

    it('should use coral for step indicator', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/text-danger-ink/);
    });

    it('should use ink for text', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/text-ink/);
    });
  });
});

describe('Platform Selector Grid - Static Design Validation', () => {
  const COMPONENT_PATH = resolve(__dirname, '../../platform-selector-grid.tsx');

  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain indigo colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('indigo-');
    });

    it('should not contain blue colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('blue-');
    });

    it('should not contain purple colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('purple-');
    });

    it('should not contain gray colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('gray-');
    });

    it('should not contain orange colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('orange-');
    });
  });

  describe('Component uses brutalist styling', () => {
    it('should not contain soft shadows (shadow-xl, shadow-2xl)', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toMatch(/shadow-(xl|2xl)(?!-brutalist)/);
    });

    it('should not contain rounded-2xl', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toMatch(/rounded-2xl/);
    });

    it('should use teal for selected states', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/border-teal/);
    });

    it('should use teal for recommended badge', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/bg-teal/);
    });

    it('should use brutalist shadows', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/shadow-brutalist/);
    });

    it('should use ink for text', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/text-ink/);
    });

    it('should use paper for card backgrounds', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/bg-paper/);
    });
  });

  describe('Component uses PlatformIcon instead of emojis', () => {
    it('should import PlatformIcon component', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toContain("from '@/components/ui/platform-icon'");
      expect(componentCode).toContain('PlatformIcon');
    });

    it('should not contain emoji icons', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      // Should not have emoji-based icon mapping
      expect(componentCode).not.toContain("google: '🔍'");
      expect(componentCode).not.toContain("meta: '📱'");
      expect(componentCode).not.toContain("linkedin: '💼'");
    });
  });
});

describe('Welcome Screen - Static Design Validation', () => {
  const COMPONENT_PATH = resolve(__dirname, '../welcome-screen.tsx');

  describe('Welcome screen content', () => {
    it('should not include demo video content', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('Watch 30-second demo');
      expect(componentCode).not.toContain('placeholder-video-thumbnail.jpg');
      expect(componentCode).not.toContain('Watch demo video');
    });
  });

  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain indigo colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('indigo-');
    });

    it('should not contain purple colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('purple-');
    });
  });

  describe('Component uses brutalist styling', () => {
    it('should not contain soft shadows (shadow-xl, shadow-2xl)', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toMatch(/shadow-(xl|2xl)(?!-brutalist)/);
    });

    it('should not contain rounded-2xl', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toMatch(/rounded-2xl/);
    });
  });
});

describe('Final Success Screen - Static Design Validation', () => {
  const COMPONENT_PATH = resolve(__dirname, '../final-success-screen.tsx');

  describe('Component has no hardcoded generic color classes', () => {
    it('should not contain green colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('green-');
    });

    it('should not contain emerald colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('emerald-');
    });

    it('should not contain indigo colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('indigo-');
    });

    it('should not contain purple colors', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toContain('purple-');
    });
  });

  describe('Component uses brutalist styling', () => {
    it('should not contain soft shadows (shadow-xl, shadow-2xl)', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toMatch(/shadow-(xl|2xl)(?!-brutalist)/);
    });

    it('should not contain rounded-2xl', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).not.toMatch(/rounded-2xl/);
    });

    it('should use coral for primary actions', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/bg-coral/);
    });

    it('should use semantic ink tokens for status states', () => {
      const componentCode = fs.readFileSync(COMPONENT_PATH, 'utf-8');
      expect(componentCode).toMatch(/text-(success-ink|danger-ink)/);
    });
  });
});

describe('All Onboarding Screens - No Raw gray-* Colors', () => {
  const screenFiles = [
    'welcome-screen.tsx',
    'agency-profile-screen.tsx',
    'client-selection-screen.tsx',
    'team-invite-screen.tsx',
    'final-success-screen.tsx',
    'success-link-screen.tsx',
  ];

  for (const screen of screenFiles) {
    it(`${screen} should not contain gray- colors`, () => {
      const code = fs.readFileSync(resolve(__dirname, `../${screen}`), 'utf-8');
      expect(code).not.toContain('gray-');
    });
  }

  it('wizard-client-invite-preview.tsx should not contain gray- colors', () => {
    const code = fs.readFileSync(resolve(__dirname, '../../wizard-client-invite-preview.tsx'), 'utf-8');
    expect(code).not.toContain('gray-');
  });

  it('opinionated-input.tsx should not contain gray- colors', () => {
    const code = fs.readFileSync(resolve(__dirname, '../../opinionated-input.tsx'), 'utf-8');
    expect(code).not.toContain('gray-');
  });
});

describe('All Onboarding Screens - No Raw indigo-* Colors', () => {
  const screensWithIndigo = [
    'agency-profile-screen.tsx',
    'client-selection-screen.tsx',
    'team-invite-screen.tsx',
  ];

  for (const screen of screensWithIndigo) {
    it(`${screen} should not contain indigo- colors`, () => {
      const code = fs.readFileSync(resolve(__dirname, `../${screen}`), 'utf-8');
      expect(code).not.toContain('indigo-');
    });
  }

  it('wizard-client-invite-preview.tsx should not contain indigo- colors', () => {
    const code = fs.readFileSync(resolve(__dirname, '../../wizard-client-invite-preview.tsx'), 'utf-8');
    expect(code).not.toContain('indigo-');
  });

  it('opinionated-input.tsx should not contain indigo- colors', () => {
    const code = fs.readFileSync(resolve(__dirname, '../../opinionated-input.tsx'), 'utf-8');
    expect(code).not.toContain('indigo-');
  });
});

describe('All Onboarding Screens - No Other Raw Colors', () => {
  const rawColors = ['green-', 'blue-', 'red-', 'amber-', 'emerald-'];

  const fileMap: Record<string, string> = {
    'agency-profile-screen.tsx': '../agency-profile-screen.tsx',
    'client-selection-screen.tsx': '../client-selection-screen.tsx',
    'team-invite-screen.tsx': '../team-invite-screen.tsx',
    'success-link-screen.tsx': '../success-link-screen.tsx',
    'wizard-client-invite-preview.tsx': '../../wizard-client-invite-preview.tsx',
    'wizard-connected-example.tsx': '../../wizard-connected-example.tsx',
    'opinionated-input.tsx': '../../opinionated-input.tsx',
  };

  for (const [name, relPath] of Object.entries(fileMap)) {
    it(`${name} should not contain raw green/blue/red/amber/emerald colors`, () => {
      const code = fs.readFileSync(resolve(__dirname, relPath), 'utf-8');
      for (const color of rawColors) {
        expect(code).not.toContain(color);
      }
    });
  }
});
