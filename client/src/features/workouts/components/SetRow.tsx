import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { WorkoutSet } from '@/types/workout'

interface SetRowProps {
  set: WorkoutSet
  index: number
  onUpdate: (data: { reps?: number; weight?: number; rpe?: number; completed?: boolean }) => Promise<void>
  onDelete: () => Promise<void>
}

export const SetRow = ({ set, index, onUpdate, onDelete }: SetRowProps) => {
  const [reps, setReps] = useState(set.reps?.toString() ?? '')
  const [weight, setWeight] = useState(set.weight?.toString() ?? '')
  const [rpe, setRpe] = useState(set.rpe?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const handleComplete = async () => {
    setSaving(true)
    await onUpdate({
      reps: reps ? Number(reps) : undefined,
      weight: weight ? Number(weight) : undefined,
      rpe: rpe ? Number(rpe) : undefined,
      completed: !set.completed,
    })
    setSaving(false)
  }

  const handleBlur = async (field: 'reps' | 'weight' | 'rpe', value: string) => {
    if (!set.completed) return
    await onUpdate({ [field]: value ? Number(value) : undefined })
  }

  return (
    <div className={cn('flex items-center gap-2 py-1', set.completed && 'opacity-60')}>
      <span className="w-6 text-xs text-text-muted text-center shrink-0">{index}</span>

      <input
        type="number"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={(e) => handleBlur('reps', e.target.value)}
        placeholder="–"
        min={0}
        className="w-14 h-8 rounded bg-surface-2 border border-border text-center text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
      />
      <span className="text-xs text-text-muted">reps</span>

      <input
        type="number"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={(e) => handleBlur('weight', e.target.value)}
        placeholder="–"
        min={0}
        step={0.5}
        className="w-16 h-8 rounded bg-surface-2 border border-border text-center text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
      />
      <span className="text-xs text-text-muted">kg</span>

      <input
        type="number"
        value={rpe}
        onChange={(e) => setRpe(e.target.value)}
        onBlur={(e) => handleBlur('rpe', e.target.value)}
        placeholder="–"
        min={1}
        max={10}
        step={0.5}
        className="w-12 h-8 rounded bg-surface-2 border border-border text-center text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
      />
      <span className="text-xs text-text-muted flex-1">RPE</span>

      <button
        onClick={handleComplete}
        disabled={saving}
        className={cn(
          'w-8 h-8 rounded flex items-center justify-center transition-colors shrink-0',
          set.completed
            ? 'bg-primary text-background'
            : 'border border-border text-text-muted hover:border-primary hover:text-primary',
        )}
      >
        <Check className="w-4 h-4" />
      </button>

      <button
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-error transition-colors shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
