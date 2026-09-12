import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton cards matching the real card layout (UI/UX Notes §3 "Dashboard"). */
export default function DashboardLoading() {
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-36" />
      </div>
      <ul className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading your Watch List">
        {[0, 1].map((i) => (
          <li key={i} className="rounded-card border border-slate-200 bg-white p-5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="mt-2 h-4 w-28" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
