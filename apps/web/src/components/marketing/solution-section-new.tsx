'use client';

import { SectionBadge } from './section-badge';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useInView, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import { Reveal } from './reveal';
import { cn } from '@/lib/utils';
import styles from './solution-section.module.css';

const handleTrialSignup = () => {
  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
  localStorage.setItem('selectedBillingInterval', 'yearly');
};

type InboxIcon = 'gmail' | 'slack' | 'imessage' | 'zoom' | 'meta' | 'link' | 'granted';

interface InboxItem {
  id: string;
  icon: InboxIcon;
  from: string;
  time: string;
  title: string;
  body: string;
  tone: 'inbound' | 'outbound' | 'error' | 'link' | 'granted';
}

function InboxGlyph({ icon }: { icon: InboxIcon }) {
  if (icon === 'link') return <Link2 className="w-4 h-4" strokeWidth={2.5} />;
  if (icon === 'granted') return <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />;
  const source = icon === 'meta' ? '/meta-color.svg' : `/brands/${icon}.${icon === 'imessage' ? 'png' : 'svg'}`;
  return <Image src={source} alt="" width={24} height={24} className="object-contain" unoptimized />;
}

const WITHOUT_MSGS: InboxItem[] = [
  {
    id: 'm1',
    icon: 'gmail',
    from: 'Dr. Ellis · Maple Chiro',
    time: 'MON 9:02 AM',
    title: 'How do we give you access?',
    body: 'Business settings, then Partners… which Business ID do I use?',
    tone: 'inbound',
  },
  {
    id: 'm2',
    icon: 'slack',
    from: 'Dr. Ellis · Maple Chiro',
    time: 'TUE 4:15 PM',
    title: 'Think I added you',
    body: "I wasn't sure which permissions to tick, so I selected a few.",
    tone: 'inbound',
  },
  {
    id: 'm3',
    icon: 'gmail',
    from: 'You · Brightpath Agency',
    time: 'WED 11:10 AM',
    title: 'The ad account is missing',
    body: 'The Page is shared, but the ad account is missing. Can you add it too?',
    tone: 'outbound',
  },
  {
    id: 'm4',
    icon: 'imessage',
    from: 'Dr. Ellis · iMessage',
    time: 'THU 11:00 AM',
    title: 'Can we jump on a call?',
    body: '"Honestly, this is confusing. Can we do a quick call?"',
    tone: 'inbound',
  },
  {
    id: 'm5',
    icon: 'zoom',
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
    title: 'authhub.co/agency/maple-chiro',
    body: 'One guided request for the platforms and permissions you need.',
    tone: 'link',
  },
  {
    id: 'w2',
    icon: 'granted',
    from: 'AUTHHUB · ACCESS CONFIRMED',
    time: '9:04 AM',
    title: 'Selected access confirmed',
    body: 'Request complete. Review the selected access in your dashboard.',
    tone: 'granted',
  },
];

interface Phase {
  minutes: number;
  messages: number;
  calls: number;
  rerequests: number;
  status: string;
  withMode: boolean;
  inboxCount: number; // number of WITHOUT_MSGS visible (newest-first window)
  durationMs: number;
}

const PHASES: Phase[] = [
  { minutes: 35, messages: 1, calls: 0, rerequests: 0, status: 'Waiting for the right access', withMode: false, inboxCount: 1, durationMs: 2200 },
  { minutes: 54, messages: 2, calls: 0, rerequests: 0, status: 'Permissions still unclear', withMode: false, inboxCount: 2, durationMs: 2200 },
  { minutes: 80, messages: 3, calls: 0, rerequests: 1, status: 'Following up on missing assets', withMode: false, inboxCount: 3, durationMs: 2400 },
  { minutes: 179, messages: 4, calls: 1, rerequests: 1, status: 'Scheduling a walkthrough', withMode: false, inboxCount: 4, durationMs: 2200 },
  { minutes: 190, messages: 5, calls: 1, rerequests: 1, status: 'Still working through setup', withMode: false, inboxCount: 5, durationMs: 2200 },
  { minutes: 300, messages: 6, calls: 1, rerequests: 2, status: 'Access needs another request', withMode: false, inboxCount: 6, durationMs: 2800 },
  { minutes: 2, messages: 1, calls: 0, rerequests: 0, status: 'Link sent. Client completes the request.', withMode: true, inboxCount: 0, durationMs: 2800 },
  { minutes: 2, messages: 1, calls: 0, rerequests: 0, status: 'Access confirmed. Ready for your team.', withMode: true, inboxCount: 0, durationMs: 3000 },
];

const VISIBLE_WINDOW = 4;

function InboxCard({ item }: { item: InboxItem }) {
  const dark = item.tone === 'link';
  return (
    <article className={cn(styles.card, 'border p-3 flex gap-2 sm:gap-3',
      item.tone === 'error' ? 'border-coral/30 bg-coral/5' :
      item.tone === 'granted' ? 'border-teal/30 bg-card' :
      dark ? 'border-ink bg-ink text-paper' : 'border-border bg-card')}>
      <div className={cn('w-7 h-7 shrink-0 flex items-center justify-center',
        dark ? 'border-coral bg-coral text-ink' :
        item.tone === 'error' ? 'text-danger-ink' :
        item.tone === 'granted' ? 'border-teal/30 text-success-ink' : 'text-muted-foreground')} aria-hidden>
        <InboxGlyph icon={item.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <p className={cn('font-mono text-[10px] font-semibold tracking-wide', dark ? 'text-paper/80' : 'text-muted-foreground')}>{item.from}</p>
          <p className={cn('font-mono text-[10px] shrink-0', dark ? 'text-paper/70' : 'text-muted-foreground')}>{item.time}</p>
        </div>
        <p className="text-sm font-semibold mt-1 leading-snug break-words">{item.title}</p>
        <p className={cn('text-[13px] leading-snug mt-1', dark ? 'text-paper/80' : 'text-muted-foreground')}>{item.body}</p>
      </div>
    </article>
  );
}

function TimeCounter({ phaseIndex, active, reduced, resetting }: {
  phaseIndex: number; active: boolean; reduced: boolean | null; resetting: boolean;
}) {
  const labelRef = useRef<HTMLParagraphElement>(null);
  const minutesRef = useRef(0);
  const previousPhase = useRef(phaseIndex);

  useEffect(() => {
    const label = labelRef.current;
    if (!label) return;
    const phase = PHASES[phaseIndex];
    const format = (value: number) => {
      const minutes = Math.round(value);
      if (minutes < 60) return `${minutes}m`;
      const remainder = minutes % 60;
      return `${Math.floor(minutes / 60)}h${remainder ? ` ${remainder}m` : ''}`;
    };
    // The AuthHub comparison has one fixed total, including reduced motion.
    if (reduced || phase.withMode) {
      minutesRef.current = 2;
      label.textContent = '2m';
      previousPhase.current = phaseIndex;
      return;
    }
    if (phaseIndex === 0 && previousPhase.current !== 0) {
      minutesRef.current = 0;
      label.textContent = '0m';
    }
    previousPhase.current = phaseIndex;
    if (!active || resetting) return;

    const from = minutesRef.current;
    const target = phase.minutes;
    if (from === target) return;
    const started = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 600);
      const eased = 1 - (1 - progress) ** 3;
      minutesRef.current = from + (target - from) * eased;
      label.textContent = format(minutesRef.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phaseIndex, active, reduced, resetting]);

  return <p ref={labelRef} data-testid="agency-time" className="font-display font-semibold text-6xl sm:text-7xl text-paper mt-2 tracking-display-lg tabular-nums leading-none whitespace-nowrap">0m</p>;
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-paper/20 pt-4">
      <p className="label-nano uppercase">{label}</p>
      <p key={value} className={cn(styles.state, "font-display font-semibold text-3xl mt-2 tabular-nums")}>{value}</p>
    </div>
  );
}

export function SolutionSectionNew() {
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { amount: 0.25 });
  const reduceMotion = useReducedMotion();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [resetting, setResetting] = useState(false);
  const complete = phaseIdx === PHASES.length - 1;

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!inView || reduceMotion || hidden) return;
    const timer = setTimeout(() => {
      if (resetting) {
        setPhaseIdx(0);
        setResetting(false);
      } else if (complete) {
        setResetting(true);
      } else {
        setPhaseIdx((index) => index + 1);
      }
    }, resetting ? 250 : PHASES[phaseIdx].durationMs);
    return () => clearTimeout(timer);
  }, [phaseIdx, inView, reduceMotion, hidden, complete, resetting]);

  const phase = reduceMotion ? PHASES[PHASES.length - 1] : PHASES[phaseIdx];
  const history = WITHOUT_MSGS.slice(0, phase.withMode ? WITHOUT_MSGS.length : phase.inboxCount).slice(-VISIBLE_WINDOW).reverse();
  const resolved = WITH_ITEMS.slice(0, complete || reduceMotion ? 2 : 1);

  return (
    <section aria-labelledby="one-link-heading" className="relative py-16 md:py-24 bg-paper border-y border-ink/15">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-5xl mx-auto text-center mb-12 sm:mb-16">
            <SectionBadge variant="ink" icon={Link2}>The simpler way</SectionBadge>
            <h2 id="one-link-heading" className="font-dela text-4xl sm:text-5xl md:text-6xl leading-[1.1] tracking-tight text-ink mb-4 sm:mb-6 text-balance">
              Less chasing.<br /><span className="inline-block text-balance text-danger-ink">More clients ready to go.</span>
            </h2>
            <p className="font-mono text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed text-muted-foreground">
              Send each client one branded link for the access you need. They follow a guided request. Your team sees what’s ready and what needs attention.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="max-w-5xl mx-auto">
            <div ref={frameRef} className={cn(styles.frame, 'border border-ink bg-card')}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/15 px-5 py-3 sm:px-6">
                <span className="label-micro">One client. Two ways to get access.</span>
              </div>
              <p className="sr-only">This illustrative example compares manual follow-up with a guided AuthHub request. Times are examples, not guaranteed results. Clients select their accounts and approve the requested access. Your team can review completion and any required follow-up.</p>
              <div className={cn(styles.sequence, "grid md:grid-cols-[1.2fr_1fr]")} data-resetting={resetting && !reduceMotion ? "true" : undefined} aria-hidden="true">
                <div className="p-5 sm:p-6 md:p-8 border-b md:border-b-0 md:border-r border-ink/15">
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div><h3 className="font-display text-lg font-semibold text-ink">Maple Chiropractic</h3><p className="text-sm text-muted-foreground mt-1">Chiropractic care · Access request</p></div>
                    <Mail className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className={styles.inbox}>
                    <div className={styles.history} data-muted={phase.withMode ? 'true' : undefined}>
                      {history.map((item, index) => (
                        <div key={item.id} className={styles.row} style={{ transform: `translateY(${index * 100}%)` }}>
                          <InboxCard item={item} />
                        </div>
                      ))}
                    </div>
                    {phase.withMode && <div className={styles.resolution}>
                      {resolved.map((item) => <div key={item.id} className={styles.result}><InboxCard item={item} /></div>)}
                    </div>}
                  </div>
                </div>
                <div className="ink-panel p-5 sm:p-6 md:p-8 flex flex-col">
                  <div className="flex items-center gap-2 text-paper">
                    {phase.withMode ? <Link2 className="w-4 h-4 text-coral" /> : <MessageSquare className="w-4 h-4 text-paper/70" />}
                    <span className="label-micro">{phase.withMode ? 'With AuthHub' : 'Without AuthHub'}</span>
                  </div>
                  <div>
                    <p className="label-nano uppercase mt-8">Agency time spent</p>
                    <TimeCounter phaseIndex={reduceMotion ? PHASES.length - 1 : phaseIdx} active={inView && !hidden} reduced={reduceMotion} resetting={resetting} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-8">
                    <StatCell label="Messages" value={phase.messages} />
                    <StatCell label="Calls" value={phase.calls} />
                    <StatCell label="Follow-ups" value={phase.rerequests} />
                  </div>
                  <div className="mt-auto pt-8">
                    <div className="border-t border-paper/20 pt-4 flex items-start gap-3 min-h-[64px]">
                      {phase.withMode && (complete || reduceMotion) ? <CheckCircle2 className="w-4 h-4 text-paper mt-0.5 shrink-0" /> : <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', phase.withMode ? 'bg-teal' : 'bg-coral')} />}
                      <p key={phase.status} className={cn(styles.state, 'font-display text-sm text-paper/85 leading-relaxed')}>{phase.status}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            <div className="mt-10 text-center">
              <SignUpButton mode="modal">
                <Button type="button" variant="primary" size="xl" className="px-5 sm:px-10" onClick={handleTrialSignup}>
                  Send Your First Link<ArrowRight className="w-5 h-5" />
                </Button>
              </SignUpButton>
              <p className="text-sm text-muted-foreground mt-4">14-day free trial · No credit card required</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default SolutionSectionNew;
export { SolutionSectionNew as SolutionSection };
