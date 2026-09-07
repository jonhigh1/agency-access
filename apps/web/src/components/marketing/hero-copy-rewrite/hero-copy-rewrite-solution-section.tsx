'use client';

import { m } from 'framer-motion';
import { ArrowRight, AlertCircle, Link2, Mail } from 'lucide-react';
import { SignUpButton } from '@clerk/nextjs';
import {
  ImageComparison,
  ImageComparisonImage,
  ImageComparisonSlider,
} from '@/components/ui/image-comparison';
import { Reveal } from '@/components/marketing/reveal';

const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

function BeforeState() {
  return (
    <div className="relative h-full w-full bg-gradient-to-br from-gray-50 to-gray-100 p-6 sm:p-8">
      <div className="absolute inset-0 opacity-5">
        <div className="diagonal-lines" />
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-xs font-mono font-bold border-2 border-red-300">
        <AlertCircle className="w-3 h-3" />
        CURRENT WORKFLOW
      </div>

      <div className="text-center mb-6">
        <h3 className="font-dela text-2xl sm:text-3xl text-gray-900 mb-2">
          Multiple emails
        </h3>
        <p className="font-mono text-sm sm:text-base text-gray-600">
          Separate instructions, follow-up questions, and delayed kickoff
        </p>
      </div>

      <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
        {Array.from({ length: 24 }).map((_, index) => (
          <m.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: index * 0.03,
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="aspect-[4/5] bg-[#FF6B35] border-2 border-black shadow-[3px_3px_0px_#000] rounded-lg p-2 flex flex-col items-center justify-center gap-1"
            style={{
              transform: `rotate(${(index % 7) - 3}deg)`,
            }}
          >
            <Mail className="w-4 h-4 text-white flex-shrink-0" strokeWidth={3} />
            <div className="w-full h-0.5 bg-card/30" />
            <div className="w-full h-1 bg-card/20 rounded" />
            <div className="w-3/4 h-1 bg-card/20 rounded" />
          </m.div>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
        <div className="bg-card/90 border-2 border-black rounded-lg p-2 text-center">
          <div className="font-dela text-base sm:text-xl text-[#FF6B35]">Manual</div>
          <div className="font-mono text-[10px] text-gray-600 uppercase">Instructions</div>
        </div>
        <div className="bg-card/90 border-2 border-black rounded-lg p-2 text-center">
          <div className="font-dela text-base sm:text-xl text-[#FF6B35]">Inbox</div>
          <div className="font-mono text-[10px] text-gray-600 uppercase">Follow-up</div>
        </div>
        <div className="bg-card/90 border-2 border-black rounded-lg p-2 text-center">
          <div className="font-dela text-base sm:text-xl text-[#FF6B35]">Delayed</div>
          <div className="font-mono text-[10px] text-gray-600 uppercase">Kickoff</div>
        </div>
      </div>
    </div>
  );
}

function AfterState() {
  return (
    <div className="relative h-full w-full bg-gradient-to-br from-[#00A896]/10 to-[#00A896]/20 p-6 sm:p-8">
      <div className="absolute inset-0 opacity-5">
        <div className="diagonal-lines" />
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2 bg-teal-100 text-teal-700 px-3 py-1.5 rounded-full text-xs font-mono font-bold border-2 border-teal-300">
        ONE-LINK FLOW
      </div>

      <div className="text-center mb-8">
        <h3 className="font-dela text-2xl sm:text-3xl text-gray-900 mb-2">
          With AuthHub
        </h3>
        <p className="font-mono text-xs text-gray-600">
          One branded request for the access your team needs before kickoff
        </p>
      </div>

      <div className="flex items-center justify-center h-[calc(100%-180px)]">
        <m.div
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.34, 1.56, 0.64, 1],
          }}
          className="relative w-full max-w-sm bg-gradient-to-br from-[#00A896] to-[#00A896]/90 border-4 border-black shadow-[8px_8px_0px_#000] rounded-2xl p-6 sm:p-8"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-card/20 rounded-2xl flex items-center justify-center border-3 border-black/30">
              <Link2 className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="text-white/80 font-mono text-xs uppercase mb-2">
              Your authorization link
            </div>
            <div className="text-white text-lg font-bold">
              authhub.co/agency/xyz123
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card/10 border-2 border-white/30 rounded-lg p-3">
              <div className="font-mono text-[10px] text-white/70 uppercase mb-1">
                Setup time
              </div>
              <div className="text-white text-xl font-dela">5 min</div>
            </div>
            <div className="bg-card/10 border-2 border-white/30 rounded-lg p-3">
              <div className="font-mono text-[10px] text-white/70 uppercase mb-1">
                Request type
              </div>
              <div className="text-white text-xl font-dela">One link</div>
            </div>
            <div className="bg-card/10 border-2 border-white/30 rounded-lg p-3">
              <div className="font-mono text-[10px] text-white/70 uppercase mb-1">
                Client view
              </div>
              <div className="text-white text-xl font-dela">Branded</div>
            </div>
            <div className="bg-card/10 border-2 border-white/30 rounded-lg p-3">
              <div className="font-mono text-[10px] text-white/70 uppercase mb-1">
                Team view
              </div>
              <div className="text-white text-xl font-dela">Clear status</div>
            </div>
          </div>
        </m.div>
      </div>

      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-card/90 border-2 border-black rounded-lg p-3 text-center">
          <div className="font-mono text-xs text-gray-700">
            Clients complete one guided request instead of bouncing between
            platform-specific instructions.
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroCopyRewriteSolutionSection() {
  return (
    <section className="relative py-20 sm:py-24 md:py-32 bg-paper overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none diagonal-lines" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-black" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Reveal delay={0.2}>
          <div className="max-w-4xl mx-auto text-center mb-12 sm:mb-16 md:mb-20">
            <h2 className="font-dela text-4xl sm:text-5xl md:text-6xl lg:text-7xl !leading-[1.05] tracking-tight mb-6 text-ink">
              One link replaces
              <br />
              <span className="text-[#00A896]">platform-by-platform setup.</span>
            </h2>

            <p className="font-mono text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-gray-600">
              One request covers every platform. Clients complete it in minutes.
              Your team tracks progress in one place, not scattered across email
              threads.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.4}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <span className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-full text-xs font-mono font-bold border-2 border-gray-300">
                <span className="animate-pulse">←</span>
                Drag to compare
                <span className="animate-pulse">→</span>
              </span>
            </div>

            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border-4 border-black shadow-brutalist-lg">
              <ImageComparison
                className="h-full w-full"
                enableHover
                springOptions={{ bounce: 0.3, duration: 0.5 }}
              >
                <ImageComparisonImage position="left">
                  <BeforeState />
                </ImageComparisonImage>
                <ImageComparisonImage position="right">
                  <AfterState />
                </ImageComparisonImage>
                <ImageComparisonSlider className="w-2 bg-card/80 shadow-2xl">
                  <div className="absolute left-1/2 top-1/2 h-12 w-10 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card border-4 border-black shadow-brutalist flex items-center justify-center">
                    <div className="flex gap-0.5">
                      <div className="w-0.5 h-6 bg-gray-400 rounded-full" />
                      <div className="w-0.5 h-6 bg-gray-400 rounded-full" />
                    </div>
                  </div>
                </ImageComparisonSlider>
              </ImageComparison>
            </div>

            <div className="mt-12 text-center">
              <m.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-3 bg-teal text-white px-8 sm:px-10 py-5 rounded-2xl font-bold text-xl uppercase tracking-wide border-2 border-black shadow-brutalist hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-200 min-h-[56px] touch-feedback"
                    onClick={handleTrialSignup}
                  >
                    Start Free Trial
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </SignUpButton>
              </m.div>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-black" />
    </section>
  );
}
