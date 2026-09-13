'use client';

/**
 * Public SignIn/SignUp buttons that keep Clerk modal UI off the first paint.
 * Types use `typeof import('@clerk/nextjs')` so the runtime module is only
 * loaded after mount.
 */

import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';

type ClerkAuthButtons = typeof import('@clerk/nextjs');
type SignInButtonProps = ComponentProps<ClerkAuthButtons['SignInButton']>;
type SignUpButtonProps = ComponentProps<ClerkAuthButtons['SignUpButton']>;
type ClerkSignInButton = ClerkAuthButtons['SignInButton'];
type ClerkSignUpButton = ClerkAuthButtons['SignUpButton'];

let clerkAuthButtonsPromise: Promise<{
  SignInButton: ClerkSignInButton;
  SignUpButton: ClerkSignUpButton;
}> | null = null;

function loadClerkAuthButtons() {
  clerkAuthButtonsPromise ??= import('@clerk/nextjs').then((mod) => ({
    SignInButton: mod.SignInButton,
    SignUpButton: mod.SignUpButton,
  }));
  return clerkAuthButtonsPromise;
}

function LazyClerkButton({
  kind,
  props,
}: {
  kind: 'SignInButton' | 'SignUpButton';
  props: SignInButtonProps | SignUpButtonProps;
}) {
  const [Loaded, setLoaded] = useState<ClerkSignInButton | ClerkSignUpButton | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadClerkAuthButtons().then((buttons) => {
      if (!cancelled) {
        setLoaded(() => buttons[kind]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  if (!Loaded) {
    return <>{props.children}</>;
  }

  return <Loaded {...props} />;
}

export function SignInButton(props: SignInButtonProps): ReactNode {
  return <LazyClerkButton kind="SignInButton" props={props} />;
}

export function SignUpButton(props: SignUpButtonProps): ReactNode {
  return <LazyClerkButton kind="SignUpButton" props={props} />;
}
