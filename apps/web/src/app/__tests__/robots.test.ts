import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import { AI_SEARCH_USER_AGENTS } from "@/lib/seo-canonical";

describe("robots.txt", () => {
  it("allows named AI search crawlers", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const allowedAgents = rules.flatMap((rule) => {
      if (!rule || rule.allow === undefined) return [];
      const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent];
      const allows = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
      return allows.includes("/") ? agents : [];
    });

    for (const agent of AI_SEARCH_USER_AGENTS) {
      expect(allowedAgents).toContain(agent);
    }
  });

  it("still disallows authenticated surfaces for the wildcard crawler", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const wildcard = rules.find((rule) => rule.userAgent === "*");
    expect(wildcard?.disallow).toEqual(["/api/", "/admin/", "/agency/"]);
  });
});
