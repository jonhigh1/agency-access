/**
 * Shown while the server loads the invite payload. Matches the InviteFlowShell
 * frame (plain header + one block) so LCP paint stays stable.
 */
export default function InviteTokenLoading() {
  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6" aria-busy="true" aria-label="Loading request">
        <div className="space-y-3">
          <div className="h-7 w-3/4 animate-pulse bg-muted/50" />
          <div className="h-4 w-full animate-pulse bg-muted/30" />
          <div className="h-4 w-2/3 animate-pulse bg-muted/30" />
        </div>
        <div className="border-2 border-black bg-card p-6 shadow-brutalist">
          <div className="space-y-3">
            <div className="h-4 w-1/2 animate-pulse bg-muted/40" />
            <div className="h-4 w-2/3 animate-pulse bg-muted/30" />
            <div className="h-10 w-full animate-pulse bg-muted/25" />
          </div>
        </div>
      </div>
    </div>
  );
}
