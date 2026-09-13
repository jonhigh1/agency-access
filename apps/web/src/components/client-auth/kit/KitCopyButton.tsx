'use client';

import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Button } from '@/components/ui/button';

interface KitCopyButtonProps {
  text: string;
}

export function KitCopyButton({ text }: KitCopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => copy(text);

  return (
    <Button onClick={handleCopy} variant="secondary" size="sm">
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          Copy
        </>
      )}
    </Button>
  );
}
