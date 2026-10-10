import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LLMS_PATH = path.join(process.cwd(), "public", "llms.txt");

describe("llms.txt", () => {
  it("exists at the site root and lists money pages", () => {
    expect(existsSync(LLMS_PATH)).toBe(true);
    const body = readFileSync(LLMS_PATH, "utf-8");
    expect(body).toContain("https://authhub.co/pricing");
    expect(body).toContain("https://authhub.co/guides");
    expect(body).toContain("https://authhub.co/guides/meta-ads-access");
    expect(body).toContain("https://authhub.co/guides/google-ads-access");
    expect(body).toContain("https://authhub.co/guides/ga4-access");
    expect(body).toContain("https://authhub.co/guides/linkedin-ads-access");
    expect(body).toContain("https://authhub.co/guides/tiktok-ads-access");
    expect(body).toContain("https://authhub.co/guides/facebook-business-manager-access");
    expect(body).toContain("https://authhub.co/compare/clientinvite-alternative");
    expect(body).toContain("https://authhub.co/compare/leadsie-alternative");
    expect(body).toContain("https://docs.authhub.co");
  });
});
