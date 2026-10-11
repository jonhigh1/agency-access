'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSignUp } from '@clerk/nextjs';
import { ArrowLeft, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * SignUpScreen — custom sign-up flow (useSignUp) replacing the prebuilt
 * Clerk card, so the page can match the approved two-column layout:
 * form on paper (left), social proof on the ink panel (right — the view's
 * one brutalist element).
 *
 * Completion redirects to onboarding; Google SSO returns through
 * /sso-callback (kept public in proxy.ts).
 */

const ONBOARDING_URL = '/onboarding/unified';

// Approved testimonial (see components/marketing/success-stories-section.tsx).
const TESTIMONIAL = {
  quote:
    'We were spending days just trying to get access to client accounts before we could even start building automations. AuthHub changed everything. Now our clients connect their platforms in 5 minutes, and we can start building workflows the same day.',
  author: 'AJ S.',
  role: 'Co-Founder, Pillar AI Agency',
};

type Pending = 'none' | 'email' | 'verify' | 'google';

// Design system: tokens, not hex. This is a brand mark, not a color decision.
function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2 3.7-5 3.7-8.6z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C16.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c.9-2.8 3.6-4.9 6.8-4.9z"
      />
    </svg>
  );
}

// Two-ring focus for inputs (v2.0): 3px coral outline + 6px soft halo.
const inputClasses =
  'w-full min-h-[44px] rounded-none border border-black bg-card px-4 py-3 text-ink placeholder:text-muted-foreground focus-visible:outline-[3px] focus-visible:outline-coral/25 focus-visible:outline-offset-0 focus-visible:[box-shadow:0_0_0_6px_rgb(var(--primary)/0.08)]';

function readClerkError(err: unknown): string {
  const maybe = err as { errors?: { message?: string }[]; message?: string };
  return (
    maybe?.errors?.[0]?.message ??
    (err instanceof Error ? err.message : '') ??
    'Something went wrong. Please try again.'
  );
}

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>('none');

  async function completeSession(sessionId: string | null | undefined) {
    if (sessionId && setActive) {
      await setActive({ session: sessionId });
    }
    router.push(ONBOARDING_URL);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError(null);

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setPending('email');
    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === 'complete') {
        await completeSession(result.createdSessionId);
        return;
      }
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err) {
      setError(readClerkError(err));
    } finally {
      setPending('none');
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError(null);
    setPending('verify');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete') {
        await completeSession(result.createdSessionId);
        return;
      }
      setError('That code did not complete verification. Request a new one and try again.');
    } catch (err) {
      setError(readClerkError(err));
    } finally {
      setPending('none');
    }
  }

  async function handleResend() {
    if (!signUp) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setError(readClerkError(err));
    }
  }

  async function handleGoogle() {
    if (!signUp) return;
    setError(null);
    setPending('google');
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: ONBOARDING_URL,
      });
    } catch (err) {
      setError(readClerkError(err));
      setPending('none');
    }
  }

  const blockSubmit = !isLoaded;

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-2">
      {/* Form column */}
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center justify-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-black bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/authhub.png" alt="AuthHub" className="h-full w-full object-contain" />
            </span>
            <span className="font-dela text-2xl tracking-tight text-ink">AuthHub</span>
          </Link>

          {step === 'form' ? (
            <>
              <h1 className="mb-3 text-center text-3xl font-semibold tracking-display-md text-ink">
                Create your free account in 30 seconds
              </h1>
              <p className="mb-8 text-center text-sm text-muted-foreground">
                Join hundreds of agencies onboarding new clients without sharing credentials.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                {error && (
                  <p role="alert" className="mb-4 text-sm text-danger-ink">
                    {error}
                  </p>
                )}

                <div className="mb-4">
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <p className="label-nano mt-1.5">Password must be at least 8 characters long</p>

                <Button type="submit" className="mt-6 w-full" isLoading={pending === 'email'} disabled={blockSubmit}>
                  Sign up
                </Button>
              </form>

              <div className="my-6 flex items-center gap-4" aria-hidden="true">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">Or continue with</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="secondary"
                className="w-full"
                leftIcon={<GoogleLogo />}
                onClick={handleGoogle}
                isLoading={pending === 'google'}
                disabled={blockSubmit}
              >
                Continue with Google
              </Button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  href="/sign-in"
                  className="font-semibold text-ink underline underline-offset-4 hover:text-danger-ink"
                >
                  Sign in here
                </Link>
              </p>

              <p className="mt-8 text-center text-xs text-muted-foreground">
                By signing up you agree to our{' '}
                <Link href="/terms" className="underline underline-offset-4 hover:text-danger-ink">
                  Terms and Conditions
                </Link>{' '}
                and confirm that you have read our{' '}
                <Link
                  href="/privacy-policy"
                  className="underline underline-offset-4 hover:text-danger-ink"
                >
                  Privacy Policy
                </Link>
              </p>
            </>
          ) : (
            <>
              <h2 className="mb-2 text-center text-2xl font-semibold tracking-display-md text-ink">
                Verify your email
              </h2>
              <p className="mb-8 text-center text-sm text-muted-foreground">
                Enter the code we sent to {email}.
              </p>

              <form onSubmit={handleVerify} noValidate>
                {error && (
                  <p role="alert" className="mb-4 text-sm text-danger-ink">
                    {error}
                  </p>
                )}
                <div className="mb-6">
                  <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-ink">
                    Verification code
                  </label>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={inputClasses}
                  />
                </div>
                <Button type="submit" className="w-full" isLoading={pending === 'verify'}>
                  Verify
                </Button>
              </form>

              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                  onClick={() => {
                    setStep('form');
                    setCode('');
                    setError(null);
                  }}
                >
                  Use a different email
                </Button>
                <Button variant="ghost" size="sm" onClick={handleResend}>
                  Resend code
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Social proof column — the view's one ink panel */}
      <div className="ink-panel flex items-center px-6 py-12 sm:px-10 lg:py-0">
        <div className="mx-auto w-full max-w-md">
          <div className="flex gap-1 text-coral" role="img" aria-label="Rated 5 out of 5 stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current" aria-hidden="true" />
            ))}
          </div>

          <blockquote className="mt-8 font-display text-xl leading-relaxed sm:text-2xl">
            &ldquo;{TESTIMONIAL.quote}&rdquo;
          </blockquote>

          <div className="mt-8 flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-coral/40 bg-coral/15 font-display text-sm font-semibold"
            >
              AJ
            </span>
            <div>
              <p className="label-micro">{TESTIMONIAL.author}</p>
              <p className="label-nano">{TESTIMONIAL.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
