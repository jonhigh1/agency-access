'use client';

import { Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';

interface BusinessIdDisplayProps {
  businessId: string;
  businessName?: string;
  onCopy?: () => void;
}

export function BusinessIdDisplay({
  businessId,
  businessName,
  onCopy,
}: BusinessIdDisplayProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => copy(businessId, onCopy);

  return (
    <div className="space-y-2">
      {businessName && (
        <p className="text-sm text-muted-foreground">{businessName}</p>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={businessId}
          className="flex-1 px-4 py-2 bg-muted/20 border-2 border-border rounded-lg text-ink font-mono text-sm focus:outline-none focus:border-border"
        />
        <Button
          onClick={handleCopy}
          variant="secondary"
          size="sm"
          aria-label="Copy Business Manager ID"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-success-ink" />
              <span className="text-sm">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span className="text-sm">Copy</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

