import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export default function AnimeGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <SkeletonTheme baseColor="var(--md-sys-color-surface)" highlightColor="var(--md-sys-color-surface-variant)">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[2/3] w-full !rounded-[var(--md-sys-shape-corner-medium)]" />
            <Skeleton width="80%" />
            <Skeleton width="40%" />
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}
