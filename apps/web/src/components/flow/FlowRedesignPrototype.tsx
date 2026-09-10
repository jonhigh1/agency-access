/**
 * PROTOTYPE — throwaway. Do not promote to production as-is.
 *
 * Question: how should the redesigned client invite flow compose
 * (stage + progress + agency identity + primary action) under Acid
 * Brutalism v2, without the five-surface pile-up found in critique?
 *
 * Three structurally different variants of the invite flow, switchable
 * via ?variant=, hosted at /dev/redesign-prototype (dev-only).
 * Fold the winning structure into the real flow, then delete this file.
 */

'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Circle, CircleAlert, Play } from 'lucide-react';

// ---------------------------------------------------------------------------
// Mock data (shape mirrors the real invite API payload)
// ---------------------------------------------------------------------------

type PlatformStatus = 'complete' | 'active' | 'pending' | 'attention';

interface MockPlatform {
  name: string;
  detail: string;
  status: PlatformStatus;
}

const MOCK = {
  agencyName: 'Northstar Growth',
  agencyEmail: 'ops@northstar.co',
  businessId: '123456789',
  clientName: 'Acme Co',
  platforms: [
    { name: 'Google Ads', detail: 'Admin access · My Business', status: 'complete' },
    { name: 'Meta', detail: 'Ad account + Business Manager', status: 'active' },
    { name: 'Beehiiv', detail: 'Add ops@northstar.co as teammate', status: 'pending' },
    { name: 'Kit', detail: 'Add ops@northstar.co as teammate', status: 'pending' },
    { name: 'Pinterest', detail: 'Access was revoked — re-approve', status: 'attention' },
  ] as MockPlatform[],
};

const done = MOCK.platforms.filter((p) => p.status === 'complete').length;
const total = MOCK.platforms.length;

// ---------------------------------------------------------------------------
// Shared system pieces (v2: status = icon + word + ink token, never color alone)
// ---------------------------------------------------------------------------

const STATUS: Record<
  PlatformStatus,
  { word: string; icon: React.ReactNode; className: string }
> = {
  complete: {
    word: 'Done',
    icon: <Check className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-[rgb(var(--success-ink))]',
  },
  active: {
    word: 'In progress',
    icon: <Play className="h-3 w-3" aria-hidden />,
    className: 'text-[rgb(var(--ink))]',
  },
  pending: {
    word: 'Waiting',
    icon: <Circle className="h-3 w-3" aria-hidden />,
    className: 'text-[rgb(var(--muted-foreground))]',
  },
  attention: {
    word: 'Needs you',
    icon: <CircleAlert className="h-3.5 w-3.5" aria-hidden />,
    className: 'text-[rgb(var(--danger-ink))]',
  },
};

function StatusChip({ status }: { status: PlatformStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 ${s.className}`}>
      {s.icon}
      <span className="label-micro">{s.word}</span>
    </span>
  );
}

function Header() {
  return (
    <header className="border-b-2 border-black pb-6">
      <p className="label-micro">Access request</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[rgb(var(--ink))]">
        {MOCK.agencyName} needs access to finish setup
      </h1>
      <p className="mt-2 text-sm text-[rgb(var(--ink-secondary))]">
        You stay in control. Approve only what you want to share. Passwords are
        never requested.
      </p>
      <p className="label-nano mt-3">
        {done} of {total} complete
      </p>
    </header>
  );
}

function StageCard() {
  return (
    <section className="brutalist-card bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="label-micro">Now · step {done + 1} of {total}</p>
        <StatusChip status="active" />
      </div>
      <h2 className="mt-3 text-xl font-bold">Connect Meta</h2>
      <p className="mt-2 text-sm text-[rgb(var(--ink-secondary))]">
        Grant {MOCK.agencyName} access to your Meta ad account. You will leave
        this page for Meta and come right back.
      </p>
      <div className="mt-4 border border-black p-3 text-sm">
        <span className="label-micro">Verify before you approve</span>
        <p className="mt-1">
          Agency: {MOCK.agencyEmail} · Business ID: {MOCK.businessId}
        </p>
      </div>
      <button className="brutalist-btn mt-5 min-h-[44px] w-full bg-[rgb(var(--coral))] px-4 text-white">
        Connect Meta — you&apos;ll come right back
      </button>
    </section>
  );
}

function PlatformRow({ p }: { p: MockPlatform }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-black/20 py-2 last:border-0">
      <div>
        <span className="text-sm font-semibold">{p.name}</span>
        <span className="label-nano ml-2 hidden sm:inline">{p.detail}</span>
      </div>
      <StatusChip status={p.status} />
    </div>
  );
}

function QueueList({ title }: { title: string }) {
  return (
    <section>
      <p className="label-micro mb-2">{title}</p>
      <div>
        {MOCK.platforms.map((p) => (
          <PlatformRow key={p.name} p={p} />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Variant A — Single Stage: one card on screen, everything else is a list
// ---------------------------------------------------------------------------

function VariantASingleStage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Header />
      <StageCard />
      <QueueList title="The full request" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant B — Split Desk: stage left, sticky rail right (desktop only)
// ---------------------------------------------------------------------------

function RailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b-2 border-black py-4 first:pt-0 last:border-0 last:pb-0">
      <p className="label-micro mb-2">{label}</p>
      {children}
    </div>
  );
}

function VariantBSplitDesk() {
  return (
    <div className="mx-auto max-w-4xl">
      <Header />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <StageCard />
          <QueueList title="Everything else" />
        </div>
        <aside className="self-start border-2 border-black bg-card p-4 lg:sticky lg:top-6">
          <RailBlock label="Progress">
            <p className="text-sm">
              <span className="font-mono font-bold">{done}/{total}</span> platforms done
            </p>
          </RailBlock>
          <RailBlock label="Who is asking">
            <p className="text-sm font-semibold">{MOCK.agencyName}</p>
            <p className="label-nano mt-1 break-all">{MOCK.agencyEmail}</p>
            <p className="label-nano">Business ID {MOCK.businessId}</p>
          </RailBlock>
          <RailBlock label="Safe by default">
            <p className="text-sm text-[rgb(var(--ink-secondary))]">
              Approve only what you want to share. Revoke any time.
            </p>
          </RailBlock>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant C — Checklist Scroll: one column, the list IS the flow, flat footer CTA
// ---------------------------------------------------------------------------

function VariantCChecklistScroll() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="sticky top-0 z-10 border-b-2 border-black bg-background py-3">
        <p className="label-micro">
          {done}/{total} done — keep going
        </p>
      </div>
      <div className="space-y-8 py-6">
        <Header />
        {MOCK.platforms.map((p, i) => (
          <section
            key={p.name}
            className={`border-2 p-4 ${p.status === 'active' ? 'border-black shadow-brutalist' : 'border-black/25'}`}
          >
            <div className="flex items-center justify-between">
              <span className="label-micro">
                {String(i + 1).padStart(2, '0')} · {p.name}
              </span>
              <StatusChip status={p.status} />
            </div>
            <p className="label-nano mt-1">{p.detail}</p>
            {p.status === 'active' && (
              <>
                <p className="mt-3 text-sm text-[rgb(var(--ink-secondary))]">
                  You will leave for Meta and come right back.
                </p>
                <button className="brutalist-btn mt-3 min-h-[44px] w-full bg-[rgb(var(--coral))] px-4 text-white">
                  Connect Meta
                </button>
              </>
            )}
            {p.status === 'attention' && (
              <p className="mt-3 text-sm text-[rgb(var(--danger-ink))]">
                Access was revoked. Re-approve to unblock {MOCK.agencyName}.
              </p>
            )}
          </section>
        ))}
      </div>
      <footer className="sticky bottom-14 border-2 border-black bg-card p-3">
        <p className="label-nano">
          Stuck? Reply to the email from {MOCK.agencyEmail}.
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switcher (prototype-only UI, dev-gated by the page)
// ---------------------------------------------------------------------------

const VARIANTS = [
  { key: 'A', name: 'Single Stage', el: <VariantASingleStage /> },
  { key: 'B', name: 'Split Desk', el: <VariantBSplitDesk /> },
  { key: 'C', name: 'Checklist Scroll', el: <VariantCChecklistScroll /> },
];

function PrototypeSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const idx = Math.max(
    0,
    VARIANTS.findIndex((v) => v.key === current),
  );
  const go = useCallback(
    (dir: 1 | -1) => {
      const next = VARIANTS[(idx + dir + VARIANTS.length) % VARIANTS.length];
      router.replace(`/dev/redesign-prototype?variant=${next.key}`);
    },
    [idx, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const v = VARIANTS[idx];
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border-2 border-black bg-white px-3 py-2 shadow-brutalist">
      <button aria-label="Previous variant" onClick={() => go(-1)} className="px-2 text-lg font-bold">
        ←
      </button>
      <span className="label-micro whitespace-nowrap">
        {v.key} — {v.name}
      </span>
      <button aria-label="Next variant" onClick={() => go(1)} className="px-2 text-lg font-bold">
        →
      </button>
    </div>
  );
}

export function FlowRedesignPrototype() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('variant') ?? 'A';
  const v = VARIANTS.find((x) => x.key === current) ?? VARIANTS[0];

  useEffect(() => {
    if (!searchParams.get('variant')) {
      router.replace('/dev/redesign-prototype?variant=A');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto mb-6 max-w-xl border border-dashed border-black/40 p-3">
        <p className="label-nano">
          PROTOTYPE — throwaway route for the request-flow redesign. Not
          production. ← / → or the bar below switch variants.
        </p>
      </div>
      {v.el}
      <PrototypeSwitcher current={v.key} />
    </div>
  );
}
