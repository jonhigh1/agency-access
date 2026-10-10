/**
 * Security / trust page
 * Target URL: /security
 *
 * Copy ships verbatim from the AuthHub Growth packet
 * (2026-10-09 security trust page, claims verified against main @ 0f9d0299).
 * Do not edit claims here without re-running the claim check.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { securityFaqSchema, securityFaqs } from "@/lib/security-page-faq";
import { PartnerBadges } from "@/components/marketing/partner-badges";

const PAGE_URL = "https://authhub.co/security";
const PAGE_TITLE = "AuthHub Security: Token Vault, Audit Log & Revoking Access";
const META_DESCRIPTION =
  "How AuthHub stores client OAuth tokens in Infisical, refreshes them, logs access in an audit log, and revokes it. Plain answer: not SOC 2 certified.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: META_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: META_DESCRIPTION,
    type: "website",
    url: PAGE_URL,
  },
  alternates: {
    canonical: PAGE_URL,
  },
};

const refreshRows = [
  {
    platform: "Google (Google Ads, GA4 and other Google connections)",
    behavior: "Refreshes automatically with the stored refresh token",
  },
  { platform: "LinkedIn", behavior: "Refreshes automatically" },
  { platform: "Snapchat", behavior: "Refreshes automatically" },
  {
    platform: "Meta (Facebook, Instagram)",
    behavior:
      "Can't refresh silently. When the token expires, the connection is marked expired and the client needs to reconnect.",
  },
  { platform: "TikTok", behavior: "Reconnect required when access expires" },
  {
    platform: "Manual / invite-based platforms (e.g. Pinterest, Shopify, Klaviyo, Mailchimp)",
    behavior: "No token to refresh. Access lives inside the platform.",
  },
] as const;

const tableClass = "w-full border-collapse border-2 border-black font-mono text-sm";
const thClass = "border border-black p-3 text-left font-bold";
const tdClass = "border border-black p-3 align-top";
const h2Class = "font-dela text-xl md:text-2xl text-ink mb-6";
const pClass = "font-mono text-sm text-foreground mb-4";
const ulClass =
  "list-disc list-inside space-y-2 font-mono text-sm text-foreground mb-4 marker:text-coral";
const linkClass = "text-danger-ink font-bold hover:underline";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(securityFaqSchema) }}
      />

      <section className="border-b-2 border-black bg-coral/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-dela text-3xl sm:text-4xl md:text-5xl text-ink mb-4 tracking-tight">
              How AuthHub keeps client access secure
            </h1>
            <p className="font-mono text-xs text-muted-foreground mb-6">
              Updated <time dateTime="2026-10-09">October 9, 2026</time>
            </p>
            <p className="font-mono text-base text-foreground mb-4">
              <strong>Short answer:</strong> AuthHub stores client OAuth tokens in Infisical, a dedicated
              secrets manager. AuthHub&apos;s own database holds only a reference to each secret, never the
              token itself. Grants, automatic refreshes, sensitive token reads, disconnects and cleanup
              failures are written to an audit log. AuthHub is <strong>not</strong> SOC 2 certified.
            </p>
            <p className="font-mono text-sm text-foreground">
              This page explains what that means in practice: where tokens live, which platforms refresh on
              their own, what the audit log records (and what you can&apos;t see yet), and what actually
              happens when you revoke access.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="storage-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="storage-heading" className={h2Class}>
              Where client tokens are stored (Infisical)
            </h2>
            <p className={pClass}>
              When a client approves access through your AuthHub link, the platform returns OAuth tokens to
              AuthHub. We write them straight to <strong>Infisical</strong>, a secrets-management platform.
              The stored secret contains the access token, the refresh token (if the platform issues one),
              the expiry time and the granted scopes.
            </p>
            <p className={pClass}>AuthHub&apos;s PostgreSQL database never holds the token. It holds:</p>
            <ul className={ulClass}>
              <li>
                the <strong>name</strong> of the Infisical secret (a reference, not the token)
              </li>
              <li>connection status (active, expired, invalid, revoked)</li>
              <li>expiry and last-refresh timestamps</li>
              <li>the scopes and the assets the client selected</li>
            </ul>
            <p className={pClass}>
              AuthHub&apos;s API authenticates to Infisical with its own machine identity, and only
              server-side code reads tokens back. Encryption of the stored secrets is handled by Infisical,
              not by AuthHub code. For how Infisical encrypts and protects secrets, see{" "}
              <a
                href="https://infisical.com/docs/internals/security"
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                Infisical&apos;s security documentation
              </a>
              .
            </p>
            <p className="font-mono text-sm text-foreground">
              The same pattern covers your agency&apos;s own platform connections and other credentials
              AuthHub stores for you, such as webhook signing secrets.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="refresh-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="refresh-heading" className={h2Class}>
              Token refresh and expiry
            </h2>
            <p className={pClass}>Access tokens expire. What happens next depends on the platform:</p>
            <div className="overflow-x-auto mb-6">
              <table className={tableClass}>
                <thead>
                  <tr className="bg-ink text-white">
                    <th className={thClass}>Platform</th>
                    <th className={thClass}>What AuthHub does</th>
                  </tr>
                </thead>
                <tbody className="bg-paper">
                  {refreshRows.map((row) => (
                    <tr key={row.platform}>
                      <td className={tdClass}>{row.platform}</td>
                      <td className={tdClass}>{row.behavior}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={pClass}>
              Every 12 hours, a background job looks for connections that expire within the next seven days
              and queues a refresh for the platforms that support it. The new tokens go back into Infisical.
              If a refresh fails because the platform says the grant is no longer valid, the connection is
              flagged for reconnection rather than retried forever. Brief provider outages are retried.
            </p>
            <p className="font-mono text-sm text-foreground">
              Refresh can&apos;t fix everything. Clients can revoke access, change passwords, or lose admin
              rights on their side, and platforms can end a grant on their own schedule. AuthHub keeps access
              working where the platform allows it; it can&apos;t promise access never expires. For the
              platform-by-platform detail, read our guide to{" "}
              <Link href="/blog/oauth-token-management-agencies" className={linkClass}>
                OAuth token management for agencies
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="audit-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="audit-heading" className={h2Class}>
              What the audit log records
            </h2>
            <p className={pClass}>
              AuthHub writes security-relevant events to an audit log stored in its own database. Each row
              records the action, the connection or request it touched, the platform, and, where available,
              the user&apos;s email, IP address and user agent, with a timestamp. Events include:
            </p>
            <ul className={ulClass}>
              <li>
                <strong>Grants:</strong> a client authorizes a platform and its connection is created
              </li>
              <li>
                <strong>Asset selection:</strong> the client chooses which ad accounts, pages or properties to
                share
              </li>
              <li>
                <strong>Token reads:</strong> when AuthHub reads a stored Meta or Google token for a sensitive
                operation, such as verifying access or removing it
              </li>
              <li>
                <strong>Automatic refreshes:</strong> success, &quot;reconnect required&quot;, or failure
              </li>
              <li>
                <strong>Agency connections:</strong> your agency connecting or disconnecting its own platform
                accounts, and their refreshes
              </li>
              <li>
                <strong>Requests:</strong> an access request being cancelled
              </li>
              <li>
                <strong>Cleanup failures:</strong> when Meta access removal or token deletion from Infisical
                doesn&apos;t complete
              </li>
              <li>
                <strong>AI agents:</strong> creating, updating or revoking a personal-agent (MCP) grant, and the
                operations an agent runs
              </li>
            </ul>
            <p className="font-mono text-sm text-foreground">
              <strong>What you can see today:</strong> there is no full audit-log screen in the AuthHub app
              yet. Each client has an <strong>Activity</strong> timeline showing requests created, client
              authorizations and connections established. Connected AI agents show when they were last used,
              and an agent with activity permission can list its own recent activity. AuthHub doesn&apos;t
              publish a fixed retention period for audit records.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="revoke-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="revoke-heading" className={h2Class}>
              Revoking access and offboarding a client
            </h2>
            <p className={pClass}>
              There are four places you can revoke, and they do different things:
            </p>
            <p className={pClass}>
              <strong>1. Delete a client in AuthHub.</strong> AuthHub revokes every connection for that client
              before it deletes the record.
            </p>
            <ul className={ulClass}>
              <li>
                For <strong>every platform</strong>, it deletes the stored tokens from Infisical and marks the
                authorizations revoked. AuthHub can no longer act on that client&apos;s accounts.
              </li>
              <li>
                For <strong>Meta</strong>, it goes further. Before deleting the token, AuthHub removes the Meta
                asset access it recorded granting (pages, ad accounts, catalogs and datasets shared with your
                business, users or system users), then revokes AuthHub&apos;s app permission on the
                client&apos;s Meta account.
              </li>
              <li>
                For <strong>other platforms</strong> (Google, LinkedIn, TikTok, Snapchat and the rest), deleting
                AuthHub&apos;s tokens does <strong>not</strong> remove any user, partner or manager-account
                access that was granted inside the platform itself. Remove that in the platform&apos;s own
                settings, or ask the client to.
              </li>
              <li>
                If Meta or Infisical doesn&apos;t confirm the cleanup, the connection is marked invalid, the
                failure is logged, and the delete stops so it can be retried. It won&apos;t report success when
                cleanup failed.
              </li>
            </ul>
            <p className={pClass}>
              <strong>2. Disconnect your agency&apos;s own platform account</strong> from the Connections
              page. AuthHub deletes the stored tokens and logs the disconnect. For Meta, it also revokes
              AuthHub&apos;s app permission and any system-user tokens it created first.
            </p>
            <p className={pClass}>
              <strong>3. Cancel a pending access request.</strong> The link stops working, and the
              cancellation is logged.
            </p>
            <p className={pClass}>
              <strong>4. Revoke an AI agent.</strong> Under Settings → Agents, revoking a personal-agent grant
              cuts that agent off immediately, and the revocation is logged.
            </p>
            <p className="font-mono text-sm text-foreground">
              Your clients stay in control too. They can remove access at any time from the platform&apos;s
              own settings (Google account permissions, Meta Business settings and so on), without going
              through AuthHub.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="compliance-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="compliance-heading" className={h2Class}>
              Compliance: what we have and what we don&apos;t
            </h2>
            <p className={pClass}>
              <strong>AuthHub is not SOC 2 certified.</strong> We don&apos;t hold SOC 2, ISO 27001 or any
              other security certification, and we don&apos;t claim to be &quot;SOC 2 ready.&quot; If your
              procurement process requires a SOC 2 report, AuthHub won&apos;t meet that requirement today.
            </p>
            <p className={pClass}>What we have:</p>
            <ul className="list-disc list-inside space-y-2 font-mono text-sm text-foreground marker:text-coral">
              <li>
                client and agency OAuth tokens stored in <strong>Infisical</strong>, with only secret
                references in our database
              </li>
              <li>
                an <strong>audit log</strong> of grants, refreshes, sensitive token reads, disconnects and
                cleanup failures
              </li>
              <li>
                revocation that deletes stored tokens and, for Meta, removes the platform-side access AuthHub
                granted
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-paper" aria-labelledby="platforms-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="max-w-3xl mx-auto">
            <h2 id="platforms-heading" className={h2Class}>
              Platforms
            </h2>
            <p className="font-mono text-sm text-foreground">
              AuthHub connects <strong>15+ platforms</strong>, including Meta, Google Ads, GA4, LinkedIn,
              TikTok and Snapchat, plus invite-based platforms. If you&apos;re weighing tools, see how we
              compare with{" "}
              <Link href="/compare/leadsie-alternative" className={linkClass}>
                Leadsie
              </Link>
              ,{" "}
              <Link href="/compare/agencyaccess-alternative" className={linkClass}>
                AgencyAccess
              </Link>{" "}
              and{" "}
              <Link href="/compare/clientinvite-alternative" className={linkClass}>
                ClientInvite
              </Link>
              . If AI agents will use client access, read{" "}
              <Link href="/blog/mcp-oauth-client-access-agencies" className={linkClass}>
                MCP OAuth for agencies
              </Link>
              .
            </p>
            <div className="mt-6">
              <p className="font-mono text-sm text-foreground">
                AuthHub is an official Google and Meta partner.
              </p>
              <PartnerBadges className="mt-3" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b-2 border-black bg-card" aria-labelledby="faq-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2
            id="faq-heading"
            className="font-dela text-2xl md:text-3xl text-ink mb-8 text-center max-w-3xl mx-auto"
          >
            Security FAQ
          </h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {securityFaqs.map((faq) => (
              <div key={faq.question} className="border-2 border-ink p-4 rounded-none">
                <h3 className="font-dela text-lg text-ink">{faq.question}</h3>
                <p className="font-mono text-sm text-foreground mt-4 pt-4 border-t border-gray-200">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink text-white" aria-labelledby="get-started-heading">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="get-started-heading" className="font-dela text-xl md:text-2xl mb-6">
              Get started
            </h2>
            <p className="font-mono text-sm">
              Plans are priced by active clients:{" "}
              <strong>$29/month for 5, $79/month for 20, $149/month for 50</strong>.{" "}
              <Link href="/pricing" className="font-bold underline hover:no-underline">
                See pricing →
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
