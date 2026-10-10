'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { getDocsUrl } from '@/lib/docs-url';

export function MarketingFooter() {
  const pathname = usePathname();
  const router = useRouter();
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute('href');
    if (href?.includes('#')) {
      e.preventDefault();
      const targetId = href.slice(href.indexOf('#') + 1);

      if (pathname !== '/') {
        router.push(href as Route);
        return;
      }
      
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const scrollToElement = () => {
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
          } else {
            // Retry once after a short delay if element not found
            setTimeout(() => {
              const retryElement = document.getElementById(targetId);
              if (retryElement) {
                const headerHeight = 80;
                const elementTop = retryElement.getBoundingClientRect().top;
                const elementPosition = elementTop + window.pageYOffset;
                const offsetPosition = elementPosition - headerHeight;
                
                window.scrollTo({
                  top: offsetPosition,
                  behavior: 'smooth',
                });
              }
            }, 100);
          }
        };
        
        scrollToElement();
      });
    }
  };

  return (
    <footer className="bg-card py-16 sm:py-20 md:py-24 border-t-2 border-black">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between gap-8 sm:gap-12">
          <div className="max-w-xs space-y-4 sm:space-y-6">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-black shadow-[4px_4px_0px_#000] rounded-none bg-card">
                <img
                  src="/authhub.png"
                  alt="AuthHub"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-dela text-2xl tracking-tight text-ink">AuthHub</span>
            </div>
            <p className="text-gray-600 leading-relaxed text-sm font-mono">
              The easy button for client account access.
              Replace weeks of back-and-forth with one link.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 md:gap-12 w-full md:w-auto">
            <div>
              <h4 className="label-micro mb-4 sm:mb-6">Product</h4>
              <ul className="space-y-3 sm:space-y-4 text-sm text-gray-600 font-mono">
                <li><Link href="/#trusted-by-agencies" onClick={handleSmoothScroll} className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Features</Link></li>
                <li><Link href="/#how-it-works" onClick={handleSmoothScroll} className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">How It Works</Link></li>
                <li><Link href="/pricing" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Pricing</Link></li>
                <li><Link href="/affiliate" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Affiliates</Link></li>
                <li><Link href="/guides" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Guides</Link></li>
                <li><Link href="/blog" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Blog</Link></li>
                <li><a href={getDocsUrl()} className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Help Center</a></li>
              </ul>
            </div>
            <div>
              <h4 className="label-micro mb-4 sm:mb-6">Compare</h4>
              <ul className="space-y-3 sm:space-y-4 text-sm text-gray-600 font-mono">
                <li><Link href="/compare" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">All comparisons</Link></li>
                <li><Link href="/compare/leadsie-alternative" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Leadsie Alternative</Link></li>
                <li><Link href="/compare/agencyaccess-alternative" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">AgencyAccess Alternative</Link></li>
                <li><Link href="/compare/clientinvite-alternative" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">ClientInvite Alternative</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="label-micro mb-4 sm:mb-6">Company</h4>
              <ul className="space-y-3 sm:space-y-4 text-sm text-gray-600 font-mono">
                <li><Link href={"/about" as Route} className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">About</Link></li>
                <li><Link href={"/contact" as Route} className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="label-micro mb-4 sm:mb-6">Legal</h4>
              <ul className="space-y-3 sm:space-y-4 text-sm text-gray-600 font-mono">
                <li><Link href="/privacy-policy" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Terms of Service</Link></li>
                <li><Link href={"/security" as Route} className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Security</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 md:mt-24 pt-6 sm:pt-8 border-t-2 border-black flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <p className="text-xs sm:text-sm text-gray-600 font-mono">
            © {new Date().getFullYear()} High Enterprises LLC. All rights reserved. AuthHub is owned and operated by High Enterprises LLC.
          </p>
          <div className="flex gap-6 sm:gap-8 text-xs sm:text-sm text-gray-600 font-mono">
            <Link href="/privacy-policy" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Privacy</Link>
            <Link href="/terms" className="hover:text-danger-ink hover:underline decoration-2 underline-offset-2 transition-all">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
