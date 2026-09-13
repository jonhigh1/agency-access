'use client';

import { SignInButton, SignUpButton } from '@/components/lazy-clerk-auth-buttons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { m, AnimatePresence } from 'framer-motion';

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-transform duration-300"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      {open ? (
        <>
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </>
      ) : (
        <>
          <path d="M3 12h18" />
          <path d="M3 6h18" />
          <path d="M3 18h18" />
        </>
      )}
    </svg>
  );
}

/** Scroll to a section by ID, accounting for the fixed header height. */
function scrollToSection(targetId: string) {
  const targetElement = document.getElementById(targetId);
  if (targetElement) {
    const headerHeight = 80; // h-20 = 80px
    const elementTop = targetElement.getBoundingClientRect().top;
    const elementPosition = elementTop + window.pageYOffset;
    const offsetPosition = elementPosition - headerHeight;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }
}

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // After navigating to homepage, scroll to the hash target once the page renders
  useEffect(() => {
    if (pathname === '/' && window.location.hash) {
      const targetId = window.location.hash.substring(1);
      // Wait for the page content to mount before scrolling
      const timer = setTimeout(() => scrollToSection(targetId), 300);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    const target = e.currentTarget;
    const href = target.getAttribute('href');
    
    if (href && href.startsWith('#')) {
      e.preventDefault();
      const targetId = href.substring(1);
      
      // Capture menu state before closing
      const wasMenuOpen = mobileMenuOpen;
      
      // Close mobile menu first
      setMobileMenuOpen(false);

      // If we're NOT on the homepage, navigate there first with the hash
      if (pathname !== '/') {
        router.push(`/${href}` as any);
        return;
      }
      
      // On the homepage — scroll directly to the section
      const delay = wasMenuOpen ? 300 : 0;
      setTimeout(() => scrollToSection(targetId), delay);
    } else {
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b-2 border-black bg-card">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo - Brutalist box */}
        <Link href="/" className="flex items-center space-x-3 group" onClick={handleLinkClick}>
          <div className="w-14 h-14 flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_#000] rounded-none bg-card group-hover:shadow-[6px_6px_0px_#000] group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] transition-all duration-200 relative">
            <img
              src="/authhub.png"
              alt="AuthHub"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-dela text-3xl tracking-tight text-ink font-bold hover:text-danger-ink transition-colors">AuthHub</span>
        </Link>

        {/* Desktop Navigation - Brutalist pills */}
        <div className="hidden md:flex items-center space-x-3">
          <Link href="#trusted-by-agencies" onClick={handleLinkClick} className="px-4 py-2 text-sm font-bold text-ink border-2 border-black rounded-none hover:bg-black hover:text-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#000] transition-all duration-200 uppercase tracking-wider">Features</Link>
          <Link href="#how-it-works" onClick={handleLinkClick} className="px-4 py-2 text-sm font-bold text-ink border-2 border-black rounded-none hover:bg-black hover:text-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#000] transition-all duration-200 uppercase tracking-wider">How It Works</Link>
          <Link href="/pricing" className="px-4 py-2 text-sm font-bold text-danger-ink border-2 border-black rounded-none hover:bg-coral hover:text-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#000] transition-all duration-200 uppercase tracking-wider">Pricing</Link>
          <Link href="/blog" onClick={handleLinkClick} className="px-4 py-2 text-sm font-bold text-success-ink border-2 border-black rounded-none hover:bg-teal hover:text-white hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#000] transition-all duration-200 uppercase tracking-wider">Blog</Link>
        </div>

        {/* Desktop Actions - Brutalist buttons */}
        <div className="hidden md:flex items-center gap-3">
          <div className="h-6 w-px bg-black" />
          <SignInButton mode="modal">
            <Button variant="secondary" size="sm" className="font-bold uppercase tracking-wider text-xs">Sign In</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button
              variant="brutalist"
              size="md"
              className="font-bold uppercase tracking-wider text-xs px-6"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('selectedSubscriptionTier', 'STARTER');
                  localStorage.setItem('selectedBillingInterval', 'yearly');
                }
              }}
            >
              Get Started
            </Button>
          </SignUpButton>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-muted/10 touch-feedback"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
        >
          <MenuIcon open={mobileMenuOpen} />
        </button>
      </div>

      {/* Mobile Menu Overlay - Rendered via Portal */}
      {isMounted && createPortal(
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 z-[9998] bg-black/50 md:hidden"
                aria-hidden="true"
              />

              {/* Mobile Menu Panel - Brutalist bento grid */}
              <m.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 z-[9999] w-full max-w-sm bg-card md:hidden shadow-brutalist-lg border-l-2 border-black flex flex-col"
                style={{ backgroundColor: 'white' }}
              >
              {/* Mobile Menu Header */}
              <div className="flex items-center justify-between p-4 border-b-2 border-black flex-shrink-0">
                <span className="font-dela text-xl font-bold">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center p-2 min-h-[44px] min-w-[44px] border-2 border-black rounded-none hover:bg-black hover:text-white hover:shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] touch-feedback transition-all duration-200"
                  aria-label="Close menu"
                >
                  <MenuIcon open={true} />
                </button>
              </div>

              {/* Mobile Menu Content - Bento grid layout */}
              <div className="flex-1 p-4 overflow-y-auto bg-card">
                  {/* Navigation Links - Brutalist grid */}
                  <div className="grid grid-cols-1 gap-3 mb-6">
                    <Link
                      href="#trusted-by-agencies"
                      onClick={handleLinkClick}
                      className="py-4 px-6 text-lg font-bold min-h-[60px] flex items-center border-2 border-black rounded-none hover:bg-black hover:text-white hover:shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200 touch-feedback"
                    >
                      Features
                    </Link>
                    <Link
                      href="#how-it-works"
                      onClick={handleLinkClick}
                      className="py-4 px-6 text-lg font-bold min-h-[60px] flex items-center border-2 border-black rounded-none hover:bg-black hover:text-white hover:shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200 touch-feedback"
                    >
                      How It Works
                    </Link>
                    <Link
                      href="/pricing"
                      className="py-4 px-6 text-lg font-bold min-h-[60px] flex items-center border-2 border-coral bg-coral/5 text-danger-ink hover:bg-coral hover:text-white hover:shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200 touch-feedback"
                    >
                      Pricing
                    </Link>
                    <Link
                      href="/blog"
                      onClick={handleLinkClick}
                      className="py-4 px-6 text-lg font-bold min-h-[60px] flex items-center border-2 border-teal bg-teal/5 text-success-ink hover:bg-teal hover:text-white hover:shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all duration-200 touch-feedback"
                    >
                      Blog
                    </Link>
                  </div>

                  {/* Auth Buttons - Brutalist */}
                  <div className="space-y-3 pt-6 border-t-2 border-black">
                    <SignInButton mode="modal">
                      <Button
                        variant="secondary"
                        className="w-full font-bold uppercase tracking-wider text-sm py-6"
                        onClick={handleLinkClick}
                      >
                        Sign In
                      </Button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <Button
                        variant="brutalist"
                        className="w-full font-bold uppercase tracking-wider text-sm py-6"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('selectedSubscriptionTier', 'STARTER');
                            localStorage.setItem('selectedBillingInterval', 'yearly');
                          }
                          setMobileMenuOpen(false);
                        }}
                      >
                        Get Started
                      </Button>
                    </SignUpButton>
                  </div>
                </div>
              </m.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </nav>
  );
}
