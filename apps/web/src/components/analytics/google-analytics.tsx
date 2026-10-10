'use client';

import Script from 'next/script';

// GA4 measurement ID is public by design (it ships in page HTML).
// Override per environment with NEXT_PUBLIC_GA_MEASUREMENT_ID.
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-DK18K4Y24N';

export function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
