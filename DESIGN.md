---
name: AuthHub
description: Confident operational clarity for client-access workflows.
colors:
  action-coral: "#FF6B35"
  progress-teal: "#00A896"
  signal-acid: "#CCFF00"
  interaction-violet: "#8B5CF6"
  warning-amber: "#B45309"
  canvas-white: "#FFFFFF"
  surface-paper: "#FAFAFA"
  ink-black: "#09090B"
  muted-gray: "#737373"
  border-gray: "#E7E7E7"
  soft-peach: "#FFF7ED"
  midnight-canvas: "#141419"
  midnight-surface: "#1C1C23"
  midnight-border: "#333341"
typography:
  display:
    fontFamily: "Fraunces, serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-coral}"
    textColor: "{colors.canvas-white}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
    height: "48px"
  button-ghost:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.muted-gray}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "44px"
  input-default:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "44px"
  card-default:
    backgroundColor: "{colors.canvas-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

> **Stale — do not use for product UI.** This file predates Design System v2.0 (September 2026).
> The canonical system is [`apps/web/DESIGN_SYSTEM.md`](apps/web/DESIGN_SYSTEM.md) and the tokens in `apps/web/src/app/globals.css`
> (binary radius, one coral accent, Fraunces dropped, no violet). See DEC-008. Regenerating this file from v2.0 is follow-up work.

# Design System: AuthHub

## Overview

**Creative North Star: "Operational Signal"**

AuthHub is a focused operational workspace where every visual decision helps an agency operator understand status and act. Coral signals a primary action, teal confirms progress, and hard-edged elevation marks controls that can be pressed or moved through a workflow. White and near-black surfaces keep the system legible and calm between those signals.

The system is confident, direct, and reassuring. Product surfaces use familiar controls, restrained color, and compact hierarchy; the more expressive Fraunces and Dela Gothic voices are reserved for marketing or exceptional display moments. AuthHub explicitly rejects generic polished SaaS assembled from interchangeable cards, gradients, and decorative metrics, playful consumer styling that trivializes sensitive access work, and developer-console density that makes clients feel unqualified.

**Key Characteristics:**

- Restrained neutral product surfaces with scarce, semantic color.
- Tactile controls and structural hard shadows at moments of action.
- Clear status distinctions that never rely on color alone.
- Familiar product patterns with responsive, reduced-motion-aware feedback.
- Editorial display typography only where design is serving communication, not routine operation.

## Colors

The palette behaves like an operational signal system: neutrals carry the interface, while saturated colors identify action, progress, warning, or an intentionally rare kinetic accent.

### Primary

- **Action Coral:** The primary-action color for decisive, reversible workflow actions and brand emphasis. It must not become ambient decoration.

### Secondary

- **Progress Teal:** Confirmation, connected states, and successful completion. Always pair it with an icon or explicit status text.

### Tertiary

- **Signal Acid:** A rare kinetic accent for exceptional attention, capped at roughly two percent of a screen.
- **Interaction Violet:** An existing hover accent that must remain an interaction cue rather than a general-purpose brand color.
- **Warning Amber:** Warnings, degraded states, and follow-up requirements; never use it as a decorative warm accent.

### Neutral

- **Canvas White:** Primary light-mode canvas and field surface.
- **Surface Paper:** Off-white secondary surface for separating workspace regions.
- **Ink Black:** Highest-emphasis text, hard borders, and structural shadows.
- **Muted Gray:** Secondary copy and inactive labels only when contrast remains WCAG 2.2 AA compliant.
- **Border Gray:** Quiet dividers and field boundaries.
- **Soft Peach:** A sparingly used action-adjacent tint, not a default page background.
- **Midnight Canvas, Surface, and Border:** The dark-mode neutral layers; saturated accents retain their semantic roles.

**The Signal Rarity Rule.** Coral identifies the primary action, teal confirms progress, and acid marks exceptional attention. If several saturated colors compete in one region, the hierarchy is broken.

**The Status Redundancy Rule.** Every status color must be paired with plain-language text and, where practical, a distinct icon or shape.

## Typography

**Display Font:** Fraunces (with serif fallback)
**Body Font:** Outfit (with system-ui and sans-serif fallbacks)
**Label/Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** Outfit carries the product with direct, approachable clarity. Fraunces adds controlled editorial confidence to marketing and major communication moments; JetBrains Mono is reserved for identifiers, technical values, and compact metadata. Dela Gothic One may appear only as an exceptional marketing display face.

### Hierarchy

- **Display** (600, 3rem, 1.1): Marketing headlines and rare product welcome moments. Never use for labels, buttons, or routine page titles.
- **Headline** (600, 2rem, 1.2): Major page or section orientation.
- **Title** (600, 1.25rem, 1.3): Panel, dialog, and workflow-step titles.
- **Body** (400, 1rem, 1.5): Instructions, descriptions, and product copy; prose lines should stay within 65–75 characters.
- **Label** (600, 0.875rem, 1.25): Controls, field labels, statuses, and compact metadata.

**The Product Voice Rule.** Outfit is mandatory for operational UI. Display fonts never appear in buttons, field labels, navigation, tables, or status text.

**The Read-It-Once Rule.** Favor sentence case, concrete nouns, and explicit states. Uppercase tracking is reserved for rare, short labels; it is not a section scaffold.

## Elevation

AuthHub uses a hybrid elevation system. Most surfaces are flat and separated by tonal layers or quiet borders. Hard black shadows are structural and tactile: they identify high-salience controls or deliberately forceful marketing elements, not generic card depth. Dark mode inverts hard shadows to white where required for visibility.

### Shadow Vocabulary

- **Hard Control** (`4px 4px 0 #000`): Primary tactile controls and compact signature elements.
- **Hard Emphasis** (`6px 6px 0 #000`): Hovered controls or a single emphasized surface.
- **Hard Feature** (`8px 8px 0 #000`): Rare, large marketing or workflow focal point.
- **Quiet Surface** (`0 1px 2px rgba(0, 0, 0, 0.05)`): Subtle separation for standard cards and utility controls.

**The Structural Shadow Rule.** A hard shadow must communicate pressability or deliberate hierarchy. Never pair a quiet one-pixel border with a wide soft decorative shadow.

**The Flat Workspace Rule.** Routine dashboard regions remain flat. When every card is lifted, nothing is important.

## Components

Components feel tactile and confident at decision points, then recede into restrained, familiar controls during routine work.

### Buttons

- **Shape:** Gently curved for product actions (8–12px); explicitly brutalist variants use square corners.
- **Primary:** Action Coral with white text, a two-pixel high-contrast border, 12px × 24px padding, and a minimum 48px height.
- **Hover / Focus:** Hover shifts upward by 2px or collapses a hard shadow within 150–200ms. Keyboard focus always uses a visible two-pixel Action Coral ring with background offset. Reduced motion removes translation and scaling.
- **Secondary / Ghost:** Secondary actions use a neutral surface and defined border. Ghost actions are transparent and use muted text until hover. Disabled actions retain their label and affordance at reduced opacity.
- **State:** Loading preserves the button width, announces progress, and disables repeated activation.

### Cards / Containers

- **Corner Style:** Gently curved product containers (12px); square corners are reserved for explicit brutalist emphasis.
- **Background:** Canvas White or the appropriate dark-mode surface.
- **Shadow Strategy:** Flat or Quiet Surface by default; hard shadows only for signature actionable regions.
- **Border:** One-pixel Border Gray for routine containers; two-pixel Ink Black only for high-salience tactile patterns.
- **Internal Padding:** 16px for compact controls and 24px for standard cards.

### Inputs / Fields

- **Style:** Canvas White, one-pixel Border Gray, 10px corners, and a minimum 44px control height.
- **Focus:** Two-pixel Action Coral ring with a two-pixel canvas offset; never remove the outline without this replacement.
- **Error / Disabled:** Errors pair explicit copy with semantic styling. Disabled fields remain legible and clearly non-interactive.

### Navigation

The desktop workspace uses a collapsible 250px/72px sidebar with familiar Lucide icons and Outfit labels. Active destinations use a tonal neutral fill and stronger text, not a decorative accent. Mobile navigation becomes a full-screen modal surface with a clear close control and at least 44px targets. Navigation transitions last 200–250ms and become instant when reduced motion is requested.

### Status and Access Progress

Status rows combine a plain-language state, an icon, and a semantic color. Partial success, pending, revoked, failed, and unknown must remain visually and verbally distinct. The next responsible actor and next action belong near the status rather than in a detached help panel.

## Do's and Don'ts

### Do:

- **Do** reserve Action Coral for the primary action and Progress Teal for confirmed progress.
- **Do** use Outfit throughout operational UI and preserve at least 44px touch targets.
- **Do** distinguish complete, partial, pending, revoked, failed, and unknown states with text plus non-color cues.
- **Do** use flat neutral workspace regions and spend hard shadows only on tactile or intentionally emphasized elements.
- **Do** provide visible keyboard focus, reduced-motion behavior, responsive layouts, and WCAG 2.2 AA contrast.
- **Do** explain the next required action and responsible actor beside errors or incomplete states.

### Don't:

- **Don't** resemble generic polished SaaS assembled from interchangeable cards, gradients, and decorative metrics.
- **Don't** use playful consumer styling that trivializes security-sensitive access work.
- **Don't** reproduce the intimidating density, jargon, or visual austerity of a developer console.
- **Don't** use color alone to communicate status, selection, error, or success.
- **Don't** use display fonts in navigation, labels, buttons, tables, or routine product headings.
- **Don't** repeat uppercase tracked eyebrows or numbered markers as section scaffolding.
- **Don't** pair one-pixel borders with wide soft decorative shadows, use gradient text, or introduce decorative glassmorphism.
- **Don't** exceed 16px corner radii on cards, sections, or inputs.
