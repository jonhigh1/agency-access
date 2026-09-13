"use client";

import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Zap } from "lucide-react";

interface IconItem {
  platform: string;
  name: string;
}

// Row 1 icons
const ICONS_ROW1: IconItem[] = [
  { platform: "google", name: "Google" },
  { platform: "meta", name: "Meta" },
  { platform: "linkedin", name: "LinkedIn" },
  { platform: "snapchat", name: "Snapchat" },
  { platform: "tiktok", name: "TikTok" },
  { platform: "instagram", name: "Instagram" },
  { platform: "zapier", name: "Zapier" },
  { platform: "beehiiv", name: "Beehiiv" },
  { platform: "kit", name: "Kit" },
];

// Row 2 icons (can repeat or use different ones)
const ICONS_ROW2: IconItem[] = [
  { platform: "ga4", name: "Google Analytics" },
  { platform: "google_ads", name: "Google Ads" },
  { platform: "meta_ads", name: "Meta Ads" },
  { platform: "linkedin_ads", name: "LinkedIn Ads" },
  { platform: "tiktok_ads", name: "TikTok Ads" },
  { platform: "snapchat_ads", name: "Snapchat Ads" },
  { platform: "instagram", name: "Instagram Business" },
  { platform: "kit", name: "Kit" },
  { platform: "beehiiv", name: "Beehiiv" },
];

// Utility to repeat icons enough times for seamless scroll
const repeatedIcons = (icons: IconItem[], repeat = 4): IconItem[] =>
  Array.from({ length: repeat }).flatMap(() => icons);

const handleTrialSignup = () => {
  localStorage.setItem("selectedSubscriptionTier", "STARTER");
  localStorage.setItem("selectedBillingInterval", "yearly");
};

export default function IntegrationHero() {
  return (
    <section className="relative py-32 overflow-hidden bg-card border-y-2 border-black">
      {/* Brutalist grid background */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      />

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 border-2 border-black bg-coral text-black px-4 sm:px-6 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest font-mono shadow-brutalist rounded-[0.75rem] mb-6">
          <Zap size={14} />
          Integration
        </div>
        <h1 className="font-dela text-4xl lg:text-6xl tracking-tight text-ink">
          Connect, Automate, and Scale
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto font-mono">
          AuthHub integrates effortlessly with your favorite tools, ensuring a smooth and automated workflow.
        </p>
        <div className="flex justify-center">
          <SignUpButton mode="modal">
            <Button
              variant="brutalist"
              size="lg"
              className="mt-8 min-w-[200px]"
              onClick={handleTrialSignup}
            >
              Get Started
            </Button>
          </SignUpButton>
        </div>

        {/* Carousel - Brutalist platform cards */}
        <div className="mt-12 overflow-hidden relative pb-2">
          {/* Row 1 */}
          <div className="flex gap-6 whitespace-nowrap animate-scroll-left">
            {repeatedIcons(ICONS_ROW1, 4).map((item, i) => {
              return (
                <div
                  key={`row1-${i}`}
                  className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 border-2 border-black shadow-[4px_4px_0px_#000] rounded-none flex items-center justify-center overflow-hidden hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200"
                  style={{ backgroundColor: "white" }}
                  aria-label={item.name}
                >
                  <PlatformIcon platform={item.platform} size="md" />
                </div>
              );
            })}
          </div>

          {/* Row 2 */}
          <div className="flex gap-6 whitespace-nowrap mt-6 animate-scroll-right">
            {repeatedIcons(ICONS_ROW2, 4).map((item, i) => {
              return (
                <div
                  key={`row2-${i}`}
                  className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 border-2 border-black shadow-[4px_4px_0px_#000] rounded-none flex items-center justify-center overflow-hidden hover:shadow-[6px_6px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200"
                  style={{ backgroundColor: "white" }}
                  aria-label={item.name}
                >
                  <PlatformIcon platform={item.platform} size="md" />
                </div>
              );
            })}
          </div>

          {/* Fade overlays */}
          <div className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-white via-white to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-white via-white to-transparent pointer-events-none" />
        </div>
      </div>

    </section>
  );
}
