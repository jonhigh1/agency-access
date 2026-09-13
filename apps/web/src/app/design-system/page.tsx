/**
 * Design System Token Reference
 *
 * A visual showcase of all design tokens for the AuthHub.
 * Access at /design-system during development.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { HealthBadge } from '@/components/ui/health-badge';
import { PlatformIcon } from '@/components/ui/platform-icon';
import { SingleSelect } from '@/components/ui/single-select';

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b border-border py-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <h1 className="font-dela text-5xl md:text-6xl mb-4">Design System</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Visual reference for the AuthHub design tokens and components.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-7xl py-12 space-y-16">
        {/* Color Palette */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Color Palette</h2>

          {/* Primary Surfaces */}
          <div className="mb-8">
            <h3 className="font-sans text-lg font-medium mb-4 text-muted-foreground">Primary Surfaces</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ColorSwatch name="Ink" varName="--ink" hex="#09090B" description="Deep black backgrounds" />
              <ColorSwatch name="Paper" varName="--paper" hex="#FAFAFA" description="Off-white surfaces" />
            </div>
          </div>

          {/* Brand Colors */}
          <div className="mb-8">
            <h3 className="font-sans text-lg font-medium mb-4 text-muted-foreground">Brand Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ColorSwatch name="Coral" varName="--coral" hex="#FF6B35" description="Primary accent (10%)" />
              <ColorSwatch name="Teal" varName="--teal" hex="#00A896" description="Secondary accent (5%)" />
            </div>
          </div>

          {/* Brutalist Accents */}
          <div>
            <h3 className="font-sans text-lg font-medium mb-4 text-muted-foreground">Brutalist Accents</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ColorSwatch name="Acid" varName="--acid" hex="#CCFF00" description="HERO-ONLY (homepage hero)" darkText />
            </div>
          </div>

          {/* Semantic Colors */}
          <div>
            <h3 className="font-sans text-lg font-medium mb-4 text-muted-foreground">Semantic Colors (Accessible)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ColorSwatch name="Warning" varName="--warning" hex="#B45309" description="Warnings, pending (5.2:1 contrast)" />
              <ColorSwatch name="Success ink" varName="--success-ink" hex="#0F766E" description="Success text (5.5:1 contrast)" />
              <ColorSwatch name="Danger ink" varName="--danger-ink" hex="#C2410C" description="Danger text (4.8:1 contrast)" />
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Semantic colors meet WCAG AA contrast requirements (4.5:1 minimum).
              Use for status indicators, badges, and text.
            </p>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Typography</h2>

          <div className="space-y-6">
            <TypeSample family="dela" text="Dela" size="text-4xl md:text-5xl" description="Display headlines, hero text" />
            <TypeSample family="display" text="Outfit Display" size="text-3xl" description="Section headings, subheadings" />
            <TypeSample family="sans" text="Outfit Sans" size="text-xl" description="Body text, UI elements" />
            <TypeSample family="mono" text="JetBrains Mono" size="text-lg" description="Code, data, technical" />
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Buttons</h2>

          <div className="space-y-8">
            <div>
              <h3 className="font-sans text-sm font-medium text-muted-foreground mb-4">Standard Variants</h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="ghost">Ghost</Button>
              </div>
            </div>

            <div>
              <h3 className="font-sans text-sm font-medium text-muted-foreground mb-4">Brutalist Variants</h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="brutalist">Brutalist</Button>
                <Button variant="secondary">Secondary</Button>
              </div>
            </div>

            <div>
              <h3 className="font-sans text-sm font-medium text-muted-foreground mb-4">Sizes</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
              </div>
            </div>

            <div>
              <h3 className="font-sans text-sm font-medium text-muted-foreground mb-4">States</h3>
              <div className="flex flex-wrap gap-4">
                <Button isLoading>Save changes</Button>
                <Button disabled>Disabled</Button>
                <Button variant="primary" leftIcon={<span>→</span>}>With Icon</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Cards</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Standard Card</CardTitle>
                <CardDescription>shadcn/ui base component</CardDescription>
              </CardHeader>
              <CardContent>
              <p className="text-sm text-muted-foreground">Calm surface with square corners and a measured shadow budget.</p>
              </CardContent>
            </Card>

            <div className="brutalist-card p-6">
              <h3 className="font-bold text-lg mb-2">Brutalist Card</h3>
              <p className="text-sm">Hard borders, hard shadows, no blur. Pure brutalist aesthetic.</p>
            </div>

            <div className="border border-border bg-card p-6">
              <h3 className="font-semibold text-lg mb-2">Quiet Surface</h3>
              <p className="text-sm text-muted-foreground">Border-led grouping for supporting content.</p>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Badges</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-sans text-sm font-medium text-muted-foreground mb-4">Status Badges</h3>
              <div className="flex flex-wrap gap-3">
                <StatusBadge badgeVariant="success">Connected</StatusBadge>
                <StatusBadge status="pending" />
                <StatusBadge status="invalid" />
                <StatusBadge badgeVariant="warning">Warning</StatusBadge>
                <StatusBadge badgeVariant="default">Info</StatusBadge>
              </div>
            </div>

            <div>
              <h3 className="font-sans text-sm font-medium text-muted-foreground mb-4">Health Badges</h3>
              <div className="flex flex-wrap gap-3">
                <HealthBadge health="healthy" />
                <HealthBadge health="expiring" />
                <HealthBadge health="expired" />
                <HealthBadge health="unknown" />
              </div>
            </div>
          </div>
        </section>

        {/* Form controls */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Form Controls</h2>
          <div className="grid max-w-2xl gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="design-system-name" className="mb-2 block text-sm font-semibold text-foreground">
                Client name
              </label>
              <input id="design-system-name" defaultValue="Northstar Studio" className="w-full rounded-none border border-black px-4 py-3" />
              <p className="mt-2 text-sm text-muted-foreground">Persistent labels. Immediate focus ring.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">Platform</label>
              <SingleSelect
                options={[
                  { value: 'meta', label: 'Meta Ads' },
                  { value: 'google', label: 'Google Ads' },
                  { value: 'shopify', label: 'Shopify' },
                ]}
                value="meta"
                onChange={() => undefined}
                ariaLabel="Platform"
              />
              <p className="mt-2 text-sm text-muted-foreground">Arrow keys, Enter, Space, Home, End, and Escape.</p>
            </div>
          </div>
        </section>

        {/* Motion contract */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Motion Contract</h2>
          <div className="grid gap-3 border border-border p-6 font-mono text-sm md:grid-cols-2">
            <span>press — 100ms</span>
            <span>hover — 150ms</span>
            <span>surface enter — 180ms</span>
            <span>surface exit — 120ms</span>
            <span>modal enter — 250ms</span>
            <span>modal exit — 150ms</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Reduced motion removes spatial movement and keeps state feedback clear.</p>
        </section>

        {/* Shadows */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Shadows</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <ShadowSample level="sm" />
            <ShadowSample level="default" />
            <ShadowSample level="lg" />
          </div>
        </section>

        {/* Platform Icons */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Platform Icons</h2>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col items-center gap-2 p-4">
              <PlatformIcon platform="meta" size="md" />
              <span className="text-xs text-muted-foreground">Meta</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4">
              <PlatformIcon platform="google" size="md" />
              <span className="text-xs text-muted-foreground">Google</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4">
              <PlatformIcon platform="linkedin" size="md" />
              <span className="text-xs text-muted-foreground">LinkedIn</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4">
              <PlatformIcon platform="tiktok" size="md" />
              <span className="text-xs text-muted-foreground">TikTok</span>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Spacing</h2>

          <div className="space-y-3">
            <SpacingSample value="0" px="0px" />
            <SpacingSample value="1" px="4px" />
            <SpacingSample value="2" px="8px" />
            <SpacingSample value="3" px="12px" />
            <SpacingSample value="4" px="16px" />
            <SpacingSample value="6" px="24px" />
            <SpacingSample value="8" px="32px" />
            <SpacingSample value="12" px="48px" />
            <SpacingSample value="16" px="64px" />
          </div>
        </section>

        {/* Border Radius */}
        <section>
          <h2 className="font-display text-3xl font-semibold mb-6">Border Radius</h2>

          <div className="flex flex-wrap gap-6">
            <RadiusSample value="none" label="Square — default" />
            <RadiusSample value="full" label="Pill / circle" />
          </div>
        </section>
      </div>
    </div>
  );
}

function ColorSwatch({
  name,
  varName,
  hex,
  description,
  darkText = false
}: {
  name: string;
  varName: string;
  hex: string;
  description: string;
  darkText?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div
        className="h-24 w-full border-2 border-border shadow-sm"
        style={{ backgroundColor: hex }}
      />
      <div className="space-y-0.5">
        <p className={`font-medium ${darkText ? 'text-black' : 'text-foreground'}`}>{name}</p>
        <p className="text-xs font-mono text-muted-foreground">{varName}</p>
        <p className="text-xs text-muted-foreground">{hex}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function TypeSample({
  family,
  text,
  size,
  description
}: {
  family: string;
  text: string;
  size: string;
  description: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-baseline gap-4 p-4 border border-border">
      <span className={`font-${family} ${size} min-w-[200px]`}>{text}</span>
      <span className="text-sm text-muted-foreground font-sans">{description}</span>
    </div>
  );
}

const BRUTALIST_SHADOW_CLASSES = {
  sm: 'shadow-brutalist-sm',
  default: 'shadow-brutalist',
  lg: 'shadow-brutalist-lg',
} as const;

function ShadowSample({ level }: { level: keyof typeof BRUTALIST_SHADOW_CLASSES }) {
  return (
    <div className="space-y-2 text-center">
      <div
        className={`h-20 w-full bg-ink ${BRUTALIST_SHADOW_CLASSES[level]}`}
      />
      <p className="text-xs font-mono text-muted-foreground">{BRUTALIST_SHADOW_CLASSES[level]}</p>
    </div>
  );
}

function SpacingSample({ value, px }: { value: string, px: string }) {
  return (
    <div className="flex items-center gap-4">
      <code className="text-xs font-mono bg-muted px-2 py-1 rounded">spacing-{value}</code>
      <div className="h-8 bg-coral/30 border border-black" style={{ width: px }} />
      <span className="text-xs text-muted-foreground">{px}</span>
    </div>
  );
}

const RADIUS_CLASSES = {
  none: 'rounded-none',
  full: 'rounded-full',
} as const;

function RadiusSample({ value, label }: { value: keyof typeof RADIUS_CLASSES, label: string }) {
  return (
    <div className="space-y-2 text-center">
      <div
        className={`h-16 w-16 bg-coral border-2 border-black ${RADIUS_CLASSES[value]}`}
      />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
