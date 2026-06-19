import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export const RoutineCardSkeleton = () => (
  <Card className="flex flex-col gap-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
    <div className="flex gap-2 pt-1 border-t border-border">
      <Skeleton className="h-8 flex-1 rounded-lg" />
      <Skeleton className="h-8 flex-1 rounded-lg" />
    </div>
  </Card>
)
