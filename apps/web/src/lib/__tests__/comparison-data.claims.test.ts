import { describe, expect, it } from "vitest";
import {
  agencyAccessAlternativePage,
  leadsieAlternativePage,
} from "@/lib/comparison-data";

const AUTHHUB_FORBIDDEN = [
  /SOC\s*2/i,
  /Type\s*II/i,
  /unlimited clients/i,
  /Unlimited clients/i,
];

function expectNoAuthHubForbiddenClaims(text: string, context: string) {
  AUTHHUB_FORBIDDEN.forEach((pattern) => {
    expect(text, context).not.toMatch(pattern);
  });
}

function authHubCopySnapshot(page: typeof agencyAccessAlternativePage) {
  return JSON.stringify({
    metaDescription: page.metaDescription,
    excerpt: page.excerpt,
    ourProduct: page.ourProduct,
    painPoints: page.painPoints,
    detailedComparison: page.detailedComparison,
    recommendations: page.recommendations,
    testimonials: page.testimonials,
    pricingComparison: page.pricingComparison,
    faqs: page.faqs,
    cta: page.cta,
  });
}

describe("AgencyAccess comparison page claims", () => {
  it("uses the current AuthHub connector count in platform copy", () => {
    expect(agencyAccessAlternativePage.ourProduct.pricing.starter.features).toContain(
      "19 platform connectors",
    );
    expect(agencyAccessAlternativePage.pricingComparison.authhub.starter.features).toContain(
      "19 platform connectors",
    );
    expect(agencyAccessAlternativePage.ourProduct.platforms).toContain(
      "19 platform connectors",
    );
  });

  it("uses Infisical-backed security instead of SOC 2 or unlimited client claims", () => {
    const authHubCopy = authHubCopySnapshot(agencyAccessAlternativePage);

    expect(authHubCopy).toMatch(/Infisical/i);
    expect(authHubCopy).toMatch(/5 clients\/month|5 \/ 20 \/ 50|20 clients\/month/);
    expectNoAuthHubForbiddenClaims(authHubCopy, "agencyAccess AuthHub copy");

    expect(agencyAccessAlternativePage.ourProduct.differentiators).toContain(
      "Infisical-backed Token Storage",
    );
    expect(agencyAccessAlternativePage.cta.guarantee).toMatch(/14-day free trial/i);
  });

  it("compares AuthHub Growth at $79 with 20 clients/month", () => {
    expect(agencyAccessAlternativePage.ourProduct.pricing.pro?.price).toBe(79);
    expect(agencyAccessAlternativePage.ourProduct.pricing.pro?.features).toContain(
      "20 clients/month",
    );
    expect(agencyAccessAlternativePage.pricingComparison.authhub.starter.price).toBe(79);
  });
});

describe("Leadsie comparison page claims", () => {
  it("does not claim unlimited clients or SOC 2 on AuthHub positioning", () => {
    const authHubCopy = authHubCopySnapshot(leadsieAlternativePage);
    expectNoAuthHubForbiddenClaims(authHubCopy, "leadsie AuthHub copy");
    expect(authHubCopy).toMatch(/5 clients\/month/);
    expect(authHubCopy).toMatch(/20 clients\/month/);
  });
});
