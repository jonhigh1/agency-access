import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | AuthHub",
  description: "Read the terms and conditions for using AuthHub's OAuth aggregation platform.",
  alternates: {
    canonical: 'https://authhub.co/terms',
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-muted-foreground">
          Last updated: September 3, 2026
        </p>

        <div className="mt-12 space-y-12 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              AuthHub is owned and operated by High Enterprises LLC, a Wyoming limited liability
              company. By accessing or using AuthHub (&quot;Service&quot;), you agree to be bound by these
              Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not
              use the Service. These Terms apply to all users, including agencies and their
              clients who authorize platform access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">2. Description of Service</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              AuthHub is an OAuth aggregation platform that enables marketing agencies to
              streamline client onboarding by collecting platform authorizations (Meta, Google
              Ads, GA4, LinkedIn, and others) through a single branded link. The Service
              securely stores and manages OAuth tokens on behalf of agencies and their clients.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">3. Account Registration</h2>
            <div className="mt-4 space-y-4 text-muted-foreground leading-7">
              <p>
                To use the Service, you must create an account and provide accurate, complete
                information. You are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use</li>
                <li>Ensuring your account information remains current and accurate</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">4. Acceptable Use</h2>
            <div className="mt-4 space-y-4 text-muted-foreground leading-7">
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Service for any unlawful purpose or in violation of any laws</li>
                <li>Access or attempt to access accounts or data belonging to others without authorization</li>
                <li>Interfere with or disrupt the Service or servers connected to the Service</li>
                <li>Attempt to gain unauthorized access to any part of the Service</li>
                <li>Use the Service to collect, store, or process data in violation of applicable privacy laws</li>
                <li>Resell, sublicense, or redistribute the Service without our written consent</li>
                <li>Use automated means to access the Service except through our provided APIs</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">5. OAuth Token Management</h2>
            <div className="mt-4 space-y-4 text-muted-foreground leading-7">
              <p>
                <strong className="text-foreground">Token Storage:</strong> We securely store OAuth
                tokens using industry-standard encryption and secret management practices. Tokens
                are stored only for the duration necessary to provide the Service.
              </p>
              <p>
                <strong className="text-foreground">Token Usage:</strong> You agree to use OAuth
                tokens only for legitimate business purposes related to managing advertising
                campaigns and analytics on behalf of your clients.
              </p>
              <p>
                <strong className="text-foreground">Client Authorization:</strong> You are
                responsible for obtaining proper authorization from your clients before
                requesting access to their advertising and analytics platforms.
              </p>
              <p>
                <strong className="text-foreground">Token Revocation:</strong> Clients may revoke
                access at any time through the Service or directly through the respective
                platform. AuthHub tries to remove recorded Meta asset access and revoke the
                Meta app permission before it deletes the related tokens. If a provider or
                secret-store request fails, AuthHub blocks the authorization and keeps the
                required token so an administrator can retry cleanup. Other platform tokens
                are also deleted when their authorization is revoked; if deletion fails,
                AuthHub blocks that authorization and records a retryable cleanup failure.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">6. Client Responsibilities</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              When your clients authorize platform access through AuthHub, they acknowledge
              that they are granting your team account access to their advertising and analytics
              accounts. You are responsible for clearly communicating to your clients what
              access you are requesting and how it will be used.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">7. Fees and Payment</h2>
            <div className="mt-4 space-y-4 text-muted-foreground leading-7">
              <p>
                <strong className="text-foreground">Subscription Plans:</strong> The Service is
                offered through various subscription plans. Current pricing is available on our
                website.
              </p>
              <p>
                <strong className="text-foreground">Billing:</strong> Subscription fees are billed
                in advance on a monthly or annual basis. All fees are non-refundable except as
                required by law.
              </p>
              <p>
                <strong className="text-foreground">Changes:</strong> We may modify our pricing
                with 30 days&apos; notice. Continued use of the Service after price changes
                constitutes acceptance of the new pricing.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">8. Intellectual Property</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              The Service, including its original content, features, and functionality, is
              owned by High Enterprises LLC and is protected by international copyright, trademark, and
              other intellectual property laws. You may not copy, modify, or create derivative
              works based on the Service without our express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">9. Third-Party Services</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              The Service integrates with third-party platforms (Meta, Google, LinkedIn, etc.).
              Your use of these platforms is subject to their respective terms of service and
              privacy policies. We are not responsible for the availability, accuracy, or
              policies of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">10. Disclaimer of Warranties</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
              KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE
              UNINTERRUPTED, SECURE, OR ERROR-FREE. WE DISCLAIM ALL WARRANTIES, INCLUDING
              IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">11. Limitation of Liability</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, AUTHHUB SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
              OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF
              DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE
              SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">12. Indemnification</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              You agree to indemnify and hold harmless AuthHub and its officers, directors,
              employees, and agents from any claims, damages, losses, or expenses (including
              reasonable attorneys&apos; fees) arising from your use of the Service, violation of
              these Terms, or infringement of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">13. Termination</h2>
            <div className="mt-4 space-y-4 text-muted-foreground leading-7">
              <p>
                We may terminate or suspend your account at any time for violation of these
                Terms or for any other reason at our sole discretion. Upon termination:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your right to use the Service will immediately cease</li>
                <li>
                  We will remove stored OAuth tokens during termination cleanup. If Meta cleanup
                  fails, we block the authorization and keep the required token until an
                  administrator can retry.
                </li>
                <li>You remain responsible for any fees incurred prior to termination</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">14. Changes to Terms</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              We reserve the right to modify these Terms at any time. We will notify you of
              material changes by posting the updated Terms on our website and updating the
              &quot;Last updated&quot; date. Your continued use of the Service after changes
              constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">15. Governing Law</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              These Terms shall be governed by and construed in accordance with the laws of
              the State of Delaware, without regard to its conflict of law provisions. Any
              disputes arising from these Terms shall be resolved in the courts of Delaware.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold">16. Contact Us</h2>
            <p className="mt-4 text-muted-foreground leading-7">
              If you have questions about these Terms of Service, please contact us at:
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
