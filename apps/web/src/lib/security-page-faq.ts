/**
 * /security FAQ copy (AuthHub Growth packet 2026-10-09, shipped verbatim).
 * The visible FAQ and the FAQPage JSON-LD both render from this list so they always match.
 */
export const securityFaqs = [
  {
    question: "Where are client tokens stored?",
    answer:
      "In Infisical, a secrets-management platform. AuthHub's database stores only the name of each Infisical secret, along with connection status, expiry, scopes and selected assets. It never stores the token itself.",
  },
  {
    question: "Is AuthHub SOC 2 certified?",
    answer:
      "No. AuthHub is not SOC 2 certified and holds no other security certification. Our security controls are Infisical token storage and an audit log of access events.",
  },
  {
    question: "Can I see who accessed a client account?",
    answer:
      "AuthHub logs grants, refreshes, sensitive Meta and Google token reads, disconnects and cleanup failures, with the user's email and IP address where available. There's no full audit-log screen in the app yet; each client's Activity tab shows requests, authorizations and connections.",
  },
  {
    question: "What happens when a token expires?",
    answer:
      "Google, LinkedIn and Snapchat connections refresh automatically before expiry. Meta and TikTok can't refresh silently, so the connection is marked expired and the client needs to reconnect. Clients and platforms can also end access early, so no tool can guarantee access never expires.",
  },
  {
    question: "How do I revoke access?",
    answer:
      "Delete the client in AuthHub. That deletes its stored tokens from Infisical for every platform. For Meta, AuthHub also removes the asset access it granted and revokes its app permission. On other platforms, remove any access granted inside the platform from that platform's settings.",
  },
  {
    question: "Does revoking in AuthHub remove access inside Google or LinkedIn?",
    answer:
      "No. It removes AuthHub's tokens, so AuthHub can no longer act. Users or partners added inside Google Ads, LinkedIn or other platforms stay until you or the client remove them there. Meta is the exception: AuthHub removes the Meta asset access it recorded granting.",
  },
] as const;

export const securityFaqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: securityFaqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

