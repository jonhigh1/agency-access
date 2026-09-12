'use client';

import { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { SUPPORTED_PLATFORM_COUNT } from '@agency-platform/shared';
import { Reveal } from '../reveal';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How does the 14-day free trial work?",
    answer: "All plans include a 14-day free trial with full access to features—no credit card required. After the trial, you can subscribe to Starter, Growth, or Scale based on your needs.",
  },
  {
    question: "What's the difference between Starter, Growth, and Scale?",
    answer: `Starter ($29/mo, $24/mo yearly) is for small agencies with up to 5 active clients, unlimited team seats, and all ${SUPPORTED_PLATFORM_COUNT} platform integrations. Growth ($79/mo, $66/mo yearly) adds full white-label branding, custom domain, webhooks & API access, priority support, and token health monitoring for up to 20 active clients. Scale ($149/mo, $124/mo yearly) includes everything in Growth plus multi-brand management (up to 3 brands) and custom integrations for up to 50 active clients. All plans bill by active client count (not monthly onboards) with no rollover—add or remove clients anytime.`,
  },
  {
    question: "Can I change plans later?",
    answer: "Yes! Upgrade or downgrade anytime. When upgrading, you'll be prorated for the remainder of your billing cycle. When downgrading, you'll receive credit towards future billing. Your existing client connections remain active regardless of your plan.",
  },
  {
    question: "What happens when I need more active clients than my plan includes?",
    answer: "All plans include automatic overage at $20/mo per 5-client pack—added and removed automatically as your client count changes. No hard limits, no interrupted onboarding, and no surprise bills. You're always in control.",
  },
  {
    question: "Do you offer discounts for annual billing?",
    answer: "Yes! Annual billing gives you 2 months free (pay for 10 months, get 12). Starter drops from $29/mo to $24/mo, Growth from $79/mo to $66/mo, and Scale from $149/mo to $124/mo. Most teams choose annual for the savings.",
  },
  {
    question: "How secure is my OAuth data?",
    answer: "We use bank-level encryption via Infisical to store all OAuth tokens. We're GDPR ready, and every token access is written to a complete audit log. We never store tokens directly in our database—only secure references to encrypted vault storage.",
  },
  {
    question: "Can I use my own domain with white-label?",
    answer: "Growth and Scale plans include custom domain support (e.g., access.yourbrand.com). Starter includes AuthHub-branded links. All plans include white-label branding options—Starter with AuthHub branding, Growth and Scale with your full brand.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const supportLocalPart = 'support';
  const supportDomainPart = 'authhub.co';

  const handleContactSupportClick = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const at = String.fromCharCode(64); // '@'
    const email = `${supportLocalPart}${at}${supportDomainPart}`;
    window.location.href = `mailto:${email}`;
  };

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-16 sm:py-20 md:py-24 bg-paper relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)',
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Reveal>
          {/* Section Header */}
          <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
            <div className="inline-block mb-4">
              <div className="bg-coral/10 text-danger-ink border-2 border-coral/30 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider inline-block">
                FAQ
              </div>
            </div>
            <h2 className="font-dela text-3xl sm:text-4xl md:text-5xl tracking-tight mb-4 text-ink">
              Common questions
            </h2>
            <p className="text-base sm:text-lg text-gray-600 font-mono">
              Everything you need to know about pricing, plans, and getting started.
            </p>
          </div>
        </Reveal>

        {/* FAQ Accordion */}
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
                {/* Question Button */}
                <button
                  onClick={() => toggleFAQ(index)}
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

                {/* Answer */}
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

        {/* Still Have Questions */}
        <Reveal delay={0.3}>
          <m.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <div className="inline-block border-2 border-black bg-card p-6 shadow-brutalist-sm">
              <p className="font-mono text-sm text-gray-700 mb-4">
                Still have questions?
              </p>
              <a
                href="#"
                className="inline-block font-bold uppercase tracking-wider text-xs px-6 py-3 border-2 border-black bg-coral text-white hover:bg-ink hover:shadow-brutalist transition-all duration-200"
                onClick={handleContactSupportClick}
                aria-label="Contact support"
              >
                Contact Support
              </a>
            </div>
          </m.div>
        </Reveal>
      </div>
    </section>
  );
}
