import type { Metadata } from "next";
import { LazyMotion, domAnimation } from 'framer-motion';
import { GoogleTagManager } from "@/components/marketing/google-tag-manager";
import { MarketingShellEffects } from "@/components/marketing/marketing-shell-effects";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export const metadata: Metadata = {
  title: "AuthHub | Client Access in One Link",
  description: "Request ad and analytics access with one guided client link. Track what is done across Meta, Google Ads, GA4, and more.",
  keywords: ["OAuth", "marketing agencies", "client onboarding", "Meta Ads", "Google Ads", "agency tools"],
  openGraph: {
    title: "AuthHub | Client Access in One Link",
    description: "Request ad and analytics access with one guided client link. Track what is done across Meta, Google Ads, GA4, and more.",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LazyMotion features={domAnimation} strict>
      <GoogleTagManager />
      <div className="flex min-h-screen flex-col">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-card focus:px-4 focus:py-3 focus:text-foreground">
          Skip to content
        </a>
        <MarketingShellEffects />
        <MarketingNav />
        <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </LazyMotion>
  );
}
