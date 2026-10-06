import { describe, expect, it } from "vitest";
import { generateMetadata } from "../[slug]/page";

const COMPARE_SLUGS = [
  "leadsie-pricing",
  "leadsie-alternative",
  "agencyaccess-alternative",
  "clientinvite-alternative",
  "leadsie-vs-agencyaccess-vs-authhub",
] as const;

describe("compare page metadata", () => {
  for (const slug of COMPARE_SLUGS) {
    it(`sets self-referencing canonical for /compare/${slug}`, async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ slug }),
      });

      expect(metadata.alternates?.canonical).toBe(
        `https://authhub.co/compare/${slug}`,
      );
    });
  }
});
