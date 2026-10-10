import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { getAllComparisonPageSlugs } from "@/lib/comparison-data";

import CompareHubPage, { metadata } from "../page";

describe("compare hub", () => {
  it("self-canonicalizes to /compare", () => {
    expect(metadata.alternates?.canonical).toBe("https://authhub.co/compare");
  });

  it("links every live comparison slug", () => {
    const { container } = render(<CompareHubPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /compare client access tools/i }),
    ).toBeInTheDocument();

    for (const slug of getAllComparisonPageSlugs()) {
      expect(container.querySelector(`a[href="/compare/${slug}"]`)).not.toBeNull();
    }
  });

  it("is listed in the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/compare");
  });
});
