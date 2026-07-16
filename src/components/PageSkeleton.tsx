export default function PageSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-8 w-48 rounded-lg bg-border" />
          <div className="h-4 w-64 rounded bg-border/70" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-border shrink-0" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-panel border border-border rounded-lg p-4 space-y-2"
          >
            <div className="h-4 w-24 rounded bg-border/70" />
            <div className="h-8 w-16 rounded bg-border" />
          </div>
        ))}
      </div>
      <div className="bg-panel border border-border rounded-lg p-5 space-y-3">
        <div className="h-5 w-40 rounded bg-border" />
        <div className="h-4 w-full rounded bg-border/70" />
        <div className="h-4 w-5/6 rounded bg-border/70" />
        <div className="h-4 w-4/6 rounded bg-border/70" />
      </div>
    </div>
  );
}
