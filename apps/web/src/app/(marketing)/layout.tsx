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
        <MarketingShellEffects />
        <MarketingNav />
        <main className="flex-1">{children}</main>
        <MarketingFooter />
      </div>
    </LazyMotion>
  );
}
