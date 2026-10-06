'use client';

import { useState, useRef, useEffect, useCallback, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Check, Search } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  name: string;
  description?: string;
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  showSelectAll?: boolean;
  maxVisibleTags?: number;
  showClearAll?: boolean;
  onSelectAll?: () => void;
}

export function MultiSelectCombobox({
  options,
  selectedIds,
  onSelectionChange,
  placeholder = 'Select accounts to share...',
  label,
  className = '',
  showSelectAll = true,
  maxVisibleTags = 5,
  showClearAll = true,
  onSelectAll,
}: MultiSelectComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 400 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Calculate dropdown position when opening or on scroll/resize
  // Using getBoundingClientRect() which gives viewport-relative coordinates
  // Fixed positioning is relative to viewport, so no need to add scroll offsets
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      
      // Find the scrollable parent container to constrain dropdown height
      let scrollParent: HTMLElement | null = inputRef.current.parentElement;
      while (scrollParent) {
        const style = window.getComputedStyle(scrollParent);
        const overflow = style.overflow + style.overflowY;
        if (overflow.includes('auto') || overflow.includes('scroll') || overflow.includes('hidden')) {
          break;
        }
        scrollParent = scrollParent.parentElement;
      }
      
      // Calculate available space from input bottom to container bottom (or viewport)
      let availableHeight = window.innerHeight - inputRect.bottom - 24; // 24px padding from viewport bottom
      
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const spaceToParentBottom = parentRect.bottom - inputRect.bottom - 16; // 16px padding
        availableHeight = Math.min(availableHeight, spaceToParentBottom);
      }
      
      // Ensure minimum usable height (200px) but cap at 400px max
      const maxHeight = Math.max(150, Math.min(availableHeight, 400));
      
      setDropdownPosition({
        top: inputRect.bottom + 8, // 8px gap below input
        left: inputRect.left,
        width: inputRect.width,
        maxHeight,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      
      // Update position on scroll or resize
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = containerRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);

      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsOpen(false);
        setSearchQuery('');
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return options.filter((option) =>
      option.name.toLowerCase().includes(query) || option.id.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Get selected options
  const selectedOptions = options.filter((option) => selectedIds.has(option.id));

  // Calculate selection state for "Select All"
  const isAllSelected = selectedOptions.length === options.length && options.length > 0;
  const isPartiallySelected = selectedOptions.length > 0 && !isAllSelected;

  // Toggle selection
  const toggleSelection = useCallback((optionId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(optionId)) {
      newSelection.delete(optionId);
    } else {
      newSelection.add(optionId);
    }
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange]);

  // Select or deselect all
  const handleSelectAll = useCallback(() => {
    if (onSelectAll) {
      onSelectAll();
    } else {
      // Default behavior: toggle all
      const newSelection = isAllSelected
        ? new Set<string>()
        : new Set(options.map(opt => opt.id));
      onSelectionChange(newSelection);
    }
    setIsOpen(false);
  }, [isAllSelected, options, onSelectAll, onSelectionChange]);

  // Remove selected item
  const removeItem = useCallback((optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelection = new Set(selectedIds);
    newSelection.delete(optionId);
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange]);

  // Clear all selections
  const handleClearAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(filteredOptions.length > 0 ? 0 : -1);
        } else {
          setFocusedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(filteredOptions.length > 0 ? 0 : -1);
        } else if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
          toggleSelection(filteredOptions[focusedIndex].id);
        }
        break;
      case ' ':
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(filteredOptions.length > 0 ? 0 : -1);
        } else if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
          toggleSelection(filteredOptions[focusedIndex].id);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        setFocusedIndex(-1);
        break;
    }
  }, [isOpen, focusedIndex, filteredOptions, toggleSelection]);

  // Count of hidden selected items
  const visibleSelected = selectedOptions.slice(0, maxVisibleTags);
  const hiddenCount = selectedOptions.length - maxVisibleTags;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-[rgb(var(--ink))] mb-2">{label}</label>
      )}

      {/* Select All Button (Outside Dropdown) */}
      {showSelectAll && options.length > 1 && (
        <button
          onClick={handleSelectAll}
          className="flex items-center gap-2 px-4 py-2 border-2 border-[rgb(var(--coral))] dark:border-[rgb(var(--coral))] rounded-lg hover:bg-[rgb(var(--coral))]/10 transition-colors mb-2 w-full text-left min-h-[44px]"
          type="button"
        >
          <div
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
              ${
                isAllSelected
                  ? 'bg-[rgb(var(--coral))] border-[rgb(var(--coral))]'
                  : isPartiallySelected
                  ? 'bg-[rgb(var(--coral))]/20 border-[rgb(var(--coral))]/40'
                  : 'border-2 border-black dark:border-white bg-card'
              }
            `}
          >
            {isAllSelected && <Check className="w-3 h-3 text-white" />}
            {isPartiallySelected && (
              <div className="w-2 h-0.5 bg-[rgb(var(--coral))] rounded" />
            )}
          </div>
          <span className="text-sm font-medium text-[rgb(var(--foreground))]">
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </span>
          <span className="text-xs text-[rgb(var(--muted-foreground))] ml-auto">
            {selectedOptions.length} of {options.length}
          </span>
        </button>
      )}

      {/* Input/Display Area */}
      <div
        ref={inputRef}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
          }
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={`
          min-h-[60px] w-full px-3 py-2 border-2 rounded-lg cursor-pointer
          transition-all duration-200 relative
          ${isOpen ? 'border-[rgb(var(--coral))] ring-2 ring-[rgb(var(--coral))]/20' : 'border-[rgb(var(--border))] hover:border-black dark:hover:border-white'}
        `}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label || placeholder}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && focusedIndex >= 0 ? `${listboxId}-option-${focusedIndex}` : undefined}
      >
        <div className="flex flex-wrap gap-2 items-center pr-5">
          {selectedOptions.length === 0 ? (
            <span className="text-[rgb(var(--muted-foreground))] text-sm py-1 flex items-center gap-2">
              <Search className="w-4 h-4" />
              {placeholder}
            </span>
          ) : (
            <>
              {visibleSelected.map((option) => (
                <span
                  key={option.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[rgb(var(--coral))] bg-[rgb(var(--coral))]/10 px-2.5 py-1 text-sm text-[rgb(var(--coral))]"
                >
                  <span
                    className="min-w-0 max-w-full break-words font-medium"
                    title={
                      option.description
                        ? `${option.name.trim() || option.id} · ${option.description}`
                        : option.name.trim() || option.id
                    }
                  >
                    {option.name.trim() || option.id}
                  </span>
                  <button
                    onClick={(e) => removeItem(option.id, e)}
                    className="hover:bg-[rgb(var(--coral))]/20 rounded p-0.5 transition-colors"
                    aria-label={`Remove ${option.name}`}
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {hiddenCount > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 bg-[rgb(var(--muted))] border border-[rgb(var(--border))] rounded-md text-sm text-[rgb(var(--foreground))]">
                  +{hiddenCount} more
                </span>
              )}
            </>
          )}
        </div>

        {/* Chevron indicator */}
        <ChevronDown
          className={`absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 text-[rgb(var(--muted-foreground))] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />

        {/* Helper text below selected items */}
        {selectedOptions.length > 0 && (
          <div className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
            Start typing to search or click to see options
          </div>
        )}
      </div>

      {/* Clear All Button */}
      {showClearAll && selectedOptions.length > 0 && (
        <button
          onClick={handleClearAll}
          className="text-xs text-[rgb(var(--coral))] hover:text-[rgb(var(--coral))]/90 font-medium mt-2 flex items-center gap-1 min-h-[44px] px-2 py-1"
          type="button"
        >
          <X className="w-3 h-3" />
          Clear all
        </button>
      )}

      {/* Dropdown - Rendered via Portal to escape overflow constraints */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          id={listboxId}
          className="fixed z-[9999] bg-white border-2 border-[rgb(var(--border))] dark:border-white rounded-lg shadow-brutalist overflow-auto"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: `${dropdownPosition.maxHeight}px`,
          }}
          role="listbox"
          aria-multiselectable="true"
        >
          {/* Search Input */}
          <div className="sticky top-0 bg-white border-b border-[rgb(var(--border))] dark:border-white p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--muted-foreground))]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFocusedIndex(-1);
                }}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 border-2 border-[rgb(var(--border))] dark:border-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--coral))] focus:border-[rgb(var(--coral))] bg-white"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options List */}
          <div className="p-2" role="presentation">
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center text-[rgb(var(--muted-foreground))] text-sm">
                {searchQuery ? (
                  <>
                    <p className="font-medium text-[rgb(var(--foreground))] mb-2">
                      No accounts match "{searchQuery}"
                    </p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-[rgb(var(--coral))] hover:text-[rgb(var(--coral))]/90 font-medium"
                      type="button"
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  'No accounts available'
                )}
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = selectedIds.has(option.id);
                const isFocused = focusedIndex === index;

                return (
                  <div
                    key={option.id}
                    id={`${listboxId}-option-${index}`}
                    onClick={() => toggleSelection(option.id)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer
                      transition-colors min-h-[44px]
                      ${isSelected ? 'bg-[rgb(var(--coral))]/10 hover:bg-[rgb(var(--coral))]/20' : 'hover:bg-coral/10'}
                      ${isFocused ? 'ring-2 ring-[rgb(var(--coral))]/20 ring-inset' : ''}
                    `}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div
                      className={`
                        w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                        ${isSelected ? 'bg-[rgb(var(--coral))] border-[rgb(var(--coral))]' : 'border-2 border-black dark:border-white'}
                      `}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[rgb(var(--ink))] text-sm truncate">{option.name}</div>
                      {option.description && (
                        <div className="text-xs text-[rgb(var(--muted-foreground))] mt-0.5 truncate">{option.description}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
