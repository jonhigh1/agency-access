/**
 * BeehiivCopyButton Component
 *
 * A button that copies text to clipboard with visual feedback.
 * Shows "Copied!" toast/message for 2 seconds after copying.
 */

'use client';

import { Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';

interface BeehiivCopyButtonProps {
  text: string;           // Text to copy
  label?: string;         // Button label (default: "Copy")
  className?: string;     // Additional CSS classes
}

export function BeehiivCopyButton({
  text,
  label = 'Copy',
  className = '',
}: BeehiivCopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => copy(text);

  return (
    <div className="relative">
      <Button onClick={handleCopy} variant="secondary" size="sm" className={className}>
        {copied ? (
          <>
            <Check className="h-4 w-4 text-success-ink" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            {label}
          </>
        )}
      </Button>

      {/* Optional tooltip/subtle confirmation below button */}
      {copied && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
          <span className="text-xs text-success-ink font-medium">
            Copied to clipboard!
          </span>
        </div>
      )}
    </div>
  );
}
