'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyCodeProps {
  value: string;
  label?: string;
}

export function CopyCode({ value, label }: CopyCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        console.error('Fallback copy failed');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-sm font-medium text-foreground">{label}</p>
      )}
      <div className="flex items-center bg-muted/30 border border-black dark:border-white rounded-none overflow-hidden">
        <code className="flex-1 px-4 py-3 text-base font-mono text-ink tracking-wide">
          {value}
        </code>
        <button
          onClick={handleCopy}
          className="flex items-center justify-center px-4 py-3 border-l border-black/10 dark:border-white/10 hover:bg-muted/40 transition-colors"
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
        >
          {copied ? (
            <Check className="w-5 h-5 text-success-ink" />
          ) : (
            <Copy className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>
      {copied && (
        <p className="text-xs text-success-ink font-medium">Copied to clipboard</p>
      )}
    </div>
  );
}
