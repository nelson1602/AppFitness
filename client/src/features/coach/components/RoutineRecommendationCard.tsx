import { useState } from 'react'
import { ChevronDown, ChevronUp, Dumbbell, Clock, CheckCircle, Zap } from 'lucide-react'
import axios from 'axios'
import { Button } from '@/components/ui/Button'
import { applyRoutineRecommendation } from '../api'
import type { RoutineRecommendation, WorkoutDay } from '@/types/engines'

interface Props {
  routine: RoutineRecommendation
}

const FOCUS_COLORS: Record<string, string> = {
  full_body: 'text-primary bg-primary/10 border-primary/20',
  push:      'text-blue-400 bg-blue-400/10 border-blue-400/20',
  pull:      'text-purple-400 bg-purple-400/10 border-purple-400/20',
  legs:      'text-orange-400 bg-orange-400/10 border-orange-400/20',
  upper:     'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  lower:     'text-rose-400 bg-rose-400/10 border-rose-400/20',
}

const SPLIT_LABELS: Record<string, string> = {
  full_body:   'Full Body',
  upper_lower: 'Upper / Lower',
  ppl:         'Push / Pull / Legs',
}

function DayCard({ day }: { day: WorkoutDay }) {
  const [open, setOpen] = useState(false)
  const colorClass = FOCUS_COLORS[day.focus] ?? 'text-text-secondary bg-surface-2 border-border'

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-surface-2 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colorClass}`}>
            Day {day.dayIndex}
          </span>
          <span className="text-sm font-medium text-text-primary">{day.label}</span>
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Clock className="w-3 h-3" />
            {day.estimatedDurationMins} min
          </span>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <span className="text-xs">{day.exercises.length} exercises</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border/50">
          {day.exercises.map((ex, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  {ex.isCompound && (
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      COMPOUND
                    </span>
                  )}
                  <span className="text-sm font-medium text-text-primary">{ex.name}</span>
                </div>
                <span className="text-xs text-text-muted">{ex.muscleGroup}</span>
                {ex.notes && (
                  <span className="text-xs text-warning">{ex.notes}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-right shrink-0">
                <div className="text-xs text-text-secondary">
                  <div className="font-semibold text-text-primary">{ex.sets} × {ex.reps}</div>
                  <div>{ex.restSeconds}s rest</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const RoutineRecommendationCard = ({ routine }: Props) => {
  const [applying, setApplying] = useState(false)
  const [applied,  setApplied]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleApply = async () => {
    setApplying(true)
    setError(null)
    try {
      const result = await applyRoutineRecommendation()
      setApplied(true)
      setTimeout(() => setApplied(false), 5000)
      void result
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? 'Failed to apply routine.')
        : 'Failed to apply routine.'
      setError(msg)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="bg-surface-2 rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-text-primary">Workout Routine</h3>
        </div>
        <span className="text-xs font-medium text-text-muted bg-surface px-2 py-1 rounded">
          {SPLIT_LABELS[routine.splitType]}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 px-4 pb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-primary">{routine.days.length}</div>
          <div className="text-xs text-text-muted">days/week</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-text-primary">{routine.totalWeeklySets}</div>
          <div className="text-xs text-text-muted">weekly sets</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-text-primary">
            {routine.days.reduce((a, d) => a + d.exercises.length, 0)}
          </div>
          <div className="text-xs text-text-muted">total exercises</div>
        </div>
      </div>

      {/* Rationale */}
      {routine.rationale.length > 0 && (
        <div className="px-4 pb-3">
          <ul className="flex flex-col gap-1">
            {routine.rationale.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                <Zap className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Day cards */}
      <div className="px-4 pb-3 flex flex-col gap-2">
        {routine.days.map(day => (
          <DayCard key={day.dayIndex} day={day} />
        ))}
      </div>

      {/* Apply button */}
      <div className="px-4 pb-4 flex flex-col gap-2">
        {error && (
          <p className="text-xs text-error bg-error/10 border border-error/20 rounded px-3 py-2">
            {error}
          </p>
        )}
        {applied && (
          <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/20 rounded px-3 py-2">
            <CheckCircle className="w-4 h-4" />
            Routine saved to your workout plan!
          </div>
        )}
        <Button onClick={handleApply} isLoading={applying} className="w-full">
          Apply Routine to My Plan
        </Button>
      </div>
    </div>
  )
}
