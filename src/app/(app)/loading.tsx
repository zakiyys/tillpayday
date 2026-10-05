export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading</span>
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-40 w-full rounded-card" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24 rounded-card-sm" />
        <div className="skeleton h-24 rounded-card-sm" />
      </div>
      <div className="skeleton h-64 w-full rounded-card-sm" />
    </div>
  );
}
