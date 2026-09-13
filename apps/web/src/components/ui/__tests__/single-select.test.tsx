import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SingleSelect } from '../single-select';

const options = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
  { value: 'shopify', label: 'Shopify' },
];

describe('SingleSelect keyboard behavior', () => {
  it('opens with ArrowDown and selects the next option with Enter', () => {
    const onChange = vi.fn();
    render(<SingleSelect options={options} value="meta" onChange={onChange} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('shopify', 'Shopify');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes with Escape without changing the selected value', () => {
    const onChange = vi.fn();
    render(<SingleSelect options={options} value="meta" onChange={onChange} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('uses exact property transitions and the square system surface', () => {
    const { container } = render(<SingleSelect options={options} value="meta" onChange={vi.fn()} />);
    const trigger = container.querySelector('button');
    expect(trigger?.className).toContain('transition-[border-color,background-color]');
    expect(trigger?.className).not.toContain('transition-all');
    expect(trigger?.className).toContain('rounded-none');
  });
});
