import { SUPPORTED_PLATFORM_COUNT } from "@agency-platform/shared";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import {
  agencyAccessAlternativePage,
  leadsieAlternativePage,
} from "@/lib/comparison-data";
import { CLIENT_ACCESS_STATS } from "../client-access-stats";

describe("client-access stats catalog", () => {
  it("pins every number to a lastVerified source", () => {
    expect(CLIENT_ACCESS_STATS.length).toBeGreaterThanOrEqual(4);
    for (const stat of CLIENT_ACCESS_STATS) {
      expect(stat.claim.length).toBeGreaterThan(0);
      expect(stat.value.length).toBeGreaterThan(0);
      expect(stat.sourceHref).toMatch(/^https:\/\//);
      expect(stat.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    const byId = Object.fromEntries(CLIENT_ACCESS_STATS.map((stat) => [stat.id, stat]));
    expect(byId["authhub-starter"]?.value).toContain(
      String(leadsieAlternativePage.ourProduct.pricing.starter.price),
    );
    expect(byId["authhub-starter"]?.lastVerified).toBe(leadsieAlternativePage.lastVerified);
    expect(byId["leadsie-starter"]?.value).toContain(
      String(leadsieAlternativePage.competitor.pricing.starter.price),
    );
    expect(byId["agencyaccess-starter"]?.value).toContain(
      String(agencyAccessAlternativePage.competitor.pricing.starter.price),
    );
    expect(byId["agencyaccess-starter"]?.lastVerified).toBe(
      agencyAccessAlternativePage.lastVerified,
    );
    expect(byId["authhub-platform-count"]?.value).toBe(String(SUPPORTED_PLATFORM_COUNT));
  });

  it("is listed in the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/stats");
  });
});
