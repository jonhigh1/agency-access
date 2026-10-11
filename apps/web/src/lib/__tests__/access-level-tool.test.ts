import { describe, expect, it } from "vitest";
import {
  ACCESS_TOOL_JOBS,
  ACCESS_TOOL_PLATFORMS,
  recommendAccessLevel,
} from "../access-level-tool";

describe("recommendAccessLevel", () => {
  it.each([
    ["meta", "full_control", "admin"],
    ["google", "full_control", "admin"],
    ["linkedin", "run_campaigns", "standard"],
    ["tiktok", "run_campaigns", "standard"],
    ["snapchat", "reporting", "read_only"],
    ["other", "reporting", "read_only"],
    ["meta", "email_updates", "email_only"],
    ["google", "email_updates", "email_only"],
  ] as const)(
    "maps %s + %s to %s",
    (platform, job, level) => {
      const result = recommendAccessLevel(platform, job);
      expect(result.level).toBe(level);
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.rationale).toMatch(/AuthHub/i);
      expect(result.attribution).toContain("authhub.co/tools/access-level");
    },
  );

  it("covers every platform and job combination with a shared AccessLevel", () => {
    for (const platform of ACCESS_TOOL_PLATFORMS) {
      for (const job of ACCESS_TOOL_JOBS) {
        const result = recommendAccessLevel(platform.id, job.id);
        expect(["admin", "standard", "read_only", "email_only"]).toContain(
          result.level,
        );
      }
    }
  });
});
