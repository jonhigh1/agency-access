import { describe, expect, it } from "vitest";
import {
  agencyAccessAlternativePage,
  FORBIDDEN_AGENCYACCESS_COMPARE_TESTIMONIAL_NAMES,
  leadsieAlternativePage,
} from "@/lib/comparison-data";
import { generateComparisonSchema } from "@/lib/schema-generators";

const AUTHHUB_POSITIVE_FORBIDDEN = [
  /SOC\s*2 certified/i,
  /Type\s*II/i,
  /bank-grade/i,
  /enterprise-grade security at a startup/i,
];

const AGENCYACCESS_STALE_PHRASES = [
  "Zapier-Only Automation",
  "no public API for custom development",
  "Unlimited invites",
  "Premium for unlimited invites",
  "Keep Existing Connections",
  "Migration takes about 5 minutes",
];

function expectNoPositiveForbiddenClaims(text: string, context: string) {
  AUTHHUB_POSITIVE_FORBIDDEN.forEach((pattern) => {
    expect(text, context).not.toMatch(pattern);
  });
}

function expectNoAgencyAccessStalePhrases(text: string, context: string) {
  AGENCYACCESS_STALE_PHRASES.forEach((phrase) => {
    expect(text, context).not.toContain(phrase);
  });
}

function authHubCopySnapshot(page: typeof agencyAccessAlternativePage) {
  return JSON.stringify({
    metaDescription: page.metaDescription,
    metaTitle: page.metaTitle,
    title: page.title,
    excerpt: page.excerpt,
    ourProduct: page.ourProduct,
    competitor: page.competitor,
    painPoints: page.painPoints,
    quickComparison: page.quickComparison,
    detailedComparison: page.detailedComparison,
    recommendations: page.recommendations,
    testimonials: page.testimonials,
    pricingComparison: page.pricingComparison,
    valueCallout: page.valueCallout,
    aeoSections: page.aeoSections,
    supplementalProse: page.supplementalProse,
    faqs: page.faqs,
    cta: page.cta,
    migrationSteps: page.migrationSteps,
  });
}

const AGENCYACCESS_COMPARE_CONNECTOR_COPY = "15+ core connectors";

describe("AgencyAccess comparison page claims", () => {
  it("uses honest 15+ connector breadth (not full enum count)", () => {
    expect(agencyAccessAlternativePage.ourProduct.pricing.starter.features).toContain(
      AGENCYACCESS_COMPARE_CONNECTOR_COPY,
    );
    expect(agencyAccessAlternativePage.pricingComparison.authhub.starter.features).toContain(
      AGENCYACCESS_COMPARE_CONNECTOR_COPY,
    );
    expect(agencyAccessAlternativePage.ourProduct.platforms).toContain(
      AGENCYACCESS_COMPARE_CONNECTOR_COPY,
    );
  });

  it("uses Infisical-backed security instead of SOC 2 or unlimited client claims", () => {
    const authHubCopy = authHubCopySnapshot(agencyAccessAlternativePage);

    expect(authHubCopy).toMatch(/Infisical/i);
    expect(authHubCopy).toMatch(
      /Up to 5 active clients|5 clients\/month|5 \/ 20 \/ 50|Up to 20 active clients|20 active clients/,
    );
    expectNoPositiveForbiddenClaims(authHubCopy, "agencyAccess AuthHub copy");
    expectNoAgencyAccessStalePhrases(authHubCopy, "agencyAccess stale phrases");
    expect(authHubCopy).toMatch(/no SOC 2 claim|does not claim SOC 2|Not claimed on this page/i);
    expect(authHubCopy).toMatch(/Zapier-only is outdated|both have APIs/i);

    expect(agencyAccessAlternativePage.ourProduct.differentiators).toContain(
      "Infisical-backed Token Storage",
    );
    expect(agencyAccessAlternativePage.cta.guarantee).toMatch(/\$29\/\$79\/\$149/);
    expect(agencyAccessAlternativePage.testimonials).toEqual([]);
  });

  it("excludes forbidden testimonial names (Growth + draft list)", () => {
    const pageCopy = JSON.stringify(agencyAccessAlternativePage);

    expect(FORBIDDEN_AGENCYACCESS_COMPARE_TESTIMONIAL_NAMES).toEqual([
      "Mike Torres",
      "Jennifer Walsh",
      "David Park",
      "Sarah Mitchell",
    ]);

    FORBIDDEN_AGENCYACCESS_COMPARE_TESTIMONIAL_NAMES.forEach((name) => {
      expect(pageCopy, `forbidden testimonial: ${name}`).not.toContain(name);
    });
  });

  it("states both vendors have APIs and AgencyAccess Premium is 15 clients/month", () => {
    const copy = authHubCopySnapshot(agencyAccessAlternativePage);

    expect(copy).toMatch(/Public API|X-Auth|both have APIs/i);
    expect(agencyAccessAlternativePage.competitor.pricing.pro?.features).toEqual(
      expect.arrayContaining([expect.stringMatching(/15 clients\/month/)]),
    );
    expect(agencyAccessAlternativePage.competitor.pricing.pro?.price).toBe(99);
    expect(agencyAccessAlternativePage.competitor.pricing.starting).toBe(44);
    expect(agencyAccessAlternativePage.competitor.pricing.starter?.price).toBe(44);
    expect(agencyAccessAlternativePage.competitor.pricing.enterprise?.price).toBe("199");

    expect(agencyAccessAlternativePage.ourProduct.pricing.starter.price).toBe(29);
    expect(agencyAccessAlternativePage.ourProduct.pricing.pro?.price).toBe(79);
    expect(agencyAccessAlternativePage.ourProduct.pricing.enterprise?.price).toBe("149");
    expect(agencyAccessAlternativePage.pricingComparison.authhub.pro?.price).toBe(79);

    expect(agencyAccessAlternativePage.quickComparison).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feature: "Public API",
          competitor: "Yes (X-Auth)",
        }),
      ]),
    );
  });

  it("uses the 2026 measured-refresh SEO title and meta description", () => {
    expect(agencyAccessAlternativePage.metaTitle).toBe(
      "AuthHub vs AgencyAccess (2026): Token Refresh, Pricing, and Who Should Switch",
    );
    expect(agencyAccessAlternativePage.title).toBe(agencyAccessAlternativePage.metaTitle);
    expect(agencyAccessAlternativePage.metaDescription).toBe(
      "Compare AuthHub and AgencyAccess on token auto-refresh, Infisical audit logs, API/webhooks, intake, and plan caps—plus honest reasons to stay on AgencyAccess.",
    );
    expect(agencyAccessAlternativePage.lastVerified).toBe("2026-09-24");
    expect(agencyAccessAlternativePage.pricingScenariosNote).toMatch(/Premium\+/);
    expect(agencyAccessAlternativePage.faqs[0]?.answer).toMatch(/Premium\+/);
  });

  it("describes dual-run migration with re-authorize (no quick migration CS)", () => {
    const migrationCopy = JSON.stringify(agencyAccessAlternativePage.migrationSteps);
    expect(migrationCopy).toMatch(/Dual-run|dual-run/i);
    expect(migrationCopy).toMatch(/Re-authorize|re-authorize/i);
    expect(migrationCopy).not.toMatch(/Keep Existing Connections/);
    expect(agencyAccessAlternativePage.migrationTimeMinutes).toBeUndefined();
  });
});

const LEADSIE_FORBIDDEN = [
  /flat.rate/i,
  /\$240/,
  /\$600/,
  /\$49\/mo/,
  /Save 25%/,
  /AgencyAccess charges/i,
  /same-day/i,
  /Mike Torres/,
  /Jennifer Walsh/,
  /API access \(all tiers\)/i,
  /all Leadsie platforms plus/i,
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
    expectNoPositiveForbiddenClaims(authHubCopy, "leadsie AuthHub copy");
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
    expect(leadsieAlternativePage.pricingComparison.savings.yearly).toBe(360);
    expect(leadsieAlternativePage.pricingComparison.savings.monthly).toBe(30);

    LEADSIE_FORBIDDEN.forEach((pattern) => {
      expect(copy, "leadsie comparison copy").not.toMatch(pattern);
    });

    expect(leadsieAlternativePage.metaTitle).toBe(
      "Leadsie Alternative for Agencies: AuthHub vs Leadsie (Pricing & Switch)",
    );
    expect(leadsieAlternativePage.metaDescription).toBe(
      "Comparing Leadsie alternatives? See AuthHub's tiered plans ($29/$79/$149), intake + OAuth in one link, token health + Infisical audit — plus Leadsie credit & overage math at 5–50 clients.",
    );
    expect(leadsieAlternativePage.openGraphDescription).toMatch(/15\+ core connectors vs 31\+/);
    expect(leadsieAlternativePage.excerpt).toMatch(/Leadsie still wins for 31\+ integrations/);
    expect(leadsieAlternativePage.painPoints[0]?.solution).toMatch(
      /\$29 \/ \$79 \/ \$149 monthly tiers with 5 \/ 20 \/ 50 client caps/,
    );
    expect(leadsieAlternativePage.quickComparison).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feature: "Platform Count",
          competitor: "31+",
          authhub: "15+",
        }),
        expect.objectContaining({
          feature: "Starting Price",
          competitor: "$59/mo",
          authhub: "$29/mo",
        }),
      ]),
    );
    expect(leadsieAlternativePage.cta.guarantee).toMatch(/\$29\/\$79\/\$149 tiers/);
    expect(leadsieAlternativePage.ourProduct.differentiators).toContain(
      "Predictable tiered pricing (no credits)",
    );
    expect(leadsieAlternativePage.valueCallout?.headline).toMatch(
      /How Leadsie credits work/,
    );
    expect(leadsieAlternativePage.valueCallout?.body).toMatch(/manager or admin access/);
    expect(leadsieAlternativePage.valueCallout?.body).not.toMatch(/AgencyAccess charges/);
    expect(leadsieAlternativePage.competitorPricingSubtitle).toMatch(
      /\$59 · \$129 · \$299/,
    );
    expect(leadsieAlternativePage.authhubSavingsHighlight).toMatch(/\$360\/yr/);
    expect(leadsieAlternativePage.authhubSavingsHighlight).not.toMatch(/\$600/);
    expect(leadsieAlternativePage.lastVerified).toBe("2026-09-23");
    expect(leadsieAlternativePage.pricingScenarios).toEqual([
      expect.objectContaining({ clients: "5", competitorCost: "$109", authHubCost: "$29" }),
      expect.objectContaining({ clients: "10", competitorCost: "$129", authHubCost: "$79" }),
      expect.objectContaining({ clients: "15", competitorCost: "$179", authHubCost: "$79" }),
      expect.objectContaining({ clients: "20", competitorCost: "$229", authHubCost: "$79" }),
      expect.objectContaining({ clients: "50", competitorCost: "$299", authHubCost: "$149" }),
    ]);
    expect(leadsieAlternativePage.testimonials).toEqual([]);
    expect(leadsieAlternativePage.ourProduct.platforms).toHaveLength(20);
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
