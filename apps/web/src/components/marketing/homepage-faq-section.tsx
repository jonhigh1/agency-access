'use client';

import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Reveal } from './reveal';

const faqs = [
  {
    question: 'What is AuthHub?',
    answer:
      'AuthHub is an automated client OAuth onboarding platform that lets digital agencies send a single branded link so clients can authorize Meta Ads, Google Ads, GA4, LinkedIn, and TikTok in under 5 minutes — replacing days of back-and-forth emails.',
  },
  {
    question: 'How does AuthHub handle OAuth token security?',
    answer:
      'OAuth tokens are encrypted at rest using Infisical—not stored in our database. Complete audit logs track every token access. Tokens auto-refresh before expiration, so access stays active without manual intervention.',
  },
  {
    question: 'Which ad platforms does AuthHub support?',
    answer:
      'AuthHub currently supports Meta Ads, Google Ads, GA4, LinkedIn Ads, and TikTok—replacing days of back-and-forth email with a single branded link.',
  },
  {
    question: 'How long does client onboarding take with AuthHub?',
    answer:
      'Most clients complete authorization in under 5 minutes. Agencies report reducing onboarding from 2–3 days to the same day they send the link.',
  },
  {
    question: 'Is AuthHub white-label?',
    answer:
      'Yes. Agencies can add their own logo, brand colors, and custom domain so clients see a consistent, agency-branded experience throughout the OAuth flow.',
  },
];

export function HomepageFAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 sm:py-20 lg:py-24 bg-paper border-t-2 border-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="font-dela text-3xl sm:text-4xl lg:text-5xl text-ink mb-4">
              Frequently Asked Questions
            </h2>
          </div>
        </Reveal>

        <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
          {faqs.map((faq, index) => (
            <Reveal key={index} delay={index * 0.05}>
              <m.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3 }}
                className="border-2 border-black bg-card shadow-brutalist-sm overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-base sm:text-lg text-ink pr-8">
                    {faq.question}
                  </span>
                  <m.div
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown size={20} className="text-gray-600" />
                  </m.div>
                </button>

                <AnimatePresence>
                  {openIndex === index && (
                    <m.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 py-5 border-t-2 border-black bg-gray-50">
                        <p className="text-sm sm:text-base text-gray-700 leading-relaxed font-mono">
                          {faq.answer}
                        </p>
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </m.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
