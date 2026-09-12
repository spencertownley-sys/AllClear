import { Skeleton } from '@/components/ui/skeleton';

export default function AlertsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading alerts">
      <Skeleton className="mb-5 h-8 w-32" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
