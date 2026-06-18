import { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  sub?: string
  icon: ReactNode
  accent?: boolean
}

export const StatCard = ({ label, value, unit, sub, icon, accent }: StatCardProps) => (
  <Card className={cn('flex flex-col gap-3', accent && 'border-primary/30 shadow-glow')}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
      <span className={cn('text-text-muted', accent && 'text-primary')}>{icon}</span>
    </div>
    <div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        {unit && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  </Card>
)
