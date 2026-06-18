import { Timer, X, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { useRestTimer } from '../hooks/useRestTimer'

type TimerHook = ReturnType<typeof useRestTimer>

interface RestTimerProps {
  timer: TimerHook
}

export const RestTimer = ({ timer }: RestTimerProps) => {
  const { remaining, duration, isRunning, start, stop, setDuration, fmt } = timer

  if (!isRunning) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl">
        <Timer className="w-4 h-4 text-text-muted shrink-0" />
        <span className="text-sm text-text-muted flex-1">Rest timer</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDuration((d) => Math.max(15, d - 15))}
            className="w-7 h-7 rounded border border-border text-text-muted hover:text-text-primary flex items-center justify-center"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm text-text-secondary w-12 text-center">{fmt(duration)}</span>
          <button
            onClick={() => setDuration((d) => Math.min(600, d + 15))}
            className="w-7 h-7 rounded border border-border text-text-muted hover:text-text-primary flex items-center justify-center"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <button
          onClick={() => start()}
          className="h-8 px-3 rounded bg-primary-muted text-primary text-sm font-medium hover:bg-primary hover:text-background transition-colors"
        >
          Start
        </button>
      </div>
    )
  }

  const pct = ((duration - remaining) / duration) * 100

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
      remaining <= 10
        ? 'bg-error/10 border-error/30 text-error'
        : 'bg-primary-muted border-primary/30',
    )}>
      <Timer className={cn('w-4 h-4 shrink-0', remaining > 10 ? 'text-primary' : 'text-error')} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-lg font-mono font-bold', remaining > 10 ? 'text-primary' : 'text-error')}>
            {fmt(remaining)}
          </span>
          <span className="text-xs text-text-muted">/ {fmt(duration)}</span>
        </div>
        <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', remaining > 10 ? 'bg-primary' : 'bg-error')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => start(duration)}
          className="text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          Reset
        </button>
        <button onClick={stop} className="text-text-muted hover:text-text-primary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
