import { describe, expect, it } from "vitest";

import { webSiteSchema } from "../root-schemas";

describe("webSiteSchema", () => {
  it("does not advertise a SearchAction for a /search route that does not exist", () => {
    expect(JSON.stringify(webSiteSchema)).not.toContain("SearchAction");
    expect(JSON.stringify(webSiteSchema)).not.toContain("/search");
  });

  it("identifies the AuthHub site on the canonical origin", () => {
    expect(webSiteSchema["@type"]).toBe("WebSite");
    expect(webSiteSchema.url).toBe("https://authhub.co");
  });
});
