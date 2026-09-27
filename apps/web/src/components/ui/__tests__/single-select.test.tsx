import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SingleSelect } from '../single-select';

const getActiveDescendantId = () => {
  const listbox = screen.getByRole('listbox');
  return listbox.getAttribute('aria-activedescendant');
};

const getOptionIds = () =>
  screen.getAllByRole('option').map((option) => option.id);

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

describe('SingleSelect typeahead', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('jumps the active option to the first name matching the typed prefix', () => {
    const onChange = vi.fn();
    render(<SingleSelect options={options} value="meta" onChange={onChange} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'g' });

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(getActiveDescendantId()).toBe(getOptionIds()[1]);

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('google', 'Google Ads');
  });

  it('builds a prefix buffer from consecutive keystrokes', () => {
    const onChange = vi.fn();
    render(<SingleSelect options={options} value="meta" onChange={onChange} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 's' });
    fireEvent.keyDown(trigger, { key: 'h' });

    expect(getActiveDescendantId()).toBe(getOptionIds()[2]);
  });

  it('cycles through options sharing the same first letter', () => {
    const onChange = vi.fn();
    const alphabetical = [
      { value: 'alpha', label: 'Alpha' },
      { value: 'armstrong', label: 'Armstrong' },
      { value: 'aurora', label: 'Aurora' },
    ];
    render(<SingleSelect options={alphabetical} value="alpha" onChange={onChange} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);

    fireEvent.keyDown(trigger, { key: 'a' });
    expect(getActiveDescendantId()).toBe(getOptionIds()[1]);

    fireEvent.keyDown(trigger, { key: 'a' });
    expect(getActiveDescendantId()).toBe(getOptionIds()[2]);

    fireEvent.keyDown(trigger, { key: 'a' });
    expect(getActiveDescendantId()).toBe(getOptionIds()[0]);
  });

  it('typeahead matches the option label only, never a secondary description', () => {
    const onChange = vi.fn();
    const described = [
      { value: 'alpha', label: 'Alpha', description: 'Zebra' },
      { value: 'beta', label: 'Beta', description: 'Yak' },
    ];
    render(<SingleSelect options={described} value="alpha" onChange={onChange} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'z' });

    expect(getActiveDescendantId()).toBe(getOptionIds()[0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens the listbox from a printable key when closed and lands on the match', () => {
    const onChange = vi.fn();
    render(<SingleSelect options={options} value="meta" onChange={onChange} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.keyDown(trigger, { key: 's' });

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(getActiveDescendantId()).toBe(getOptionIds()[2]);
  });
});

describe('SingleSelect active-option affordances', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens with ArrowUp when closed, starting from the previous option', () => {
    const onChange = vi.fn();
    render(<SingleSelect options={options} value="shopify" onChange={onChange} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(getActiveDescendantId()).toBe(getOptionIds()[1]);

    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('google', 'Google Ads');
  });

  it('shows the two-ring coral focus treatment on the active option', () => {
    render(<SingleSelect options={options} value="meta" onChange={vi.fn()} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const activeOption = screen
      .getAllByRole('option')
      .find((option) => option.id === getActiveDescendantId());
    expect(activeOption?.className).toContain('outline-[3px]');
    expect(activeOption?.className).toContain('outline-coral/25');
  });

  it('keeps the active option visible by scrolling it into view while navigating', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<SingleSelect options={options} value="meta" onChange={vi.fn()} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('tracks the active option in aria-activedescendant while navigating', () => {
    render(<SingleSelect options={options} value="meta" onChange={vi.fn()} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);

    expect(getActiveDescendantId()).toBe(getOptionIds()[0]);

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(getActiveDescendantId()).toBe(getOptionIds()[1]);
  });

  it('renders an optional secondary description under the option label', () => {
    const described = [{ value: 'alpha', label: 'Alpha', description: 'Retail' }];
    render(<SingleSelect options={described} value="alpha" onChange={vi.fn()} ariaLabel="Platform" />);

    const trigger = screen.getByRole('combobox', { name: 'Platform' });
    fireEvent.click(trigger);

    const option = screen.getByRole('option', { name: /Alpha/ });
    expect(option.textContent).toContain('Retail');
  });
});
