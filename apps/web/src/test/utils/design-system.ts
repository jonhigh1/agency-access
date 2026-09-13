/**
 * Design System Test Utilities
 * 
 * Helper functions to test if components use correct design tokens
 * per the brutalist design system defined in apps/web/DESIGN_SYSTEM.md
 */

/**
 * Generic Tailwind colors that should NOT be used in components
 * These conflict with the brand color palette (--coral, --teal, --acid)
 */
const GENERIC_COLORS = [
  'slate',
  'indigo', 
  'purple',
  'green',
  'red',
  'blue',
  'yellow',
  'amber',
  'emerald',
  'rose',
  'violet',
] as const;

/**
 * Soft shadows that should be replaced with brutalist shadows
 */
const SOFT_SHADOWS = [
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shadow-2xl',
  'shadow-3xl',
] as const;

/**
 * Non-binary radius classes that conflict with the brutalist binary radius
 * rule (--radius is 0rem; see tailwind.config.ts borderRadius map).
 * rounded-none and rounded-full are sanctioned; every other step is square
 * and therefore a violation when written literally.
 */
const OVER_ROUNDED = [
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'rounded-2xl',
  'rounded-3xl',
];

/**
 * Arbitrary radius values (e.g. rounded-[0.75rem]) are also non-binary.
 */
const ARBITRARY_RADIUS = /rounded-\[/;

/**
 * Test if element uses brutalist shadow class
 * @param className - CSS className string to test
 * @returns true if brutalist shadow is present
 */
export function hasBrutalistShadow(className: string): boolean {
  if (!className) return false;
  // Check if ANY class in the string is a brutalist shadow
  // v2.0 budget: sm / default / lg only — xl/2xl/3xl are retired
  const classes = className.split(/\s+/);
  return classes.some(cls => /shadow-brutalist(-sm|-lg)?$/.test(cls));
}


/**
 * Test if element uses ONLY soft shadows (not brutalist)
 * @param className - CSS className string to test
 * @returns true if soft shadow is detected
 */
export function hasSoftShadow(className: string): boolean {
  if (!className) return false;
  return SOFT_SHADOWS.some(shadow => className.includes(shadow));
}

/**
 * Test if element uses generic color instead of brand color
 * @param className - CSS className string to test
 * @returns true if generic color is detected
 */
export function usesGenericColor(className: string): boolean {
  if (!className) return false;
  return GENERIC_COLORS.some(color => 
    new RegExp(`-${color}[-/]`).test(className)
  );
}

/**
 * Test if element uses proper brand color (not generic)
 * @param className - CSS className string to test
 * @returns true if only brand colors are used
 */
export function usesBrandColor(className: string): boolean {
  if (!className) return true; // No color is acceptable
  return !usesGenericColor(className);
}

/**
 * Test if element has a non-binary border radius
 * @param className - CSS className string to test
 * @returns true if a non-binary radius is detected
 */
export function hasOverRoundedRadius(className: string): boolean {
  if (!className) return false;
  const classes = className.split(/\s+/);
  return classes.some(
    cls => OVER_ROUNDED.includes(cls) || ARBITRARY_RADIUS.test(cls)
  );
}

/**
 * Test if element uses the binary radius contract
 * rounded-none and rounded-full are the only sanctioned curves.
 * @param className - CSS className string to test
 * @returns true if radius complies with binary radius
 */
export function hasBrutalistRadius(className: string): boolean {
  if (!className) return true;
  return !hasOverRoundedRadius(className);
}

/**
 * Test if element uses semantic color correctly
 * Success states should use teal, not green
 * Warning states should use acid, not amber/yellow
 * Danger states should use coral, not red
 */
export function semanticColorMapping(): Record<string, { wrong: string[]; correct: string }> {
  return {
    success: {
      wrong: ['green', 'emerald'],
      correct: 'teal',
    },
    warning: {
      wrong: ['amber', 'yellow'],
      correct: 'acid',
    },
    danger: {
      wrong: ['red', 'rose'],
      correct: 'coral',
    },
    primary: {
      wrong: ['indigo', 'blue', 'purple'],
      correct: 'coral',
    },
  };
}

/**
 * Extract all class names from a className string
 * Handles space-separated and conditionally-joined classes
 */
export function extractClassNames(className: string | undefined): string[] {
  if (!className) return [];
  return className.split(/\s+/).filter(Boolean);
}

/**
 * Check if any class matches a pattern
 */
export function hasClassMatching(className: string | undefined, pattern: RegExp): boolean {
  const classes = extractClassNames(className);
  return classes.some(cls => pattern.test(cls));
}

/**
 * True when an element carries the Button `brutalist` variant class set
 * (uppercase coral CTA with a 2px border). Used by rendered per-view counts.
 */
export function isBrutalistButton(el: Element): boolean {
  const classes = (el.className ?? '').toString().split(/\s+/);
  return ['uppercase', 'bg-coral', 'border-2'].every((marker) => classes.includes(marker));
}

/**
 * Design system violation
 */
export interface DesignSystemViolation {
  type: 'generic-color' | 'soft-shadow' | 'over-rounded' | 'semantic-color';
  className: string;
  suggestion: string;
}

/**
 * Validate a className string against design system rules
 * Returns list of violations found
 */
export function validateDesignSystem(className: string | undefined): DesignSystemViolation[] {
  const violations: DesignSystemViolation[] = [];
  const classes = extractClassNames(className);

  for (const cls of classes) {
    // Check for generic colors
    if (GENERIC_COLORS.some(color => cls.includes(`-${color}`))) {
      violations.push({
        type: 'generic-color',
        className: cls,
        suggestion: 'Use brand color (--coral, --teal, --acid) or semantic token',
      });
    }

    // Check for soft shadows
    if (SOFT_SHADOWS.some(shadow => cls === shadow)) {
      violations.push({
        type: 'soft-shadow',
        className: cls,
        suggestion: 'Use brutalist shadow (shadow-brutalist, shadow-brutalist-lg, etc.)',
      });
    }

    // Check for non-binary radius
    if (OVER_ROUNDED.includes(cls) || ARBITRARY_RADIUS.test(cls)) {
      violations.push({
        type: 'over-rounded',
        className: cls,
        suggestion:
          'Binary radius only: rounded-none or rounded-full (--radius is 0rem)',
      });
    }
  }

  return violations;
}

/**
 * Get the correct brutalist shadow for a given soft shadow.
 * v2.0 shadow budget: three sizes (sm 2px, default 4px, lg 6px).
 * Oversized soft shadows collapse to the lg ceiling.
 */
export function brutalistShadowFor(softShadow: string): string {
  const mapping: Record<string, string> = {
    'shadow-sm': 'shadow-brutalist-sm',
    'shadow-md': 'shadow-brutalist',
    'shadow-lg': 'shadow-brutalist-lg',
    'shadow-xl': 'shadow-brutalist-lg',
    'shadow-2xl': 'shadow-brutalist-lg',
  };
  return mapping[softShadow] || 'shadow-brutalist';
}
