import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import ToolsHubPage, { metadata } from "../page";

describe("tools hub", () => {
  it("lists the access-level tool, is public, and is in the sitemap", () => {
    expect(metadata.alternates?.canonical).toBe("https://authhub.co/tools");

    render(<ToolsHubPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /agency access tools/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /access-level/i }),
    ).toHaveAttribute("href", "/tools/access-level");

    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/tools");
    expect(paths).toContain("/tools/access-level");
  });
});
