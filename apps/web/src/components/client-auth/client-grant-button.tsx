'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Client Meta grant surfaces: ~40px primary, no brutalist offset shadow, content-width CTA. */
const clientPrimaryStyles =
  'min-h-10 h-10 max-w-[360px] w-full px-4 py-2 text-sm font-semibold normal-case shadow-none hover:translate-y-0 active:scale-[0.98] sm:w-auto';

const clientSecondaryStyles =
  'min-h-9 h-9 max-w-[360px] w-full px-3 py-2 text-sm font-semibold normal-case shadow-none hover:translate-y-0 active:scale-[0.98] sm:w-auto';

export function ClientGrantPrimaryButton({ className, size: _size, variant: _variant, ...props }: ButtonProps) {
  return (
    <Button
      variant="primary"
      size="sm"
      className={cn(clientPrimaryStyles, className)}
      {...props}
    />
  );
}

export function ClientGrantSecondaryButton({ className, size: _size, variant: _variant, ...props }: ButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn(clientSecondaryStyles, className)}
      {...props}
    />
  );
}

export function ClientGrantCtaRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-4 pt-4 sm:flex-row sm:flex-wrap sm:items-center', className)} {...props} />;
}
