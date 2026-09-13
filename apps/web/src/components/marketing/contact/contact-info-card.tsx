'use client';

import { useState } from 'react';
import { Mail, Calendar, Clock, Linkedin, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScheduleDemoModal } from '@/components/marketing/schedule-demo-modal';
import { getDocsUrl } from '@/lib/docs-url';

export function ContactInfoCard() {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const supportLocalPart = 'support';
  const supportDomainPart = 'authhub.co';

  const handleEmailClick = () => {
    // Build mailto at click time so plaintext email doesn't appear in initial HTML.
    const at = String.fromCharCode(64); // '@'
    const email = `${supportLocalPart}${at}${supportDomainPart}`;
    window.location.href = `mailto:${email}`;
  };

  return (
    <>
      <div className="bg-paper p-8 border-2 border-black shadow-brutalist h-full flex flex-col">
        {/* Header */}
        <h3 className="font-display text-xl font-bold text-ink mb-6">
          Contact Information
        </h3>

        {/* Contact Methods */}
        <div className="space-y-6">
          {/* Email */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-coral/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-danger-ink" />
            </div>
            <div>
              <p className="font-mono text-sm text-gray-500 mb-1">Email us</p>
              <a
                href="#"
                className="text-ink hover:text-danger-ink transition-colors font-medium"
                onClick={(e) => {
                  e.preventDefault();
                  handleEmailClick();
                }}
                aria-label="Email support"
              >
                support [at] authhub.co
              </a>
            </div>
          </div>

          {/* Schedule Demo */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-coral/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-danger-ink" />
            </div>
            <div>
              <p className="font-mono text-sm text-gray-500 mb-1">Talk to us</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsDemoModalOpen(true)}
              >
                Schedule a Demo
              </Button>
            </div>
          </div>

          {/* Response Time */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-teal/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-success-ink" />
            </div>
            <div>
              <p className="font-mono text-sm text-gray-500 mb-1">Response time</p>
              <p className="text-ink font-medium">Within 24 hours</p>
            </div>
          </div>
        </div>

        {/* Spacer to push bottom content down */}
        <div className="flex-1" />

        {/* Divider */}
        <div className="border-t border-gray-200 my-6" />

        {/* Social Links */}
        <div>
          <p className="font-mono text-sm text-gray-500 mb-3">Follow us</p>
          <div className="flex gap-3">
            <a
              href="https://linkedin.com/company/authhub"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 bg-muted/10 rounded-none flex items-center justify-center text-muted-foreground hover:bg-coral/10 hover:text-danger-ink transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com/authhub"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 bg-muted/10 rounded-none flex items-center justify-center text-muted-foreground hover:bg-coral/10 hover:text-danger-ink transition-colors"
              aria-label="X (Twitter)"
            >
              <Twitter className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Quick Help */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="font-mono text-xs text-gray-500 mb-2">Looking for quick answers?</p>
          <a
            href={getDocsUrl()}
            className="text-danger-ink hover:text-danger-ink transition-colors text-sm font-medium"
          >
            Visit the Help Center &rarr;
          </a>
        </div>
      </div>

      {/* Schedule Demo Modal */}
      <ScheduleDemoModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
    </>
  );
}
