'use client';

/**
 * SingleSelect Component
 *
 * Custom dropdown for single-selection. Replaces native <select> to ensure
 * consistent white background and styling across all browsers/OS.
 * Uses the same pattern as FilterDropdown with full control over appearance.
 */

import { ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/** Idle window before a keystroke starts a fresh typeahead prefix. */
const TYPEAHEAD_RESET_MS = 500;

export interface SingleSelectOption {
  value: string;
  label: string;
  /**
   * Optional secondary line rendered under the label (e.g. a collision
   * tiebreaker). Typeahead matches the label only — never the description.
   */
  description?: string;
}

interface SingleSelectProps {
  options: SingleSelectOption[];
  value: string;
  onChange: (value: string, label: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
}

export function SingleSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  triggerClassName = '',
  ariaLabel,
}: SingleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectId = useId().replace(/:/g, '');
  const triggerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;
  const listboxId = `${selectId}-listbox`;
  const optionId = (optionValue: string) => `${selectId}-option-${encodeURIComponent(optionValue)}`;

  // Typeahead buffer. A fresh prefix starts after TYPEAHEAD_RESET_MS of idle;
  // a run of the same letter cycles that letter (native select semantics).
  const typeaheadRef = useRef({ text: '', at: 0 });
  const resetTypeahead = () => {
    typeaheadRef.current = { text: '', at: 0 };
  };

  const findNextTypeaheadMatch = (query: string, startIndex: number) => {
    const normalized = query.toLowerCase();
    for (let step = 1; step <= options.length; step++) {
      const index = (startIndex + step) % options.length;
      if (options[index].label.toLowerCase().startsWith(normalized)) return index;
    }
    return -1;
  };

  const handleTypeahead = (char: string, startIndex: number) => {
    const now = Date.now();
    const buffer = typeaheadRef.current;
    const candidate = now - buffer.at <= TYPEAHEAD_RESET_MS ? buffer.text + char : char;
    const isRepeatedRun = candidate.length > 1 && [...candidate].every((c) => c === candidate[0]);
    buffer.text = candidate;
    buffer.at = now;
    const match = findNextTypeaheadMatch(isRepeatedRun ? char : candidate, startIndex);
    return match !== -1 ? match : startIndex;
  };

  // Keep the active option visible inside the scrollable listbox while
  // navigating with the keyboard. Optional-call guards non-browser environments.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const activeOption = options[activeIndex];
    if (!activeOption) return;
    document.getElementById(optionId(activeOption.value))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeIndex, options]);

  useEffect(() => {
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const next = { top: rect.bottom + 4, left: rect.left, width: rect.width };
      setPosition((prev) =>
        prev.top === next.top && prev.left === next.left && prev.width === next.width ? prev : next
      );
    };

    if (isOpen && typeof document !== 'undefined') {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      // Passive: the handler only reads the trigger rect; it never blocks scroll.
      window.addEventListener('scroll', updatePosition, { capture: true, passive: true });
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inTrigger && !inDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: SingleSelectOption) => {
    onChange(option.value, option.label);
    setIsOpen(false);
    triggerButtonRef.current?.focus();
  };

  const open = (index = selectedIndex) => {
    if (options.length === 0) return;
    resetTypeahead();
    setActiveIndex(index);
    setIsOpen(true);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const isPrintable =
      event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey;

    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(event.key === 'ArrowDown' ? (selectedIndex + 1) % options.length : undefined);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        open((selectedIndex - 1 + options.length) % options.length);
        return;
      }

      if (isPrintable && options.length > 0) {
        // Typeahead from a closed list opens it and lands on the first match.
        event.preventDefault();
        setActiveIndex(handleTypeahead(event.key, selectedIndex));
        setIsOpen(true);
        return;
      }
    }

    if (event.key === 'Escape') {
      if (isOpen) {
        // Escape over an open dropdown is the dropdown's keypress, not an
        // ancestor modal's — stop it from closing the modal (e.g. Manage Assets).
        event.preventDefault();
        event.stopPropagation();
      }
      resetTypeahead();
      setIsOpen(false);
      triggerButtonRef.current?.focus();
      return;
    }

    if (!isOpen) return;

    if (isPrintable && options.length > 0) {
      event.preventDefault();
      setActiveIndex(handleTypeahead(event.key, activeIndex));
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const activeOption = options[activeIndex];
      if (activeOption) handleSelect(activeOption);
    }
  };

  const dropdownContent = isOpen && !disabled && typeof document !== 'undefined' && (
    <div
      ref={dropdownRef}
      id={listboxId}
      onKeyDown={(event) => {
        // The dropdown is portaled to document.body, so Escape while option
        // focus is inside the listbox would otherwise bubble straight to an
        // ancestor modal's document listener. Close only the dropdown here.
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          triggerButtonRef.current?.focus();
        }
      }}
      className="fixed z-[100] origin-top bg-white dark:bg-ink border border-border dark:border-white/30 rounded-none shadow-brutalist-sm overflow-auto max-h-[280px] py-1"
      role="listbox"
      aria-activedescendant={options[activeIndex] ? optionId(options[activeIndex].value) : undefined}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        minWidth: position.width,
      }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isActive = activeIndex === index;
        return (
          <button
            key={option.value}
            id={optionId(option.value)}
            type="button"
            onClick={() => handleSelect(option)}
            role="option"
            aria-selected={isSelected}
            data-active={isActive ? 'true' : undefined}
            className={cn(
              'w-full min-h-[44px] px-3 py-2.5 text-left text-sm flex items-center justify-between gap-3',
            'transition-[background-color,color] duration-[var(--motion-hover)] cursor-pointer',
            isSelected
              ? 'bg-accent/20 dark:bg-accent/30 text-ink dark:text-ink font-medium'
                : 'text-ink dark:text-ink hover:bg-coral/10 dark:hover:bg-white/10',
              isActive && 'bg-coral/10 dark:bg-white/10',
              // Active option never holds DOM focus (the trigger does, via
              // aria-activedescendant), so the two-ring coral focus system is
              // drawn here explicitly: inner 3px coral stroke + outer 6px halo.
              isActive &&
                'outline outline-[3px] outline-coral/25 outline-offset-[-3px] shadow-[0_0_0_6px_rgb(var(--coral)/0.08)]'
            )}
          >
            <span className="flex-1 min-w-0">
              <span className="block truncate">{option.label}</span>
              {option.description ? (
                // label-nano already carries the muted-foreground ink (v2.0 mono layer).
                <span className="label-nano block truncate">{option.description}</span>
              ) : null}
            </span>
            {isSelected && (
              <Check className="h-4 w-4 text-[rgb(var(--coral))] flex-shrink-0" strokeWidth={2} />
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div ref={triggerRef} className={cn('relative', className)}>
        <button
          ref={triggerButtonRef}
          type="button"
          role="combobox"
          onClick={() => {
            if (disabled) return;
            if (isOpen) setIsOpen(false);
            else open();
          }}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onKeyDown={handleTriggerKeyDown}
          aria-label={ariaLabel ?? displayLabel}
          className={cn(
            'w-full min-h-[44px] px-3 py-2 pr-5 flex items-center justify-between gap-2',
            'border border-border rounded-none text-sm text-ink',
            'focus:outline-none focus:ring-2 focus:ring-[rgb(var(--coral))] focus:border-[rgb(var(--coral))]',
            'transition-[border-color,background-color] duration-150 appearance-none cursor-pointer',
            disabled
              ? 'bg-muted/30 cursor-not-allowed opacity-70 dark:bg-muted/50'
              : 'bg-white dark:bg-ink hover:border-border/80 dark:border-white/30',
            isOpen && 'ring-2 ring-[rgb(var(--coral))]/20 border-[rgb(var(--coral))]',
            triggerClassName
          )}
        >
          <span className="flex-1 text-left truncate">
            {value ? displayLabel : placeholder}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform duration-150',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </div>

      {dropdownContent &&
        typeof document !== 'undefined' &&
        createPortal(dropdownContent, document.body)}
    </>
  );
}
