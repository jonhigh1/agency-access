import type { Metadata } from "next";
import { Outfit, JetBrains_Mono, Dela_Gothic_One } from "next/font/google";
import { DeferredAnalytics } from "@/components/deferred-analytics";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { RootProviders } from "./root-providers";
import { AnimationGate } from "@/components/animation-gate";
import { organizationSchema, webSiteSchema } from "@/lib/root-schemas";
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
  title: "AuthHub | Client Access in One Link",
  description: "Request ad and analytics access with one guided client link. Track what is done across Meta, Google Ads, GA4, and more.",
  icons: {
    icon: "/authhub.png",
    apple: "/authhub.png",
  },
  alternates: {
    canonical: 'https://authhub.co',
  },
  openGraph: {
    title: "AuthHub | Client Access in One Link",
    description: "Request ad and analytics access with one guided client link. Track what is done across Meta, Google Ads, GA4, and more.",
    url: "https://authhub.co",
  },
  twitter: {
    card: "summary_large_image",
  },
  // DNS preconnect hints for faster Google Fonts loading
  other: {
    'x-dns-prefetch-control': 'on',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${outfit.variable} ${jetbrainsMono.variable} ${delaGothicOne.variable}`} suppressHydrationWarning>
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
        <GoogleAnalytics />
      </body>
    </html>
  );
}
