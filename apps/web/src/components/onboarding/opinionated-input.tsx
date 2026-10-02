/**
 * OpinionatedInput
 *
 * Smart input component with validation, suggestions, and helpful microcopy.
 * Designed to guide users through the onboarding flow with confidence.
 *
 * Features:
 * - Real-time validation with visual feedback
 * - Smart suggestions (autocomplete from existing data)
 * - Helper text that guides, not just describes
 * - Success state when valid
 * - Clear error messages
 * - Accessible with proper ARIA labels
 *
 * Design Philosophy:
 * - "Opinionated" means guiding users toward the best input, not just accepting anything
 * - Microcopy should explain WHY, not just WHAT
 * - Celebrate success, don't just remove errors
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, ChevronDown } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export interface OpinionatedInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'url';
  required?: boolean;
  suggestions?: string[];
  helperText?: string;
  validationMessage?: string;
  isValid?: boolean;
  showError?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateUrl = (url: string): boolean => {
  try {
    new URL(url.startsWith('http') ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
};

// ============================================================
// COMPONENT
// ============================================================

export function OpinionatedInput({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  required = false,
  suggestions = [],
  helperText,
  validationMessage,
  isValid: controlledIsValid,
  showError: controlledShowError,
  errorMessage,
  disabled = false,
  autoFocus = false,
  onBlur,
  onFocus,
}: OpinionatedInputProps) {
  const [internalIsValid, setInternalIsValid] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasBlurred, setHasBlurred] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Determine validation state
  const isValid = controlledIsValid !== undefined ? controlledIsValid : internalIsValid;
  const showError = controlledShowError !== undefined ? controlledShowError : hasBlurred && !isValid && value.length > 0;

  // Validate on change
  useEffect(() => {
    if (!value) {
      setInternalIsValid(false);
      return;
    }

    let valid = true;

    switch (type) {
      case 'email':
        valid = validateEmail(value);
        break;
      case 'url':
        valid = validateUrl(value);
        break;
      case 'text':
        valid = value.trim().length >= 2;
        break;
    }

    setInternalIsValid(valid);
  }, [value, type]);

  // Filter suggestions based on current value
  const filteredSuggestions = suggestions.filter((suggestion) =>
    suggestion.toLowerCase().includes(value.toLowerCase())
  );

  // Auto-focus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle keyboard navigation in suggestions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredSuggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
            e.preventDefault();
            onChange(filteredSuggestions[highlightedIndex]);
            setShowSuggestions(false);
            setHighlightedIndex(-1);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          setHighlightedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSuggestions, highlightedIndex, filteredSuggestions, onChange]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = useCallback(() => {
    if (filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
    if (onFocus) onFocus();
  }, [filteredSuggestions.length, onFocus]);

  const handleBlur = useCallback(() => {
    setHasBlurred(true);
    // Delay closing suggestions to allow click events
    setTimeout(() => setShowSuggestions(false), 200);
    if (onBlur) onBlur();
  }, [onBlur]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [onChange, filteredSuggestions.length]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="relative">
      {/* Label */}
      <label className="block text-sm font-semibold text-foreground mb-1.5">
        {label}
        {required && <span className="text-danger-ink ml-1">*</span>}
      </label>

      {/* Input Container */}
      <div className="relative">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
            w-full px-4 py-3 pr-10 rounded-lg border-2 text-ink
            focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all
            disabled:bg-muted/20 disabled:cursor-not-allowed
            ${showError
              ? 'border-coral/40 focus:border-coral focus:ring-coral/30'
              : isValid
                ? 'border-teal/40 focus:border-teal focus:ring-teal/30'
                : 'border-border focus:border-coral focus:ring-coral/30'
            }
          `}
          aria-invalid={showError}
          aria-describedby={
            showError ? `${label}-error` : helperText ? `${label}-helper` : undefined
          }
          autoComplete="off"
        />

        {/* Status Icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <AnimatePresence mode="wait">
            {showError && (
              <m.div
                key="error"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.2 }}
              >
                <AlertCircle className="w-5 h-5 text-danger-ink" />
              </m.div>
            )}
            {isValid && value.length > 0 && !showError && (
              <m.div
                key="success"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.2 }}
              >
                <Check className="w-5 h-5 text-success-ink" />
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-border overflow-hidden"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  onChange(suggestion);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                className={`
                  w-full px-4 py-3 text-left text-sm transition-colors
                  ${index === highlightedIndex
                    ? 'bg-coral/10 text-danger-ink'
                    : 'hover:bg-coral/10 text-foreground'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span>{suggestion}</span>
                  {index === highlightedIndex && (
                    <ChevronDown className="w-4 h-4 transform rotate-[-90deg]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Helper Text or Validation Message */}
      <AnimatePresence mode="wait">
      {showError && (errorMessage || validationMessage) ? (
          <m.p
            key="error"
            id={`${label}-error`}
            className="mt-1.5 text-sm text-danger-ink flex items-start gap-1.5"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            role="alert"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{errorMessage || validationMessage}</span>
          </m.p>
        ) : helperText ? (
          <m.p
            key="helper"
            id={`${label}-helper`}
            className="mt-1.5 text-sm text-muted-foreground"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            {helperText}
          </m.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
