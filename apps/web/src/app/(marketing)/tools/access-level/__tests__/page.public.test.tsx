import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AccessLevelToolPage, { metadata } from "../page";
import { ACCESS_LEVEL_TOOL_FAQS } from "@/lib/access-level-tool";

describe("access-level tool", () => {
  it("emits FAQPage schema that matches the visible FAQ list", () => {
    expect(metadata.alternates?.canonical).toBe(
      "https://authhub.co/tools/access-level",
    );

    const { container } = render(<AccessLevelToolPage />);
    const faq = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => JSON.parse(node.innerHTML) as Record<string, unknown>)
      .find((schema) => schema["@type"] === "FAQPage") as {
      mainEntity: Array<{ name: string }>;
    };

    expect(faq.mainEntity.map((item) => item.name)).toEqual(
      ACCESS_LEVEL_TOOL_FAQS.map((item) => item.question),
    );
    expect(screen.getByRole("heading", { name: /frequently asked/i })).toBeInTheDocument();
    expect(
      screen.getByText(/does not look up Meta Business Manager IDs/i),
    ).toBeInTheDocument();
  });

  it("recommends an access level without signup and shows copy-with-attribution after the result", async () => {
    const user = userEvent.setup();
    render(<AccessLevelToolPage />);

    expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/platform/i), "meta");
    await user.selectOptions(screen.getByLabelText(/what the agency needs to do/i), "run_campaigns");
    await user.click(screen.getByRole("button", { name: /recommend access level/i }));

    expect(screen.getByRole("heading", { name: /standard access/i })).toBeInTheDocument();
    expect(screen.getByText(/authhub\.co\/tools\/access-level/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy recommendation/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email this result/i)).toBeInTheDocument();
  });
});
