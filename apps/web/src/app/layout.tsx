import type { Metadata } from "next";
import { Outfit, JetBrains_Mono, Dela_Gothic_One } from "next/font/google";
import { DeferredAnalytics } from "@/components/deferred-analytics";
import { RootProviders } from "./root-providers";
import { AnimationGate } from "@/components/animation-gate";
import "./globals.css";

// Preconnect to Google Fonts for faster font loading
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Hint for browsers to preconnect to Google Fonts
  // This is handled by next/font/google automatically, but we can add hints
};

// CRITICAL: Main font - use swap for fallback text visibility
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

// DEFERRED: Display fonts - use optional to avoid blocking render
// These will load in the background and only show if loaded quickly enough
const delaGothicOne = Dela_Gothic_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dela",
  display: "optional",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "optional",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://authhub.co'),
  title: "AuthHub - Client Access in 5 Minutes",
  description: "One link replaces weeks of OAuth setup. Connect to Meta, Google Ads, GA4, LinkedIn, and more.",
  icons: {
    icon: "/authhub.png",
    apple: "/authhub.png",
  },
  alternates: {
    canonical: 'https://authhub.co',
  },
  openGraph: {
    title: "AuthHub - Client Access in 5 Minutes",
    description: "One link replaces weeks of OAuth setup.",
    images: ["/authhub.png"],
    url: "https://authhub.co",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/authhub.png"],
  },
  // DNS preconnect hints for faster Google Fonts loading
  other: {
    'x-dns-prefetch-control': 'on',
  },
};

// Organization JSON-LD structured data for SEO
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "AuthHub",
  "url": "https://authhub.co",
  "logo": "https://authhub.co/authhub.png",
  "description": "Client access platform for marketing agencies. Replace weeks of OAuth setup with a single 5-minute link.",
  "sameAs": [
    "https://twitter.com/authhubco",
    "https://linkedin.com/company/authhub-platform",
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "url": "https://authhub.co/contact",
  },
};

// WebSite JSON-LD structured data for site search and potential actions
const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "AuthHub",
  "url": "https://authhub.co",
  "description": "Client access platform for marketing agencies",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://authhub.co/search?q={search_term_string}",
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable} ${delaGothicOne.variable}`} suppressHydrationWarning>
      <head>
        <meta name="facebook-domain-verification" content="3m49m2lu2cvxshjd01sbp77phldp4w" />
        {/* Organization Schema JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        {/* WebSite Schema JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webSiteSchema),
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var p=window.location.pathname;var m=p==='/'||p.startsWith('/pricing')||p.startsWith('/contact')||p.startsWith('/about')||p.startsWith('/blog')||p.startsWith('/terms')||p.startsWith('/privacy-policy')||p.startsWith('/compare')||p.startsWith('/onboarding');if(m){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');}})();`,
          }}
        />
        <RootProviders>{children}</RootProviders>
        <AnimationGate />
        <DeferredAnalytics />
      </body>
    </html>
  );
}
