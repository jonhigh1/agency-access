import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | AuthHub",
  description: "Learn how AuthHub collects, uses, and protects your personal information.",
  alternates: {
    canonical: 'https://authhub.co/privacy-policy',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-muted-foreground">
          Last updated: September 3, 2026
        </p>

        <div className="mt-12 space-y-12 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold">1. Introduction</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              AuthHub is owned and operated by High Enterprises LLC, a Wyoming limited liability
              company (&quot;AuthHub,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard
              your information when you use our OAuth aggregation platform and related
              services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">2. Information We Collect</h2>
            <div className="mt-4 space-y-4 text-muted-foreground leading-7">
              <p>
                <strong className="text-foreground">Account Information:</strong> When you create an account,
                we collect your name, email address, company name, and billing information.
              </p>
              <p>
                <strong className="text-foreground">OAuth Tokens:</strong> We securely store OAuth access tokens
                and refresh tokens that your clients authorize to enable platform integrations.
                These tokens are encrypted and stored using industry-standard security practices.
              </p>
              <p>
                <strong className="text-foreground">Usage Data:</strong> We collect information about how you
                interact with our service, including access request history, platform connections,
                and feature usage.
              </p>
              <p>
                <strong className="text-foreground">Client Information:</strong> When your clients authorize
                access, we collect their email addresses and the platform permissions they grant.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
            <ul className="mt-4 list-disc pl-6 space-y-2 text-muted-foreground leading-7">
              <li>To provide and maintain our OAuth aggregation services</li>
              <li>To process and manage platform authorizations on your behalf</li>
              <li>To send you service-related notifications and updates</li>
              <li>To respond to your inquiries and provide customer support</li>
              <li>To improve and optimize our platform</li>
              <li>To detect and prevent fraud or unauthorized access</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">4. Data Sharing and Disclosure</h2>
            <div className="mt-4 space-y-4 text-muted-foreground leading-7">
              <p>We do not sell your personal information. We may share your information with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="text-foreground">Service Providers:</strong> Third-party vendors who assist
                  in operating our platform (e.g., cloud hosting, payment processing).
                </li>
                <li>
                  <strong className="text-foreground">Advertising Platforms:</strong> OAuth tokens are used solely
                  to authenticate with the platforms your clients authorize (Meta, Google Ads,
                  LinkedIn, etc.).
                </li>
                <li>
                  <strong className="text-foreground">Legal Requirements:</strong> When required by law or to
                  protect our rights and safety.
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">5. Data Security</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="mt-4 list-disc pl-6 space-y-2 text-muted-foreground leading-7">
              <li>Encryption of OAuth tokens at rest and in transit</li>
              <li>OAuth tokens stored in Infisical, never in our database</li>
              <li>Regular security audits and monitoring</li>
              <li>Access controls and audit logging</li>
              <li>GDPR-ready data handling, including deletion on request</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">6. Data Retention</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              We retain your information for as long as your account is active or as needed
              to provide services. OAuth tokens are retained until revoked by the client or
              agency. You may request deletion of your data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">7. Your Rights</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              Depending on your location, you may have the right to:
            </p>
            <ul className="mt-4 list-disc pl-6 space-y-2 text-muted-foreground leading-7">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">8. Cookies and Tracking</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              We use essential cookies to maintain session state and authentication.
              We may use analytics cookies to understand how our service is used.
              You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">9. Third-Party Links</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              Our service may contain links to third-party websites and advertising platforms.
              We are not responsible for the privacy practices of these external sites.
              We encourage you to review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">10. Children&apos;s Privacy</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              Our service is not intended for individuals under the age of 18.
              We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">11. Changes to This Policy</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              We may update this Privacy Policy from time to time. We will notify you
              of any material changes by posting the new policy on this page and updating
              the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">12. Contact Us</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              If you have questions about this Privacy Policy or our data practices,
              please contact us at:
            </p>
            <p className="mt-4 text-muted-foreground leading-7">
              High Enterprises LLC<br />
              30 N Gould St Ste N<br />
              Sheridan, WY 82801<br />
              Email: support [at] authhub.co
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
