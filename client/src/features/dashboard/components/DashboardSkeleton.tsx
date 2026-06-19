import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export const DashboardSkeleton = () => (
  <div className="flex flex-col gap-6">
    {/* Fitness Score */}
    <Card className="flex flex-col gap-3">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-end gap-3">
        <Skeleton className="h-12 w-16" />
        <Skeleton className="h-5 w-24 mb-1.5" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </Card>

    {/* Stat cards */}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-14" />
          <Skeleton className="h-3 w-20" />
        </Card>
      ))}
    </div>

    {/* Chart cards */}
    {[0, 1, 2].map((i) => (
      <Card key={i} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </Card>
    ))}
  </div>
)
