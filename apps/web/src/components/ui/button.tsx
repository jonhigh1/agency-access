'use client';

import { LogoSpinner } from './logo-spinner';
import { Slot } from '@radix-ui/react-slot';
import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'brutalist';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

/**
 * Button - Reusable button component with consistent variants
 *
 * v2.0 contract: five variants, binary radius (square buttons, circular icon),
 * two-ring accent focus (3px coral outline + 6px soft halo), 120ms hover.
 *
 * Variants:
 * - primary: Coral fill, hard shadow — main actions
 * - secondary: White with 1px border — alternative/cancel actions
 * - ghost: Transparent — tertiary actions
 * - danger: Darkened coral (danger-ink) fill — destructive actions
 * - brutalist: Uppercase coral CTA with diagonal shift hover — one per view
 *
 * Sizes:
 * - sm: Small buttons for tight spaces
 * - md: Default size
 * - lg: Large prominent buttons
 * - xl: Extra-large call-to-action buttons
 * - icon: Square icon-only buttons (w-11 h-11, circular)
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      className = '',
      asChild = false,
      ...props
    },
    ref
  ) => {
    // Base styles common to all variants.
    // Two-ring focus (v2.0): inner 3px coral stroke + outer 6px soft halo.
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-feedback focus-visible:outline-[3px] focus-visible:outline-coral/25 focus-visible:outline-offset-0 focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)]';

    // Variant styles (use NonNullable to exclude undefined from Record key type)
    const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary: 'border border-black dark:border-white bg-primary text-primary-foreground hover:bg-primary/90 hover:translate-y-[-2px] active:scale-95 shadow-brutalist',
      secondary: 'border border-black dark:border-white bg-card text-foreground hover:border-coral hover:text-ink hover:translate-y-[-2px] active:scale-95',
      ghost: 'bg-transparent text-muted-foreground hover:bg-muted/10 active:scale-95',
      // danger uses the AA danger-ink fill — never identical to primary (v2.0)
      danger: 'border border-black dark:border-white bg-danger-ink text-white hover:bg-danger-ink/90 hover:translate-y-[-2px] active:scale-95 shadow-brutalist',
      // Brutalist: hero CTA only — uppercase coral, diagonal shift on hover
      brutalist: 'bg-coral text-white border-2 border-black dark:border-white rounded-none shadow-brutalist hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] font-bold uppercase tracking-wide',
    };

    // Size styles (use NonNullable to exclude undefined from Record key type)
    // All sizes ensure minimum 44px height for touch targets (iOS HIG).
    // v2.0 binary radius: square corners everywhere except the icon circle.
    const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'px-4 py-3 text-sm rounded-none min-h-[44px]',
      md: 'px-6 py-3 text-base rounded-none min-h-[48px]',
      lg: 'px-8 py-4 text-lg rounded-none min-h-[52px]',
      xl: 'px-12 py-5 text-xl rounded-none min-h-[56px]',
      icon: 'p-0 w-11 h-11 rounded-full min-h-[44px]',
    };

    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
          {...props}
        >
          {isLoading ? (
            <>
              <LogoSpinner size="sm" />
              {children && <span>Loading...</span>}
            </>
          ) : (
            <>
              {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
              {children}
              {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
            </>
          )}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <LogoSpinner size="sm" />
            {children && <span>Loading...</span>}
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
