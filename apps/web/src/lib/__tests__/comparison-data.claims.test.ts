import { describe, expect, it } from "vitest";
import { SUPPORTED_PLATFORM_COUNT } from "@agency-platform/shared";
import {
  agencyAccessAlternativePage,
  leadsieAlternativePage,
} from "@/lib/comparison-data";
import { generateComparisonSchema } from "@/lib/schema-generators";

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

const CONNECTOR_COPY = `${SUPPORTED_PLATFORM_COUNT} platform connectors`;

describe("AgencyAccess comparison page claims", () => {
  it("uses the current AuthHub connector count in platform copy", () => {
    expect(agencyAccessAlternativePage.ourProduct.pricing.starter.features).toContain(
      CONNECTOR_COPY,
    );
    expect(agencyAccessAlternativePage.pricingComparison.authhub.starter.features).toContain(
      CONNECTOR_COPY,
    );
    expect(agencyAccessAlternativePage.ourProduct.platforms).toContain(
      CONNECTOR_COPY,
    );
  });

  it("uses Infisical-backed security instead of SOC 2 or unlimited client claims", () => {
    const authHubCopy = authHubCopySnapshot(agencyAccessAlternativePage);

    expect(authHubCopy).toMatch(/Infisical/i);
    expect(authHubCopy).toMatch(
      /Up to 5 active clients|5 clients\/month|5 \/ 20 \/ 50|Up to 20 active clients|20 clients\/month/,
    );
    expectNoAuthHubForbiddenClaims(authHubCopy, "agencyAccess AuthHub copy");

    expect(agencyAccessAlternativePage.ourProduct.differentiators).toContain(
      "Infisical-backed Token Storage",
    );
    expect(agencyAccessAlternativePage.cta.guarantee).toMatch(/14-day free trial/i);
  });

  it("compares AuthHub Growth at $79 with a stated 20 active client cap", () => {
    expect(agencyAccessAlternativePage.ourProduct.pricing.pro?.price).toBe(79);
    expect(agencyAccessAlternativePage.ourProduct.pricing.pro?.features).toEqual(
      expect.arrayContaining([expect.stringMatching(/Up to 20 active clients|20 clients\/month/)]),
    );
    expect(agencyAccessAlternativePage.pricingComparison.authhub.starter.price).toBe(29);
    expect(agencyAccessAlternativePage.pricingComparison.authhub.pro?.price).toBe(79);
  });
});

const LEADSIE_FORBIDDEN = [
  /flat.rate/i,
  /\$240/,
  /\$49\/mo/,
  /Save 25%/,
  /AgencyAccess charges/i,
  /same-day/i,
  /Mike Torres/,
  /Jennifer Walsh/,
  /API access \(all tiers\)/i,
];

function leadsieRenderedCriticalSnapshot(page: typeof leadsieAlternativePage) {
  return JSON.stringify({
    ...authHubCopySnapshot(page),
    valueCallout: page.valueCallout,
    competitorPricingSubtitle: page.competitorPricingSubtitle,
    authhubSavingsHighlight: page.authhubSavingsHighlight,
    quickComparison: page.quickComparison,
    competitor: {
      name: page.competitor.name,
      pricing: page.competitor.pricing,
    },
    ourProduct: {
      differentiators: page.ourProduct.differentiators,
      pricing: page.ourProduct.pricing,
    },
  });
}

describe("Leadsie comparison page claims", () => {
  it("does not claim unlimited clients or SOC 2 on AuthHub positioning", () => {
    const authHubCopy = authHubCopySnapshot(leadsieAlternativePage);
    expectNoAuthHubForbiddenClaims(authHubCopy, "leadsie AuthHub copy");
    expect(authHubCopy).toMatch(/Up to 5 active clients|5 clients\/month/);
    expect(authHubCopy).toMatch(/Up to 20 active clients|20 clients\/month/);
  });

  it("uses verified Leadsie list pricing and honest AuthHub tier caps", () => {
    const copy = JSON.stringify(leadsieAlternativePage);

    expect(leadsieAlternativePage.competitor.pricing.starting).toBe(59);
    expect(leadsieAlternativePage.competitor.pricing.starter?.price).toBe(59);
    expect(leadsieAlternativePage.competitor.pricing.pro?.price).toBe(129);
    expect(leadsieAlternativePage.competitor.pricing.enterprise?.price).toBe("299");
    expect(leadsieAlternativePage.ourProduct.pricing.enterprise?.price).toBe("149");
    expect(leadsieAlternativePage.pricingComparison.savings.yearly).toBe(600);
    expect(leadsieAlternativePage.pricingComparison.savings.monthly).toBe(50);

    LEADSIE_FORBIDDEN.forEach((pattern) => {
      expect(copy, "leadsie comparison copy").not.toMatch(pattern);
    });

    expect(leadsieAlternativePage.metaDescription).toMatch(
      /credit pricing, \$29\/\$79\/\$149 monthly tiers, migration/,
    );
    expect(leadsieAlternativePage.excerpt).toMatch(/Leadsie still wins for 31\+ integrations/);
    expect(leadsieAlternativePage.painPoints[0]?.solution).toMatch(
      /\$29 \/ \$79 \/ \$149 monthly tiers with 5 \/ 20 \/ 50 client caps/,
    );
    expect(leadsieAlternativePage.quickComparison).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feature: "Platform Count",
          competitor: "31+",
          authhub: `${SUPPORTED_PLATFORM_COUNT}`,
        }),
        expect.objectContaining({
          feature: "Starting Price",
          competitor: "$59/mo",
          authhub: "$29/mo",
        }),
      ]),
    );
    expect(leadsieAlternativePage.cta.guarantee).toMatch(/\$29\/\$79\/\$149 monthly tiers/);
    expect(leadsieAlternativePage.ourProduct.differentiators).toContain(
      "Predictable tiered pricing (no credits)",
    );
    expect(leadsieAlternativePage.valueCallout?.headline).toMatch(
      /How Leadsie credits work/,
    );
    expect(leadsieAlternativePage.valueCallout?.body).toMatch(/manager\/admin access/);
    expect(leadsieAlternativePage.valueCallout?.body).not.toMatch(/AgencyAccess charges/);
    expect(leadsieAlternativePage.competitorPricingSubtitle).toMatch(
      /\$59 · \$129 · \$299/,
    );
    expect(leadsieAlternativePage.authhubSavingsHighlight).toMatch(/\$600\/yr/);
    expect(leadsieAlternativePage.pricingScenarios).toEqual([
      expect.objectContaining({ clients: "5", competitorCost: "$109", authHubCost: "$29" }),
      expect.objectContaining({ clients: "10", competitorCost: "$129", authHubCost: "$79" }),
      expect.objectContaining({ clients: "15", competitorCost: "$179", authHubCost: "$79" }),
      expect.objectContaining({ clients: "20", competitorCost: "$229", authHubCost: "$79" }),
      expect.objectContaining({ clients: "50", competitorCost: "$299", authHubCost: "$149" }),
    ]);
    expect(leadsieAlternativePage.testimonials).toEqual([]);
    expect(leadsieAlternativePage.ourProduct.platforms).toHaveLength(SUPPORTED_PLATFORM_COUNT);
  });

  it("does not include forbidden pricing copy in rendered-critical Leadsie fields", () => {
    const renderedCritical = leadsieRenderedCriticalSnapshot(leadsieAlternativePage);

    LEADSIE_FORBIDDEN.forEach((pattern) => {
      expect(renderedCritical, "leadsie rendered-critical copy").not.toMatch(pattern);
    });

    expect(leadsieAlternativePage.competitor.pricing.starting).not.toBe(49);
    expect(leadsieAlternativePage.ourProduct.pricing.starting).toBe(29);
  });

  it("does not publish an unverified comparison rating", () => {
    const schema = JSON.stringify(generateComparisonSchema(leadsieAlternativePage));

    expect(schema).not.toMatch(/AggregateRating/);
    expect(schema).not.toMatch(/"ratingValue":\s*4\.9/);
  });
});
