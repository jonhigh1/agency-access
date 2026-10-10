import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CLIENT_ACCESS_STATS } from "@/lib/client-access-stats";
import StatsPage, { metadata } from "../page";

describe("stats page", () => {
  it("renders every catalog fact with its source", () => {
    expect(metadata.alternates?.canonical).toBe("https://authhub.co/stats");
    const { container } = render(<StatsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /client access stats/i }),
    ).toBeInTheDocument();
    for (const stat of CLIENT_ACCESS_STATS) {
      expect(screen.getByText(stat.claim)).toBeInTheDocument();
      expect(screen.getByText(stat.value)).toBeInTheDocument();
      expect(container.querySelector(`a[href="${stat.sourceHref}"]`)).not.toBeNull();
      expect(screen.getAllByText(new RegExp(stat.lastVerified)).length).toBeGreaterThan(0);
    }
  });
});
