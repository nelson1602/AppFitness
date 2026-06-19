import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'

export const NutritionSkeleton = () => (
  <div className="flex flex-col gap-5 max-w-2xl mx-auto">
    {/* Calorie progress */}
    <div className="bg-surface-2 rounded-xl border border-border px-4 py-3 flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-3 w-32" />
    </div>

    {/* Macro ring + bars */}
    <Card className="flex flex-col sm:flex-row items-center gap-5">
      <Skeleton className="w-24 h-24 rounded-full shrink-0" />
      <div className="flex flex-col gap-3 flex-1 w-full">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </Card>

    {/* Meal cards */}
    {[0, 1].map((i) => (
      <Card key={i} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="flex flex-col gap-2 pt-1 border-t border-border">
          {[0, 1].map((j) => (
            <div key={j} className="flex items-center justify-between py-0.5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    ))}
  </div>
)
