import { Skeleton } from '@/components/ui/card';

export default function Loading() {
  return (
    <div className="container-page max-w-2xl space-y-4 py-10" aria-busy="true">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
