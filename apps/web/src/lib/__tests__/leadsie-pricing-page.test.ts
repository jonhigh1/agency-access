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
      "Leadsie Pricing 2026: $59–$299/mo + What Overages Really Cost",
    );
    expect(leadsiePricingPage.metaDescription).toBe(
      "Leadsie costs $59, $129 or $299/mo. We priced busy months at 5, 10, 20 and 50 new clients — including $50 overage packs — then matched AuthHub active-client tiers. Checked Oct 2026.",
    );
    expect(leadsiePricingPage.title).toBe(
      "Leadsie Pricing 2026: Plans, Credits, and What a Busy Month Really Costs",
    );
    expect(leadsiePricingPage.lastVerified).toBe("2026-10-05");
    expect(leadsiePricingPage.lastVerifiedDisplay).toMatch(/October 5, 2026/);
  });

  it("does not claim 10–20 new clients stay on AuthHub Growth $79", () => {
    const serialized = JSON.stringify(leadsiePricingPage);
    expect(serialized).not.toMatch(/10–20 new clients stay on Growth/i);
    expect(serialized).not.toMatch(/10-20 new clients stay on Growth/i);
    const busyMonthFaq = leadsiePricingPage.faqs.find((f) =>
      f.question.includes("busy month"),
    );
    expect(busyMonthFaq?.answer).toMatch(/does not auto-fit Growth/i);
  });

  it("keeps verified Leadsie and AuthHub list prices in worked examples", () => {
    expect(leadsiePricingPage.workedExamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "A",
          leadsieCost: "$109",
          authHubCost: "$29",
        }),
        expect.objectContaining({
          label: "E",
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
    expect(schema).toMatch(/2026-10-05/);
    expect(leadsiePricingPage.faqs).toHaveLength(6);
  });
});
