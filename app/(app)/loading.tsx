export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="h-24 animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
    </div>
  );
}
