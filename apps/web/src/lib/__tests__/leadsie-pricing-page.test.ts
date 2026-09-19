import { describe, expect, it } from "vitest";
import { getAllComparisonPageSlugs } from "@/lib/comparison-data";
import {
  LEADSIE_PRICING_SLUG,
  leadsiePricingPage,
} from "@/lib/leadsie-pricing-page";
import { generateLeadsiePricingSchema } from "@/lib/schema-generators";

describe("Leadsie pricing SEO page", () => {
  it("registers leadsie-pricing for static generation and sitemap", () => {
    expect(getAllComparisonPageSlugs()).toContain(LEADSIE_PRICING_SLUG);
  });

  it("uses approved SEO metadata and verification date", () => {
    expect(leadsiePricingPage.metaTitle).toBe(
      "Leadsie Pricing (2026): Plans, Credits & Real Cost",
    );
    expect(leadsiePricingPage.metaDescription).toBe(
      "Leadsie plans start at $59/mo for 3 client credits. See credit rules, $50 overages, and busy-month cost vs AuthHub fixed tiers.",
    );
    expect(leadsiePricingPage.title).toBe(
      "Leadsie Pricing (2026): Plans, Credits, and Real Monthly Cost",
    );
    expect(leadsiePricingPage.lastVerified).toBe("2026-09-19");
  });

  it("keeps verified Leadsie and AuthHub list prices in worked examples", () => {
    expect(leadsiePricingPage.workedExamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          newClients: "5",
          leadsieCost: "$109",
          authHubCost: "$29",
        }),
        expect.objectContaining({
          newClients: "50",
          leadsieCost: "$299",
          authHubCost: "$149",
        }),
      ]),
    );
    expect(leadsiePricingPage.workedExamples).toHaveLength(5);
    expect(leadsiePricingPage.plans.find((p) => p.name === "Starter")?.monthly).toBe(
      "$59",
    );
    expect(leadsiePricingPage.plans.find((p) => p.name === "Pro")?.monthly).toBe(
      "$299",
    );
  });

  it("emits Article and FAQ schema for the pricing page", () => {
    const schema = JSON.stringify(generateLeadsiePricingSchema(leadsiePricingPage));
    expect(schema).toMatch(/"@type":"Article"/);
    expect(schema).toMatch(/"@type":"FAQPage"/);
    expect(schema).toMatch(/compare\/leadsie-pricing/);
    expect(leadsiePricingPage.faqs).toHaveLength(5);
  });
});
