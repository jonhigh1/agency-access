"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  ACCESS_LEVEL_TOOL_ATTRIBUTION,
  ACCESS_TOOL_JOBS,
  ACCESS_TOOL_PLATFORMS,
  formatAccessRecommendationCopy,
  recommendAccessLevel,
  type AccessLevelRecommendation,
  type AccessToolJobId,
  type AccessToolPlatformId,
} from "@/lib/access-level-tool";

export function AccessLevelQuiz() {
  const [platform, setPlatform] = useState<AccessToolPlatformId>("meta");
  const [job, setJob] = useState<AccessToolJobId>("run_campaigns");
  const [result, setResult] = useState<AccessLevelRecommendation | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [email, setEmail] = useState("");

  const mailtoHref = useMemo(() => {
    if (!result) {
      return undefined;
    }
    const subject = encodeURIComponent(`Access level: ${result.title}`);
    const body = encodeURIComponent(formatAccessRecommendationCopy(result));
    const to = encodeURIComponent(email.trim());
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }, [email, result]);

  function handleRecommend(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setCopyState("idle");
    setResult(recommendAccessLevel(platform, job));
  }

  async function handleCopy(): Promise<void> {
    if (!result) {
      return;
    }
    try {
      await navigator.clipboard.writeText(formatAccessRecommendationCopy(result));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleRecommend} className="space-y-6">
        <div>
          <label htmlFor="access-tool-platform" className="label-micro text-ink block mb-2">
            Platform
          </label>
          <select
            id="access-tool-platform"
            className="w-full border-2 border-black bg-card px-3 py-3 font-mono text-sm"
            value={platform}
            onChange={(event) => setPlatform(event.target.value as AccessToolPlatformId)}
          >
            {ACCESS_TOOL_PLATFORMS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="access-tool-job" className="label-micro text-ink block mb-2">
            What the agency needs to do
          </label>
          <select
            id="access-tool-job"
            className="w-full border-2 border-black bg-card px-3 py-3 font-mono text-sm"
            value={job}
            onChange={(event) => setJob(event.target.value as AccessToolJobId)}
          >
            {ACCESS_TOOL_JOBS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" variant="brutalist" size="lg">
          Recommend access level
        </Button>
      </form>

      {result ? (
        <section
          aria-live="polite"
          className="border-2 border-black bg-card p-6 shadow-brutalist space-y-4"
        >
          <p className="label-micro text-danger-ink">Recommendation</p>
          <h2 className="font-dela text-2xl md:text-3xl text-ink">{result.title}</h2>
          <p className="font-mono text-sm text-foreground leading-relaxed">{result.rationale}</p>
          <p className="font-mono text-xs text-foreground">{ACCESS_LEVEL_TOOL_ATTRIBUTION}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
              Copy recommendation
            </Button>
          </div>
          <p className="font-mono text-xs text-foreground" aria-live="polite">
            {copyState === "copied"
              ? "Copied with attribution."
              : copyState === "failed"
                ? "Copy failed. Select the text instead."
                : null}
          </p>

          <form
            className="space-y-3 pt-4 border-t-2 border-black"
            onSubmit={(event) => {
              event.preventDefault();
              if (mailtoHref) {
                window.location.href = mailtoHref;
              }
            }}
          >
            <label htmlFor="email-result" className="label-micro text-ink block">
              Email this result
            </label>
            <input
              id="email-result"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border-2 border-black bg-card px-3 py-3 font-mono text-sm"
              placeholder="you@agency.com"
            />
            <Button type="submit" variant="secondary" size="sm">
              Open email draft
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
