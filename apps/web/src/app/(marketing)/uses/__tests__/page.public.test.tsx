import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { getAllUseCases, USE_CASE_SLUGS } from "@/lib/use-cases";
import UsesHubPage, { metadata as hubMetadata } from "../page";
import UseCasePage, { generateStaticParams } from "../[slug]/page";
import CompareHubPage from "../../compare/page";
import GuidesHubPage from "../../guides/page";

describe("uses cluster", () => {
  it("lists every vertical on the hub and in the sitemap", () => {
    expect(hubMetadata.alternates?.canonical).toBe("https://authhub.co/uses");
    const { container } = render(<UsesHubPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /who authhub is for/i }),
    ).toBeInTheDocument();
    for (const slug of USE_CASE_SLUGS) {
      expect(container.querySelector(`a[href="/uses/${slug}"]`)).not.toBeNull();
    }
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/uses");
    for (const slug of USE_CASE_SLUGS) {
      expect(paths).toContain(`/uses/${slug}`);
    }
  });

  it("renders each vertical with no orphans and generateStaticParams coverage", async () => {
    const params = await generateStaticParams();
    expect(params.map((item) => item.slug).sort()).toEqual([...USE_CASE_SLUGS].sort());

    for (const useCase of getAllUseCases()) {
      const page = await UseCasePage({ params: Promise.resolve({ slug: useCase.slug }) });
      const { container, unmount } = render(page);
      expect(screen.getByRole("heading", { level: 1, name: useCase.title })).toBeInTheDocument();
      expect(container.querySelector('a[href="/uses"]')).not.toBeNull();
      for (const related of useCase.relatedSlugs) {
        expect(container.querySelector(`a[href="/uses/${related}"]`)).not.toBeNull();
      }
      unmount();
    }
  });

  it("is linked from compare and guides hubs", () => {
    const compare = render(<CompareHubPage />);
    expect(compare.container.querySelector('a[href="/uses"]')).not.toBeNull();
    compare.unmount();

    const guides = render(<GuidesHubPage />);
    expect(guides.container.querySelector('a[href="/uses"]')).not.toBeNull();
    guides.unmount();
  });
});
