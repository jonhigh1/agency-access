'use client';

/**
 * AssetSelectorDisabled - Disabled overlay for asset selectors
 *
 * Shows when authorization is not yet complete:
 * - Blurs and dims the underlying selector
 * - Lock icon with explanatory message
 * - Prevents interaction while providing context
 *
 * This creates clear sequential flow: authorize first, then select
 */

import { Lock } from 'lucide-react';

interface AssetSelectorDisabledProps {
  message?: string;
  subtext?: string;
}

export function AssetSelectorDisabled({
  message = 'Complete authorization first',
  subtext = 'You need to authorize your account before selecting assets',
}: AssetSelectorDisabledProps) {
  return (
    <>
      {/* Disabled overlay - positioned absolutely relative to parent */}
      <div className="absolute inset-0 bg-card/60 backdrop-blur-[2px] flex items-center justify-center z-10">
        <div className="text-center px-6">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">{message}</p>
          <p className="text-sm text-muted-foreground">{subtext}</p>
        </div>
      </div>
    </>
  );
}
