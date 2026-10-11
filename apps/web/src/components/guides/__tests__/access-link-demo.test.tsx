import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccessLinkDemo } from "../access-link-demo";
import { GuideTemplate } from "../guide-template";
import { getGuideBySlug } from "@/lib/guides";

vi.mock("@/components/marketing/comparison-cta", () => ({
  ComparisonCTA: () => <div>AuthHub call to action</div>,
}));

describe("AccessLinkDemo", () => {
  it("lets a visitor complete the mock without a signup link", async () => {
    const user = userEvent.setup();
    const { container } = render(<AccessLinkDemo />);

    expect(screen.getByRole("heading", { name: /try a mock access link/i })).toBeInTheDocument();
    expect(container.querySelector('a[href*="sign-up"]')).toBeNull();
    expect(container.querySelector('a[href*="signup"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: /authorize meta ads/i }));
    expect(screen.getByText(/meta ads: complete/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /authorize google ads/i }));
    expect(screen.getByText(/google ads: complete/i)).toBeInTheDocument();
    expect(screen.getByText(/all platforms connected/i)).toBeInTheDocument();
  });
});

describe("GuideTemplate demo widget", () => {
  it("embeds the mock access link on the Meta guide", () => {
    const guide = getGuideBySlug("meta-ads-access");
    expect(guide).toBeDefined();
    render(<GuideTemplate guide={guide!} />);
    expect(screen.getByRole("heading", { name: /try a mock access link/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /authorize meta ads/i })).toBeInTheDocument();
  });
});
