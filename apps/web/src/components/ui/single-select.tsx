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

export interface SingleSelectOption {
  value: string;
  label: string;
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
    setActiveIndex(index);
    setIsOpen(true);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      open(event.key === 'ArrowDown' ? (selectedIndex + 1) % options.length : undefined);
      return;
    }

    if (event.key === 'Escape') {
      if (isOpen) {
        // Escape over an open dropdown is the dropdown's keypress, not an
        // ancestor modal's — stop it from closing the modal (e.g. Manage Assets).
        event.preventDefault();
        event.stopPropagation();
      }
      setIsOpen(false);
      triggerButtonRef.current?.focus();
      return;
    }

    if (!isOpen) return;

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
              'w-full px-3 py-2.5 text-left text-sm flex items-center justify-between gap-3',
            'transition-[background-color,color] duration-[var(--motion-hover)] cursor-pointer',
            isSelected
              ? 'bg-accent/20 dark:bg-accent/30 text-ink dark:text-ink font-medium'
                : 'text-ink dark:text-ink hover:bg-coral/10 dark:hover:bg-white/10',
              isActive && 'bg-coral/10 dark:bg-white/10'
            )}
          >
            <span className="flex-1 truncate">{option.label}</span>
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
