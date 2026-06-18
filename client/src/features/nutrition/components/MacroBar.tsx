import { cn } from '@/lib/cn'

interface MacroBarProps {
  label: string
  value: number
  unit?: string
  color: string
  pct: number
  className?: string
}

export const MacroBar = ({ label, value, unit = 'g', color, pct, className }: MacroBarProps) => (
  <div className={cn('flex flex-col gap-1', className)}>
    <div className="flex items-center justify-between text-xs">
      <span className="font-medium" style={{ color }}>{label}</span>
      <span className="text-text-secondary font-mono">
        {value < 10 ? value.toFixed(1) : Math.round(value)}{unit}
      </span>
    </div>
    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  </div>
)
