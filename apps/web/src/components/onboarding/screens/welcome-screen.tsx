/**
 * Welcome Screen (Screen 0)
 *
 * The first screen users see in the unified onboarding flow.
 * Purpose: Arrest attention, set expectations, create excitement.
 *
 * Key Elements:
 * - Full-screen with gradient background (handled by UnifiedWizard)
 * - Clear value prop: link first, tokens after client authorizes
 * - Single CTA (no escape)
 * - Pre-fill agency name from Clerk user data (in context)
 *
 * Design Principles:
 * - Interruptive: Can't be ignored or skipped
 * - Optimistic: Sets positive expectations
 * - Clear: Users know exactly what they'll get
 */

'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { scaleVariants, scaleTransition } from '@/lib/animations';

// ============================================================
// TYPES
// ============================================================

interface WelcomeScreenProps {
  onNext: () => void;
  agencyName?: string; // Pre-filled from Clerk user data
}

// ============================================================
// COMPONENT
// ============================================================

export function WelcomeScreen({ onNext, agencyName }: WelcomeScreenProps) {
  return (
    <motion.div
      className="p-6 md:p-10"
      variants={scaleVariants}
      initial="initial"
      animate="animate"
      transition={scaleTransition}
    >
      {/* Content */}
      <div className="text-center space-y-6">
        {/* Logo/Icon */}
        <motion.div className="mb-4 flex justify-center">
          <Image
            src="/authhub_transparent_2.png"
            alt="AuthHub logo"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            priority
          />
        </motion.div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl font-bold text-ink">
          Welcome to AuthHub
        </h1>

        {/* Value Proposition */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal/10 border border-teal rounded-full text-success-ink font-semibold text-sm">
            <span className="text-2xl">🎯</span>
            <span>Create your first access link in minutes</span>
          </div>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            No more 2-3 day OAuth nightmares. Create a branded access link,
            send it to your client — once they authorize, tokens appear in your dashboard.
          </p>
        </div>

        {/* Key Benefits */}
        <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
          {[
            {
              icon: '⚡',
              title: 'Lightning Fast',
              description: 'From sign-up to shareable access link in minutes',
            },
            {
              icon: '🔒',
              title: 'Secure by Default',
              description: 'OAuth tokens encrypted and stored securely',
            },
            {
              icon: '🎨',
              title: 'Branded Experience',
              description: 'Your logo, colors, and custom domain',
            },
          ].map((benefit, index) => (
            <motion.div
              key={benefit.title}
              className="p-4 bg-paper border-2 border-black rounded-lg text-left"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
            >
              <div className="text-2xl mb-2">{benefit.icon}</div>
              <h3 className="font-semibold text-ink mb-1">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Personalization (if agency name is available) */}
        {agencyName && (
          <motion.div
            className="mt-6 p-4 bg-paper border-2 border-black rounded-lg max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-ink text-sm">
              <span className="font-semibold">We've pre-filled your agency name:</span>{' '}
              <span className="font-mono bg-card px-2 py-0.5 rounded">{agencyName}</span>
              <span className="text-foreground ml-2">(you can change this next)</span>
            </p>
          </motion.div>
        )}

        {/* Single CTA */}
        <motion.button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-8 py-4 bg-coral hover:bg-coral/90 text-white font-bold text-lg rounded-lg shadow-brutalist hover:shadow-brutalist-lg transition-all mt-8 border-2 border-black"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Let's set up your agency and create your first link
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        {/* Trust Indicators */}
        <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-success-ink" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-success-ink" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Free to start</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
