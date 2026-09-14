'use client';

/**
 * Client island for the design-system showcase.
 *
 * The showcase page renders as a Server Component; interactive control
 * demos live here because event-handler props cannot cross the RSC
 * boundary during static prerender.
 */

import { useState } from 'react';
import { SingleSelect } from '@/components/ui/single-select';

export function SelectDemo() {
  const [platform, setPlatform] = useState('meta');

  return (
    <SingleSelect
      options={[
        { value: 'meta', label: 'Meta Ads' },
        { value: 'google', label: 'Google Ads' },
        { value: 'shopify', label: 'Shopify' },
      ]}
      value={platform}
      onChange={setPlatform}
      ariaLabel="Platform"
    />
  );
}
