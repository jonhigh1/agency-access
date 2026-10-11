import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    // Centered prebuilt card; the sign-up page owns the two-column layout.
    <div className="relative min-h-screen bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.12),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <SignIn afterSignInUrl="/dashboard" />
      </div>
    </div>
  );
}
