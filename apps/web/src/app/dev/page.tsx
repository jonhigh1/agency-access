import Link from 'next/link';
import { notFound } from 'next/navigation';

const DEV_PAGES = [
  {
    href: '/dev/offboarding-preview',
    title: 'Offboarding Panel Preview',
    description: 'Visual reference for all GoogleOffboardingPanel states',
  },
  {
    href: '/dev/client-detail',
    title: 'Client Detail Harness',
    description: 'Client detail page with mock data',
  },
  {
    href: '/dev/redesign-prototype',
    title: 'Request Flow Redesign Prototype',
    description: 'THROWAWAY: three structural variants of the invite flow',
  },
] as const;

export default function DevIndexPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-foreground">Dev Tools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Development-only preview pages. Not available in production.
        </p>

        <ul className="mt-8 divide-y divide-border">
          {DEV_PAGES.map((page) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="flex flex-col gap-1 py-4 group"
              >
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {page.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {page.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
