/**
 * Loading skeleton for Client Detail Page
 */

export default function Loading() {
  return (
    <div className="flex-1 bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb skeleton */}
        <div className="h-5 w-20 bg-muted rounded-none animate-pulse mb-6" />

        {/* Header skeleton */}
        <div className="bg-card rounded-none border border-border p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-muted rounded-full animate-pulse" />
              <div>
                <div className="h-6 w-48 bg-muted rounded-none animate-pulse mb-2" />
                <div className="h-4 w-64 bg-muted rounded-none animate-pulse" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-20 bg-muted rounded-none animate-pulse" />
              <div className="h-10 w-24 bg-muted rounded-none animate-pulse" />
            </div>
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card rounded-none border border-border p-6">
              <div className="h-4 w-24 bg-muted rounded-none animate-pulse mb-2" />
              <div className="h-8 w-12 bg-muted rounded-none animate-pulse" />
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="bg-card rounded-none border border-border">
          <div className="border-b border-border px-6 py-4">
            <div className="flex gap-4">
              <div className="h-6 w-20 bg-muted rounded-none animate-pulse" />
              <div className="h-6 w-16 bg-muted rounded-none animate-pulse" />
            </div>
          </div>
          <div className="p-6">
            {[1, 2].map((i) => (
              <div key={i} className="border-b border-border pb-4 mb-4 last:mb-0 last:pb-0 last:border-0">
                <div className="h-5 w-48 bg-muted rounded-none animate-pulse mb-2" />
                <div className="h-4 w-32 bg-muted rounded-none animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
