/**
 * Platform Icon Component
 *
 * Displays platform-specific brand logos using Brandfetch Logo API.
 * Uses Next.js Image optimization with client-side caching.
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PLATFORM_DOMAINS, PLATFORM_NAMES } from '@agency-platform/shared';
import type { Platform } from '@agency-platform/shared';

const BRANDFETCH_CLIENT_ID = process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID;

interface PlatformIconProps {
  platform: Platform | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
}

const SIZE_CONFIG = {
  sm: { width: 24, height: 24, textSize: 'text-xs' },
  md: { width: 32, height: 32, textSize: 'text-sm' },
  lg: { width: 48, height: 48, textSize: 'text-base' },
  xl: { width: 64, height: 64, textSize: 'text-lg' },
} as const;

function formatPlatformFallbackName(platform: string): string {
  return platform
    .split(/[_-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

export function PlatformIcon({
  platform,
  size = 'md',
  showLabel = false,
}: PlatformIconProps) {
  const [imageError, setImageError] = useState(false);
  const config = SIZE_CONFIG[size];
  const domain = PLATFORM_DOMAINS[platform as Platform];
  const platformName = PLATFORM_NAMES[platform as Platform] ?? formatPlatformFallbackName(platform);

  // Fallback: show initial letter if image fails or domain missing
  if (!domain || !BRANDFETCH_CLIENT_ID || imageError) {
    const initial = platformName.charAt(0).toUpperCase() || '?';
    return (
      <div className="inline-flex items-center gap-2">
        <div
          className={'rounded-none flex items-center justify-center bg-muted'}
          style={{ width: config.width, height: config.height }}
        >
          <span className="text-muted-foreground font-bold">{initial}</span>
        </div>
        {showLabel && (
          <span className={`${config.textSize} font-medium text-foreground`}>
            {platformName}
          </span>
        )}
      </div>
    );
  }

  const logoUrl = `https://cdn.brandfetch.io/${domain}?c=${BRANDFETCH_CLIENT_ID}`;

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className="overflow-hidden"
        style={{ width: config.width, height: config.height }}
      >
        <Image
          src={logoUrl}
          alt={`${platformName} logo`}
          width={config.width}
          height={config.height}
          className="object-contain"
          referrerPolicy="strict-origin"
          onError={() => setImageError(true)}
          unoptimized
        />
      </div>
      {showLabel && (
        <span className={`${config.textSize} font-medium text-foreground`}>
          {platformName}
        </span>
      )}
    </div>
  );
}
