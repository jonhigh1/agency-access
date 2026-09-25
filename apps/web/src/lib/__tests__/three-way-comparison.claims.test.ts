import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_THREE_WAY_COMPARE_TESTIMONIAL_NAMES,
  THREE_WAY_COMPARE_SLUG,
  getThreeWayComparisonPage,
} from "@/lib/three-way-comparison-data";

const STALE_PHRASES = [
  "Zapier-only",
  "no public API",
  "SOC2-ready",
  "Unlimited invites",
  "Mike Torres",
  "Jennifer Walsh",
  "David Park",
  "Sarah Mitchell",
  "15-minute migration",
  "free CS will migrate",
];

function pageCopySnapshot() {
  const page = getThreeWayComparisonPage();
  return JSON.stringify(page);
}

describe("Three-way comparison page (Leadsie vs AgencyAccess vs AuthHub)", () => {
  it("uses the required slug and SEO title/meta", () => {
    const page = getThreeWayComparisonPage();
    expect(THREE_WAY_COMPARE_SLUG).toBe("leadsie-vs-agencyaccess-vs-authhub");
    expect(page.slug).toBe(THREE_WAY_COMPARE_SLUG);
    expect(page.title).toBe(
      "Leadsie vs AgencyAccess vs AuthHub (2026): Credits, Caps, and Token Refresh",
    );
    expect(page.metaTitle).toBe(page.title);
    expect(page.metaDescription).toBe(
      'Compare Leadsie, AgencyAccess, and AuthHub on credits vs flat caps, intake, platforms, API, and automatic token refresh—with honest "pick X if…" gates.',
    );
  });

  it("enforces pricing and cap claim rules in structured data", () => {
    const copy = pageCopySnapshot();
    expect(copy).toMatch(/\$29 \/ \$79 \/ \$149/);
    expect(copy).toMatch(/5 \/ 20 \/ 50 active clients/);
    expect(copy).toMatch(/\$59 \/ \$129 \/ \$299/);
    expect(copy).toMatch(/3 \/ 10 \/ 50/);
    expect(copy).toMatch(/\$44 \/ \$99 \/ \$199/);
    expect(copy).toMatch(/5 \/ 15 \/ 50 clients\/month/);
    expect(copy).toMatch(/15 clients\/month/);
    expect(copy).not.toMatch(/Premium for unlimited/i);
    expect(copy).toMatch(/Public API|X-Auth/);
    expect(copy).toMatch(/15\+/);
    expect(copy).not.toMatch(/all Leadsie platforms/i);
  });

  it("excludes stale claims and forbidden testimonial names", () => {
    const copy = pageCopySnapshot();
    STALE_PHRASES.forEach((phrase) => {
      expect(copy, `stale: ${phrase}`).not.toContain(phrase);
    });
    FORBIDDEN_THREE_WAY_COMPARE_TESTIMONIAL_NAMES.forEach((name) => {
      expect(copy, `forbidden testimonial: ${name}`).not.toContain(name);
    });
  });

  it("states intake parity and no SOC 2 claim", () => {
    const copy = pageCopySnapshot();
    expect(copy).toMatch(/Intake parity|both include intake|not an AuthHub-only advantage/i);
    expect(copy).toMatch(/No SOC 2|Not claimed on this page|no SOC 2 claim/i);
    expect(copy).toMatch(/Infisical/i);
  });

  it("describes dual-run migration without quick migration promises", () => {
    const copy = pageCopySnapshot();
    expect(copy).toMatch(/Dual-run|dual-run/i);
    expect(copy).toMatch(/Re-authorize|re-authorize/i);
    expect(copy).not.toMatch(/15-minute/i);
    expect(copy).not.toMatch(/free CS will migrate/i);
  });
});
