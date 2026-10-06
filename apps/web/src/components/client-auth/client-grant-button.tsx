'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

const focusRing =
  'focus-visible:outline-[3px] focus-visible:outline-coral/25 focus-visible:outline-offset-0 focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)]';

/** Client Meta grant surfaces: ~40px primary, flat (no card-scale shadow), content-width CTA. */
const clientPrimaryStyles = cn(
  'inline-flex items-center justify-center gap-2 rounded-none border border-black bg-primary font-semibold text-primary-foreground',
  'min-h-10 h-10 max-w-[360px] w-full px-4 py-2 text-sm normal-case',
  'transition-[background-color,opacity,transform] duration-[var(--motion-hover)]',
  'hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
  'dark:border-white sm:w-auto',
  focusRing
);

const clientSecondaryStyles = cn(
  'inline-flex items-center justify-center gap-2 rounded-none border border-black bg-card font-semibold text-foreground',
  'min-h-9 h-9 max-w-[360px] w-full px-3 py-2 text-sm normal-case',
  'transition-[background-color,border-color,color,opacity,transform] duration-[var(--motion-hover)]',
  'hover:border-coral hover:text-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
  'dark:border-white sm:w-auto',
  focusRing
);

type ClientGrantButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

export const ClientGrantPrimaryButton = forwardRef<HTMLButtonElement, ClientGrantButtonProps>(
  ({ className, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} type={asChild ? undefined : type} className={cn(clientPrimaryStyles, className)} {...props} />
    );
  }
);
ClientGrantPrimaryButton.displayName = 'ClientGrantPrimaryButton';

export const ClientGrantSecondaryButton = forwardRef<HTMLButtonElement, ClientGrantButtonProps>(
  ({ className, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} type={asChild ? undefined : type} className={cn(clientSecondaryStyles, className)} {...props} />
    );
  }
);
ClientGrantSecondaryButton.displayName = 'ClientGrantSecondaryButton';

export function ClientGrantCtaRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-4 pt-4 sm:flex-row sm:flex-wrap sm:items-center', className)} {...props} />;
}
