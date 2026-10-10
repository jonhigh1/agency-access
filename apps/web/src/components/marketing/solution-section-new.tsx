'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  m,
  useInView,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Mail,
  MessageSquare,
  ShieldAlert,
  Video,
} from 'lucide-react';
import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { Reveal } from './reveal';
import { cn } from '@/lib/utils';

const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

type InboxIcon = 'mail' | 'chat' | 'video' | 'meta' | 'link' | 'granted';

interface InboxItem {
  id: string;
  icon: InboxIcon;
  from: string;
  time: string;
  title: string;
  body: string;
  tone: 'inbound' | 'outbound' | 'error' | 'link' | 'granted';
}

function InboxGlyph({ icon, className }: { icon: InboxIcon; className?: string }) {
  const shared = 'w-4 h-4';
  switch (icon) {
    case 'mail':
      return <Mail className={cn(shared, className)} strokeWidth={2.5} />;
    case 'chat':
      return <MessageSquare className={cn(shared, className)} strokeWidth={2.5} />;
    case 'video':
      return <Video className={cn(shared, className)} strokeWidth={2.5} />;
    case 'meta':
      return <ShieldAlert className={cn(shared, className)} strokeWidth={2.5} />;
    case 'link':
      return <Link2 className={cn(shared, className)} strokeWidth={2.5} />;
    case 'granted':
      return <CheckCircle2 className={cn(shared, className)} strokeWidth={2.5} />;
  }
}

const WITHOUT_MSGS: InboxItem[] = [
  {
    id: 'm1',
    icon: 'mail',
    from: 'Sam · Harbor Dental',
    time: 'MON 9:02 AM',
    title: 'How do we give you access?',
    body: 'Business Manager → Business settings → Partners → add Business ID 1029384756102938. Is that right?',
    tone: 'inbound',
  },
  {
    id: 'm2',
    icon: 'chat',
    from: 'Sam · Harbor Dental',
    time: 'TUE 4:15 PM',
    title: 'Think I added you',
    body: "I wasn't sure which permissions to tick, so I selected a few.",
    tone: 'inbound',
  },
  {
    id: 'm3',
    icon: 'mail',
    from: 'You · Brightpath Agency',
    time: 'WED 11:10 AM',
    title: 'Almost — two assets missing',
    body: 'We only see the Page. The ad account and pixel are missing — could you add those too?',
    tone: 'outbound',
  },
  {
    id: 'm4',
    icon: 'video',
    from: 'Zoom · 15 min call',
    time: 'THU 11:00 AM',
    title: 'Business Manager walkthrough',
    body: '"Honestly, this is confusing. Can we do a quick call?"',
    tone: 'inbound',
  },
  {
    id: 'm5',
    icon: 'video',
    from: 'Zoom · call ended',
    time: 'THU 11:38 AM',
    title: '38 minutes, still stuck',
    body: 'Screen recording: "click Business settings… no, the other one."',
    tone: 'inbound',
  },
  {
    id: 'm6',
    icon: 'meta',
    from: 'Meta Business Suite',
    time: 'THU 12:10 PM',
    title: 'Wrong permissions',
    body: 'Ad account was shared as View only. Request access again.',
    tone: 'error',
  },
];

const WITH_ITEMS: InboxItem[] = [
  {
    id: 'w1',
    icon: 'link',
    from: 'AUTHHUB · ONE LINK',
    time: 'MON 9:02 AM',
    title: 'authhub.co/agency/harbor-dental',
    body: 'One link. Every platform. Correct permissions, first try.',
    tone: 'link',
  },
  {
    id: 'w2',
    icon: 'granted',
    from: 'ACCESS GRANTED',
    time: '9:04 AM',
    title: 'Ad account, Page & Pixel · Admin',
    body: 'Client approved in one click. No calls, no re-requests.',
    tone: 'granted',
  },
];

interface Phase {
  timer: string;
  messages: number;
  calls: number;
  rerequests: number;
  status: string;
  withMode: boolean;
  inboxCount: number; // number of WITHOUT_MSGS visible (newest-first window)
  durationMs: number;
}

const PHASES: Phase[] = [
  { timer: '35m', messages: 2, calls: 0, rerequests: 0, status: 'Still waiting on access', withMode: false, inboxCount: 1, durationMs: 1100 },
  { timer: '54m', messages: 4, calls: 0, rerequests: 0, status: 'Still waiting on access', withMode: false, inboxCount: 2, durationMs: 1100 },
  { timer: '1h 20m', messages: 6, calls: 0, rerequests: 1, status: 'Still waiting on access', withMode: false, inboxCount: 3, durationMs: 1100 },
  { timer: '2h 59m', messages: 5, calls: 0, rerequests: 1, status: 'Still waiting on access', withMode: false, inboxCount: 4, durationMs: 1100 },
  { timer: '3h 10m', messages: 5, calls: 1, rerequests: 1, status: 'Still waiting on access', withMode: false, inboxCount: 5, durationMs: 1100 },
  { timer: '5h', messages: 5, calls: 1, rerequests: 2, status: 'Still waiting on access', withMode: false, inboxCount: 6, durationMs: 1600 },
  { timer: '2m', messages: 1, calls: 0, rerequests: 0, status: 'Link sent. Waiting on one click.', withMode: true, inboxCount: 0, durationMs: 1800 },
  { timer: '2m', messages: 1, calls: 0, rerequests: 0, status: 'Access granted, first try.', withMode: true, inboxCount: 0, durationMs: 2600 },
];

const VISIBLE_WINDOW = 4;

function toneClasses(tone: InboxItem['tone']): string {
  switch (tone) {
    case 'error':
      return 'border-[#C2410C] bg-[#FF6B35]/10';
    case 'link':
      return 'border-black bg-[#09090B] text-[#FAFAFA]';
    case 'granted':
      return 'border-[#0F766E] bg-[#00A896]/10';
    case 'outbound':
      return 'border-black bg-white';
    case 'inbound':
    default:
      return 'border-black bg-white';
  }
}

function chipClasses(tone: InboxItem['tone']): string {
  switch (tone) {
    case 'error':
      return 'border-[#C2410C] bg-[#FF6B35]/20 text-[#C2410C]';
    case 'link':
      return 'border-[#FF6B35] bg-[#FF6B35] text-[#09090B]';
    case 'granted':
      return 'border-[#0F766E] bg-[#00A896]/20 text-[#0F766E]';
    default:
      return 'border-black bg-[#FAFAFA] text-[#09090B]';
  }
}

function InboxCard({ item }: { item: InboxItem }) {
  const dark = item.tone === 'link';
  return (
    <m.div
      layout
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn('border-2 p-3 flex gap-3', toneClasses(item.tone))}
    >
      <div
        className={cn(
          'w-8 h-8 shrink-0 border-2 rounded-none flex items-center justify-center',
          chipClasses(item.tone)
        )}
        aria-hidden
      >
        <InboxGlyph icon={item.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn('font-mono text-[11px] font-bold uppercase tracking-wide truncate', dark ? 'text-[#FAFAFA]' : 'text-[#09090B]')}>
            {item.from}
          </p>
          <p className={cn('font-mono text-[10px] shrink-0', dark ? 'text-[#FAFAFA]/60' : 'text-gray-500')}>
            {item.time}
          </p>
        </div>
        <p className={cn('text-sm font-semibold mt-0.5 leading-snug', dark ? 'text-[#FAFAFA]' : 'text-[#09090B]')}>
          {item.title}
        </p>
        <p className={cn('text-[13px] leading-snug mt-0.5', dark ? 'text-[#FAFAFA]/75' : 'text-gray-600')}>
          {item.body}
        </p>
      </div>
    </m.div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="border-t border-[#FAFAFA]/15 pt-3">
      <p className="label-nano uppercase">{label}</p>
      <AnimatePresence mode="wait" initial={false}>
        <m.p
          key={value}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className={cn('font-dela text-2xl sm:text-3xl mt-1', accent ? 'text-[#FF6B35]' : 'text-[#FAFAFA]')}
        >
          {value}
        </m.p>
      </AnimatePresence>
    </div>
  );
}

/**
 * ChaosToLinkSection — replaces the drag-slider with an auto-playing
 * before/after dramatization (mirrors the ClientInvite "inbox chaos" spot):
 * the left inbox accumulates real access-request messages while the right
 * ink panel counts agency time, messages, calls and re-requests — then the
 * whole thing flips to the one-link outcome.
 */
export function SolutionSectionNew() {
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { amount: 0.25 });
  const reduceMotion = useReducedMotion();
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const t = setTimeout(
      () => setPhaseIdx((i) => (i + 1) % PHASES.length),
      PHASES[phaseIdx].durationMs
    );
    return () => clearTimeout(t);
  }, [phaseIdx, inView, reduceMotion]);

  // Reduced motion: park on the resolved end-state.
  const phase = reduceMotion ? PHASES[PHASES.length - 1] : PHASES[phaseIdx];

  const withoutVisible = WITHOUT_MSGS.slice(0, phase.inboxCount)
    .slice(-VISIBLE_WINDOW)
    .reverse();
  const withVisible = phase.withMode
    ? WITH_ITEMS.slice(0, phaseIdx === PHASES.length - 1 || reduceMotion ? 2 : 1)
    : [];

  return (
    <section className="relative py-20 sm:py-24 md:py-32 bg-paper overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none diagonal-lines" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-black" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <Reveal delay={0.2}>
          <div className="max-w-4xl mx-auto text-center mb-12 sm:mb-16">
            <h2 className="font-dela text-4xl sm:text-5xl md:text-6xl lg:text-7xl !leading-[1.05] tracking-tight mb-6 text-ink">
              One Link.
              <br />
              <span className="text-[#00A896]">All Your Clients.</span>
            </h2>
            <p className="font-mono text-base sm:text-lg max-w-2xl mx-auto leading-relaxed text-gray-600">
              Five hours of back-and-forth, or one link. Watch it play out.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.35}>
          <div className="max-w-5xl mx-auto">
            {/* Screen-reader summary of the animation */}
            <p className="sr-only">
              Without AuthHub: getting ad-account access takes 5 hours across 5
              messages, 1 call and 2 re-requests, and access is still pending.
              With AuthHub: one link is sent, and access is granted in 2
              minutes on the first try.
            </p>

            <div
              ref={frameRef}
              aria-hidden
              className="grid md:grid-cols-2 border-2 border-black bg-paper shadow-brutalist"
            >
              {/* LEFT — inbox */}
              <div className="p-5 sm:p-6 border-b-2 md:border-b-0 md:border-r-2 border-black">
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="font-dela text-lg sm:text-xl text-ink leading-tight">
                    Getting access to Harbor Dental&apos;s ad account
                  </h3>
                  <span className="label-micro uppercase shrink-0 ml-3">Inbox</span>
                </div>
                <div className="flex flex-col gap-3 min-h-[380px] sm:min-h-[420px] content-start">
                  <AnimatePresence initial={false}>
                    {phase.withMode
                      ? withVisible.map((item) => <InboxCard key={item.id} item={item} />)
                      : withoutVisible.map((item) => <InboxCard key={item.id} item={item} />)}
                  </AnimatePresence>
                </div>
              </div>

              {/* RIGHT — ink stats panel */}
              <div className="ink-panel p-5 sm:p-6 flex flex-col">
                <AnimatePresence mode="wait" initial={false}>
                  <m.p
                    key={phase.withMode ? 'with' : 'without'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      'label-micro uppercase',
                      phase.withMode ? 'text-[#FAFAFA]' : 'text-[#FF6B35]'
                    )}
                  >
                    {phase.withMode ? 'With AuthHub' : 'Without AuthHub'}
                  </m.p>
                </AnimatePresence>

                <p className="label-nano uppercase mt-6">Agency time spent</p>
                <AnimatePresence mode="wait" initial={false}>
                  <m.p
                    key={phase.timer}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="font-dela text-6xl sm:text-7xl text-[#FAFAFA] mt-2 tracking-tight"
                  >
                    {phase.timer}
                  </m.p>
                </AnimatePresence>

                <div className="grid grid-cols-3 gap-4 mt-8">
                  <StatCell label="Messages" value={phase.messages} />
                  <StatCell label="Calls" value={phase.calls} />
                  <StatCell label="Re-requests" value={phase.rerequests} />
                </div>

                <div className="mt-auto pt-8">
                  <div className="border-t border-[#FAFAFA]/15 pt-4 flex items-center gap-2">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        phase.withMode ? 'bg-[#00A896]' : 'bg-[#FF6B35] animate-pulse'
                      )}
                    />
                    <AnimatePresence mode="wait" initial={false}>
                      <m.p
                        key={phase.status}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="font-mono text-[13px] text-[#FAFAFA]/85"
                      >
                        {phase.status}
                      </m.p>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="mt-12 text-center">
              <SignUpButton mode="modal">
                <Button
                  type="button"
                  variant="primary"
                  size="xl"
                  className="sm:px-10"
                  onClick={handleTrialSignup}
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </SignUpButton>
              <p className="font-mono text-xs text-gray-500 mt-4">
                No credit card required · Free 14-day trial
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-black" />
    </section>
  );
}

export default SolutionSectionNew;
export { SolutionSectionNew as SolutionSection };
