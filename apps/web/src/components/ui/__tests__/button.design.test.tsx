import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import { Button } from '../button';

const COMPONENT_PATH = join(__dirname, '..', 'button.tsx');
const source = readFileSync(COMPONENT_PATH, 'utf-8');

/**
 * v2.0 button contract: five variants (primary, secondary, ghost, danger,
 * brutalist), binary radius (square buttons; icon keeps its circle), and a
 * two-ring focus system derived from the accent.
 */
describe('Button v2.0 variant consolidation', () => {
  it('declares exactly the five v2.0 variants', () => {
    const declared = [...source.matchAll(/^\s{6}([a-z-]+): '/gm)]
      .map(m => m[1])
      .filter(k => ['primary', 'secondary', 'success', 'warning', 'danger', 'ghost', 'brutalist', 'brutalist-ghost', 'brutalist-rounded', 'brutalist-ghost-rounded'].includes(k));
    expect(declared.sort()).toEqual(['brutalist', 'danger', 'ghost', 'primary', 'secondary']);
  });

  it('no longer declares deprecated variants in the type', () => {
    expect(source).not.toContain("'brutalist-ghost'");
    expect(source).not.toContain("'brutalist-rounded'");
    expect(source).not.toContain("'brutalist-ghost-rounded'");
    expect(source).not.toContain("'success'");
    expect(source).not.toContain("'warning'");
  });

  it('renders danger visually distinct from primary', () => {
    const { container: primary } = render(<Button variant="primary">x</Button>);
    const { container: danger } = render(<Button variant="danger">x</Button>);
    const primaryCls = primary.firstElementChild?.className ?? '';
    const dangerCls = danger.firstElementChild?.className ?? '';
    expect(dangerCls).toContain('bg-danger-ink');
    expect(primaryCls).not.toContain('bg-danger-ink');
    expect(dangerCls).not.toBe(primaryCls);
  });

  it('renders all five variants with their distinguishing tokens', () => {
    const classesFor = (variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'brutalist') => {
      const { container } = render(<Button variant={variant}>x</Button>);
      return container.firstElementChild?.className ?? '';
    };

    const primaryCls = classesFor('primary');
    const secondaryCls = classesFor('secondary');
    const ghostCls = classesFor('ghost');
    const dangerCls = classesFor('danger');
    const brutalistCls = classesFor('brutalist');

    // secondary keeps its identity: card surface with the coral hover border
    expect(secondaryCls).toContain('bg-card');
    expect(secondaryCls).toContain('hover:border-coral');

    // ghost keeps its identity: transparent ground
    expect(ghostCls).toContain('bg-transparent');

    // brutalist keeps its identity: coral fill, uppercase label
    expect(brutalistCls).toContain('bg-coral');
    expect(brutalistCls).toContain('uppercase');

    // primary and danger stay distinct from each other and from the rest
    expect(primaryCls).toContain('bg-primary');
    expect(dangerCls).toContain('bg-danger-ink');
    expect(new Set([primaryCls, secondaryCls, ghostCls, dangerCls, brutalistCls]).size).toBe(5);
  });

  it('keeps square corners on standard sizes (binary radius)', () => {
    const { container } = render(<Button variant="primary">x</Button>);
    const cls = container.firstElementChild?.className ?? '';
    expect(cls).not.toMatch(/rounded-(sm|md|lg|xl|2xl)/);
  });

  it('keeps the icon size circular', () => {
    const { container } = render(<Button variant="primary" size="icon" aria-label="close">x</Button>);
    const cls = container.firstElementChild?.className ?? '';
    expect(cls).toContain('rounded-full');
  });

  it('pins the radius flip in the :root block of globals.css (--radius: 0rem)', () => {
    // Binary radius is a token contract: rounded-lg/md/sm all resolve through
    // --radius, so only the :root flip migrates every shadcn primitive.
    const globalsPath = join(__dirname, '../../../app/globals.css');
    const globals = readFileSync(globalsPath, 'utf-8');
    const rootBlock = globals.slice(0, globals.indexOf('.dark'));
    expect(rootBlock).toMatch(/--radius:\s*0rem;/);
  });

  it('uses the accent-derived two-ring focus system', () => {
    const { container } = render(<Button variant="primary">x</Button>);
    const cls = container.firstElementChild?.className ?? '';
    expect(cls).toContain('focus-visible:outline-[3px]');
    expect(cls).toContain('focus-visible:outline-coral/25');
    expect(cls).toContain('focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)]');
  });

  it('keeps the action label in the layout while loading', () => {
    const { container } = render(<Button isLoading>Save changes</Button>);
    const button = container.firstElementChild;
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button?.textContent).toContain('Save changes');
    expect(button?.querySelector('.invisible')).toHaveTextContent('Save changes');
  });

  it('renders asChild as one styled, focusable link', () => {
    render(
      <Button asChild variant="primary">
        <a href="/clients">Open clients</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Open clients' });
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(link).toHaveClass('bg-primary', 'text-primary-foreground', 'min-h-[48px]');
    expect(link.closest('button')).toBeNull();
  });

  it('uses ink foreground on coral primary actions', () => {
    const { container } = render(<Button variant="brutalist">Continue</Button>);
    expect(container.firstElementChild).toHaveClass('bg-coral', 'text-primary-foreground');

    const globals = readFileSync(join(__dirname, '../../../app/globals.css'), 'utf-8');
    expect(globals.match(/--primary-foreground:\s*9 9 11/g)).toHaveLength(2);
  });
});
