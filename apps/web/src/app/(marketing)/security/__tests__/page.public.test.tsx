import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { securityFaqSchema, securityFaqs } from "@/lib/security-page-faq";
import SecurityPage, { metadata } from "../page";

vi.mock("@/components/ui/platform-icon", () => ({
  PlatformIcon: ({ platform }: { platform: string }) => (
    <div data-testid={`platform-icon-${platform}`} />
  ),
}));

// FAQPage JSON-LD exactly as approved in the AuthHub Growth packet (2026-10-09).
const APPROVED_FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Where are client tokens stored?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "In Infisical, a secrets-management platform. AuthHub's database stores only the name of each Infisical secret, along with connection status, expiry, scopes and selected assets. It never stores the token itself."
      }
    },
    {
      "@type": "Question",
      "name": "Is AuthHub SOC 2 certified?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. AuthHub is not SOC 2 certified and holds no other security certification. Our security controls are Infisical token storage and an audit log of access events."
      }
    },
    {
      "@type": "Question",
      "name": "Can I see who accessed a client account?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "AuthHub logs grants, refreshes, sensitive Meta and Google token reads, disconnects and cleanup failures, with the user's email and IP address where available. There's no full audit-log screen in the app yet; each client's Activity tab shows requests, authorizations and connections."
      }
    },
    {
      "@type": "Question",
      "name": "What happens when a token expires?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Google, LinkedIn and Snapchat connections refresh automatically before expiry. Meta and TikTok can't refresh silently, so the connection is marked expired and the client needs to reconnect. Clients and platforms can also end access early, so no tool can guarantee access never expires."
      }
    },
    {
      "@type": "Question",
      "name": "How do I revoke access?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Delete the client in AuthHub. That deletes its stored tokens from Infisical for every platform. For Meta, AuthHub also removes the asset access it granted and revokes its app permission. On other platforms, remove any access granted inside the platform from that platform's settings."
      }
    },
    {
      "@type": "Question",
      "name": "Does revoking in AuthHub remove access inside Google or LinkedIn?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. It removes AuthHub's tokens, so AuthHub can no longer act. Users or partners added inside Google Ads, LinkedIn or other platforms stay until you or the client remove them there. Meta is the exception: AuthHub removes the Meta asset access it recorded granting."
      }
    }
  ]
};

describe("/security trust page", () => {
  it("uses the approved title, meta description and self-referencing canonical", () => {
    expect(metadata.title).toBe("AuthHub Security: Token Vault, Audit Log & Revoking Access");
    expect(metadata.description).toBe(
      "How AuthHub stores client OAuth tokens in Infisical, refreshes them, logs access in an audit log, and revokes it. Plain answer: not SOC 2 certified.",
    );
    expect(metadata.alternates?.canonical).toBe("https://authhub.co/security");
    expect(metadata.openGraph).toMatchObject({ url: "https://authhub.co/security", type: "website" });
  });

  it("ships the approved FAQPage JSON-LD verbatim", () => {
    expect(securityFaqSchema).toEqual(APPROVED_FAQ_SCHEMA);
  });

  it("renders the H1, the updated date, the not-SOC-2 answer and every FAQ", () => {
    const { container } = render(<SecurityPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "How AuthHub keeps client access secure" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/October 9, 2026/)).toBeInTheDocument();
    expect(screen.getByText("AuthHub is not SOC 2 certified.")).toBeInTheDocument();
    for (const faq of securityFaqs) {
      expect(screen.getByRole("heading", { level: 3, name: faq.question })).toBeInTheDocument();
      expect(screen.getByText(faq.answer)).toBeInTheDocument();
    }
    const ldJson = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(ldJson?.innerHTML ?? "{}")).toEqual(APPROVED_FAQ_SCHEMA);
  });

  it("does not claim SOC 2 readiness or compliance", () => {
    const { container } = render(<SecurityPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/SOC ?2 compliant/i);
    // "SOC 2 ready" may only appear inside the explicit denial.
    expect(text.match(/SOC 2 ready/gi) ?? []).toHaveLength(1);
    expect(text).toContain("we don't claim to be \"SOC 2 ready.\"");
    expect(text).not.toMatch(/Agency Access Platform/);
    expect(text).not.toMatch(/hours? (saved|per week)/i);
  });

  it("renders official partner badges with program-standing framing in the platforms section", () => {
    render(<SecurityPage />);
    expect(screen.getByText("Google Official Partner")).toBeInTheDocument();
    expect(screen.getByText("Meta Official Partner")).toBeInTheDocument();
    expect(
      screen.getByText(/official Google and Meta partner/i),
    ).toBeInTheDocument();
  });

  it("is listed in the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/security");
  });
});
