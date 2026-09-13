import type { Metadata } from "next";
import { LazyMotion, domAnimation } from 'framer-motion';
import { GoogleTagManager } from "@/components/marketing/google-tag-manager";
import { MarketingShellEffects } from "@/components/marketing/marketing-shell-effects";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export const metadata: Metadata = {
  title: "AuthHub | Streamline Client OAuth Onboarding",
  description: "Replace 2-3 days of manual OAuth setup with a 5-minute automated flow. Let clients authorize Meta, Google Ads, GA4, LinkedIn, and more through a single branded link.",
  keywords: ["OAuth", "marketing agencies", "client onboarding", "Meta Ads", "Google Ads", "agency tools"],
  openGraph: {
    title: "AuthHub | Streamline Client OAuth Onboarding",
    description: "Replace 2-3 days of manual OAuth setup with a 5-minute automated flow.",
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
        <MarketingShellEffects />
        <MarketingNav />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </LazyMotion>
  );
}
