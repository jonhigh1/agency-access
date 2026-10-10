import { describe, expect, it } from "vitest";
import { getAllUseCases, getUseCaseBySlug, USE_CASE_SLUGS } from "../use-cases";

describe("use-case catalog", () => {
  it("publishes PPC, SEO, freelance, and in-house only", () => {
    expect([...USE_CASE_SLUGS]).toEqual([
      "ppc-agencies",
      "seo-agencies",
      "freelancers",
      "in-house-teams",
    ]);
    expect(getAllUseCases()).toHaveLength(4);
    expect(getUseCaseBySlug("dental")).toBeUndefined();
    expect(getUseCaseBySlug("ecommerce")).toBeUndefined();
  });

  it("cross-links every vertical to the other three", () => {
    const slugs = new Set(USE_CASE_SLUGS);
    for (const useCase of getAllUseCases()) {
      expect(useCase.relatedSlugs).not.toContain(useCase.slug);
      expect(useCase.relatedSlugs).toHaveLength(3);
      for (const related of useCase.relatedSlugs) {
        expect(slugs.has(related)).toBe(true);
      }
    }
  });
});
