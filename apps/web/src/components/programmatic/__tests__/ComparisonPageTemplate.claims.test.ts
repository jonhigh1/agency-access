import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { leadsieAlternativePage } from "@/lib/comparison-data";

const templatePath = path.join(
  process.cwd(),
  "src/components/programmatic/ComparisonPageTemplate.tsx",
);

const MARKETING_PRICING_PATHS = [
  "src/components/marketing/pricing/pricing-toggle.tsx",
  "src/app/(marketing)/pricing/page.tsx",
  "src/components/programmatic/ComparisonPageTemplate.tsx",
  "src/lib/comparison-data.ts",
  "src/lib/programmatic-content-samples.ts",
  "src/components/ui/comparison-table.tsx",
];

const LEADSIE_SURFACE_FORBIDDEN = [
  /flat.rate/i,
  /\$240/,
  /\$49\/mo/,
  /Save 25%/,
  /AgencyAccess charges/i,
  /Flat-Rate Pricing/,
];

function readRelative(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf-8");
}

describe("ComparisonPageTemplate marketing hardening", () => {
  it("does not keep Flat-Rate Pricing in differentiator descriptions", () => {
    const template = readRelative("src/components/programmatic/ComparisonPageTemplate.tsx");

    expect(template).not.toMatch(/"Flat-Rate Pricing":/);
    expect(template).toMatch(/"Predictable tiered pricing \(no credits\)":/);
  });

  it("renders value callout from page data instead of inline AgencyAccess paste", () => {
    const template = readRelative("src/components/programmatic/ComparisonPageTemplate.tsx");

    expect(template).toMatch(/valueCallout\.headline/);
    expect(template).toMatch(/valueCallout\.body/);
    expect(template).not.toMatch(/AgencyAccess charges per seat and limits invites on Starter/);
  });

  it("renders worked pricing scenarios without unverified migration promises", () => {
    const template = readRelative("src/components/programmatic/ComparisonPageTemplate.tsx");

    expect(template).toMatch(/pricingScenarios\.map/);
    expect(template).toMatch(/Leadsie pricing explained/);
    expect(template).toMatch(/Lowest published Leadsie option/);
    expect(template).not.toMatch(/migrationTimeMinutes/);
    expect(template).not.toMatch(/Free migration support/);
  });

  it("keeps AgencyAccess-specific copy inside the AgencyAccess pricing section only", () => {
    const template = fs.readFileSync(templatePath, "utf-8");
    const agencyAccessSection = template.slice(
      template.indexOf("function AgencyAccessPricingSection"),
      template.indexOf("export function ComparisonPageTemplate"),
    );

    expect(agencyAccessSection).toMatch(/AgencyAccess Premium/);
    expect(template).not.toMatch(
      /isLeadsiePage[\s\S]*AgencyAccess charges per seat/,
    );
  });
});

describe("Leadsie and pricing marketing surfaces", () => {
  it("does not expose forbidden copy on Leadsie comparison page data", () => {
    const snapshot = JSON.stringify(leadsieAlternativePage);

    LEADSIE_SURFACE_FORBIDDEN.forEach((pattern) => {
      expect(snapshot, "leadsieAlternativePage JSON").not.toMatch(pattern);
    });

    expect(leadsieAlternativePage.valueCallout).toBeDefined();
    expect(leadsieAlternativePage.valueCallout?.body).not.toMatch(/AgencyAccess/);
  });

  it("does not include stale pricing strings in marketing source files", () => {
    MARKETING_PRICING_PATHS.forEach((relativePath) => {
      const source = readRelative(relativePath);

      expect(source, relativePath).not.toMatch(/Save 25%/);

      if (relativePath.includes("comparison-data") || relativePath.includes("ComparisonPageTemplate")) {
        LEADSIE_SURFACE_FORBIDDEN.forEach((pattern) => {
          expect(source, `${relativePath} forbidden copy`).not.toMatch(pattern);
        });
      }
    });
  });

  it("uses ~17% annual savings copy on the pricing toggle", () => {
    const toggle = readRelative("src/components/marketing/pricing/pricing-toggle.tsx");

    expect(toggle).toMatch(/Save ~17%/);
    expect(toggle).toMatch(/pay for 10, get 12/);
    expect(toggle).not.toMatch(/Save 25%/);
  });

  it("uses monthly schema.org offers at $29/$79/$149 on /pricing", () => {
    const pricingPage = readRelative("src/app/(marketing)/pricing/page.tsx");

    expect(pricingPage).toMatch(/price: '29\.00'/);
    expect(pricingPage).toMatch(/price: '79\.00'/);
    expect(pricingPage).toMatch(/price: '149\.00'/);
    expect(pricingPage).toMatch(/billingIncrement: 'P1M'/);
    expect(pricingPage).toMatch(/pay for 10 get 12/);
  });
});
