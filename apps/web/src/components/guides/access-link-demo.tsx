"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type DemoPlatformId = "meta" | "google";
type DemoStatus = "pending" | "complete";

const PLATFORMS: Array<{ id: DemoPlatformId; label: string }> = [
  { id: "meta", label: "Meta Ads" },
  { id: "google", label: "Google Ads" },
];

export function AccessLinkDemo() {
  const [status, setStatus] = useState<Record<DemoPlatformId, DemoStatus>>({
    meta: "pending",
    google: "pending",
  });

  const allComplete = status.meta === "complete" && status.google === "complete";

  function authorize(id: DemoPlatformId): void {
    setStatus((current) => ({ ...current, [id]: "complete" }));
  }

  return (
    <aside
      aria-label="Mock access link demo"
      className="mt-8 border-2 border-black bg-paper p-5 shadow-brutalist"
    >
      <h3 className="font-dela text-xl text-ink mb-2">Try a mock access link</h3>
      <p className="font-mono text-sm text-foreground mb-4">
        Demo only — no account, no OAuth. Authorize each platform to see status
        flip from pending to complete.
      </p>
      <p className="label-micro text-ink mb-4">Acme Coffee · authhub.co/invite/demo</p>
      <ul className="space-y-3">
        {PLATFORMS.map((platform) => {
          const done = status[platform.id] === "complete";
          return (
            <li
              key={platform.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-2 border-black bg-card p-3"
            >
              <p className="font-mono text-sm text-ink">
                {platform.label}: {done ? "complete" : "pending"}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={done}
                onClick={() => authorize(platform.id)}
              >
                {done ? `${platform.label} authorized` : `Authorize ${platform.label}`}
              </Button>
            </li>
          );
        })}
      </ul>
      {allComplete ? (
        <p className="font-mono text-sm text-success-ink mt-4" aria-live="polite">
          All platforms connected
        </p>
      ) : null}
    </aside>
  );
}
