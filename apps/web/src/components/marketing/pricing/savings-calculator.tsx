'use client';

import { useState, useMemo } from 'react';
import { m } from 'framer-motion';
import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, Info } from 'lucide-react';
import { Reveal } from '../reveal';

// Helper to set Growth tier (STARTER in backend) for trial signup
const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

interface Platform {
  id: string;
  name: string;
  icon: string;
}

const platforms: Platform[] = [
  { id: 'meta', name: 'Meta Ads', icon: '📘' },
  { id: 'google', name: 'Google Ads', icon: '🔍' },
  { id: 'ga4', name: 'GA4', icon: '📊' },
  { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵' },
];

const clientVolumeOptions = [
  { id: '1-5', label: '1-5 clients', midPoint: 3 },
  { id: '6-20', label: '6-20 clients', midPoint: 13 },
  { id: '21-50', label: '21-50 clients', midPoint: 35 },
  { id: '50+', label: '50+ clients', midPoint: 75 },
];

export function SavingsCalculator() {
  const [selectedVolume, setSelectedVolume] = useState('1-5');
  const [hoursPerClient, setHoursPerClient] = useState(2);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['meta', 'google']);
  const [showTooltip, setShowTooltip] = useState(false);

  // Calculate savings
  const savings = useMemo(() => {
    const volumeOption = clientVolumeOptions.find((v) => v.id === selectedVolume);
    const clientsPerMonth = volumeOption?.midPoint || 3;
    const platformsCount = selectedPlatforms.length;

    // Conservative estimates
    const timeSavedPerClient = hoursPerClient; // hours - user-adjusted via slider
    const hourlyRate = 85; // conservative mid-tier services-team rate

    const annualHoursSaved =
      clientsPerMonth * 12 * timeSavedPerClient * (1 + platformsCount * 0.08);
    const annualMoneySaved = annualHoursSaved * hourlyRate;
    const weeksReclaimed = annualHoursSaved / 40;

    // Breakdown
    const emailThreads = Math.round(annualHoursSaved * 0.30);
    const oauthSetup = Math.round(annualHoursSaved * 0.50);
    const followUps = Math.round(annualHoursSaved * 0.20);

    return {
      annualMoneySaved: Math.round(annualMoneySaved),
      annualHoursSaved: Math.round(annualHoursSaved),
      weeksReclaimed: Math.round(weeksReclaimed),
      breakdown: {
        emailThreads,
        oauthSetup,
        followUps,
      },
    };
  }, [selectedVolume, hoursPerClient, selectedPlatforms]);

  return (
    <section id="savings-calculator" className="py-16 sm:py-20 md:py-24 bg-card relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          {/* Section Header */}
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-block mb-4">
              <div className="bg-coral/20 text-ink border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider inline-block shadow-brutalist-sm">
                Interactive Calculator
              </div>
            </div>
            <h2 className="font-dela text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight mb-4 sm:mb-6 text-ink">
              Calculate your{' '}
              <span className="text-danger-ink italic">annual savings</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto font-mono">
              See how much time and money your team could save by automating client OAuth onboarding.
            </p>
          </div>
        </Reveal>

        {/* Calculator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
          {/* Input Panel */}
          <Reveal delay={0.1}>
            <m.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Client Volume */}
              <div className="border-2 border-black bg-paper p-6 shadow-brutalist">
                <label className="block font-bold text-sm uppercase tracking-wider mb-4 text-ink">
                  How many clients do you onboard per month?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {clientVolumeOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedVolume(option.id)}
                      className={`p-3 border-2 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                        selectedVolume === option.id
                          ? 'border-coral bg-coral/10 text-ink shadow-[2px_2px_0px_#000]'
                          : 'border-black bg-card text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours Per Client */}
              <div className="border-2 border-black bg-paper p-6 shadow-brutalist">
                <label className="block font-bold text-sm uppercase tracking-wider mb-4 text-ink">
                  Avg. hours spent per client onboarding?
                </label>
                <div className="space-y-3">
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={hoursPerClient}
                    onChange={(e) => setHoursPerClient(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-coral"
                    style={{ accentColor: 'rgb(var(--coral))' }}
                  />
                  <div className="flex justify-between font-mono text-xs text-gray-600">
                    <span>1 hour</span>
                    <span className="font-bold text-danger-ink">{hoursPerClient} hours</span>
                    <span>8 hours</span>
                  </div>
                </div>
              </div>

              {/* Platforms */}
              <div className="border-2 border-black bg-paper p-6 shadow-brutalist">
                <label className="block font-bold text-sm uppercase tracking-wider mb-4 text-ink">
                  Platforms per client?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {platforms.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => {
                        if (selectedPlatforms.includes(platform.id)) {
                          setSelectedPlatforms((prev) =>
                            prev.length > 1 ? prev.filter((p) => p !== platform.id) : prev
                          );
                        } else {
                          setSelectedPlatforms((prev) => [...prev, platform.id]);
                        }
                      }}
                      className={`p-3 border-2 text-center transition-all ${
                        selectedPlatforms.includes(platform.id)
                          ? 'border-coral bg-coral/10 shadow-[2px_2px_0px_#000]'
                          : 'border-black bg-card hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{platform.icon}</div>
                      <div className="font-mono text-[10px] font-bold uppercase text-gray-700">
                        {platform.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </m.div>
          </Reveal>

          {/* Output Panel */}
          <Reveal delay={0.2}>
            <m.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="border-2 border-black bg-card p-6 sm:p-8 shadow-brutalist-lg sticky top-8">
                {/* Main Savings Display */}
                <div className="text-center mb-8 pb-6 border-b-2 border-black">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-gray-600">
                      Your Annual Savings
                    </p>
                    <div className="relative">
                      <button
                        onClick={() => setShowTooltip(!showTooltip)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="See how savings are calculated"
                      >
                        <Info size={14} />
                      </button>
                      {showTooltip && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 bg-card border-2 border-black shadow-brutalist-lg p-4 z-50">
                          <div className="font-mono text-xs text-left">
                            <p className="font-bold text-ink mb-2">How We Calculate:</p>
                            <ul className="space-y-1.5 text-gray-700">
                              <li><strong>Base:</strong> {hoursPerClient} hours saved per client (your input)</li>
                              <li><strong>Rate:</strong> $85/hour (mid-tier services team)</li>
                              <li><strong>Platform Bonus:</strong> +8% per additional platform</li>
                              <li><strong>Formula:</strong> Clients × 12 × {hoursPerClient}hrs × $85 × (1 + platforms × 0.08)</li>
                            </ul>
                            <p className="mt-2 pt-2 border-t border-gray-200 text-gray-500 italic">
                              Conservative estimates only count setup time. Most teams save more.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <m.div
                    key={savings.annualMoneySaved}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="font-dela text-5xl sm:text-6xl text-danger-ink mb-2"
                  >
                    ${savings.annualMoneySaved.toLocaleString()}
                  </m.div>
                  <p className="font-mono text-sm text-gray-600">saved per year</p>
                </div>

                {/* Time Reclaimed */}
                <div className="mb-8 pb-6 border-b-2 border-black">
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
                    Time Reclaimed
                  </p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Hours saved:</span>
                      <m.span
                        key={savings.annualHoursSaved}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-dela text-2xl text-ink"
                      >
                        {savings.annualHoursSaved.toLocaleString()}h
                      </m.span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Weeks of work:</span>
                      <m.span
                        key={savings.weeksReclaimed}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="font-dela text-2xl text-success-ink"
                      >
                        ≈ {savings.weeksReclaimed} weeks
                      </m.span>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="mb-8 pb-6 border-b-2 border-black">
                  <p className="font-mono text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
                    Breakdown
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <span>•</span>
                      <span>Email threads: <strong>{savings.breakdown.emailThreads}h</strong></span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <span>•</span>
                      <span>OAuth setup: <strong>{savings.breakdown.oauthSetup}h</strong></span>
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <span>•</span>
                      <span>Follow-ups: <strong>{savings.breakdown.followUps}h</strong></span>
                    </li>
                  </ul>
                </div>

                {/* CTA */}
                <SignUpButton mode="modal">
                  <Button
                    variant="brutalist"
                    size="lg"
                    className="w-full"
                    rightIcon={<ArrowRight size={18} />}
                    onClick={handleTrialSignup}
                  >
                    Start Free Trial
                  </Button>
                </SignUpButton>

                {/* Disclaimer */}
                <p className="mt-4 text-[10px] text-gray-500 font-mono text-center">
                  *Conservative estimates based on platform setup time only. Your actual savings may vary.
                </p>
              </div>
            </m.div>
          </Reveal>
        </div>

        {/* Trust Note */}
        <Reveal delay={0.3}>
          <m.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-paper border-2 border-black px-4 py-3 shadow-brutalist-sm">
              <Check size={16} className="text-danger-ink" />
              <span className="font-mono text-xs text-gray-700">
                Conservative baseline calculation. Actual savings often 2-3× higher when accounting for full onboarding overhead.
              </span>
            </div>
          </m.div>
        </Reveal>
      </div>
    </section>
  );
}
