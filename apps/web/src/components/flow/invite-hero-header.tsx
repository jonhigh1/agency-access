import { Lock, ShieldCheck } from 'lucide-react';

interface InviteHeroHeaderProps {
  title: string;
  description?: string;
  badge?: string;
  logoUrl?: string | null;
  logoAlt?: string;
}

/**
 * Truthful header: what is being asked, from whom, and the security promise.
 * No eyebrow, no stats grid (critique: decorative scaffolding).
 */
export function InviteHeroHeader({
  title,
  description,
  badge,
  logoUrl,
  logoAlt,
}: InviteHeroHeaderProps) {
  return (
    <div>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={logoAlt || 'Agency logo'}
          className="mb-4 h-10 w-auto max-h-10 object-contain"
        />
      ) : null}
      <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink font-display">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-ink">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden />
        <span>
          You stay in control. Approve only what you want to share.{' '}
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Passwords are never requested.
          </span>
          {badge ? <span className="label-nano ml-1">{badge}</span> : null}
        </span>
      </p>
    </div>
  );
}
