import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { fetchExercises, fetchMuscleGroups } from '@/features/workouts/api'
import type { Exercise } from '@/types/workout'

interface ExercisePickerProps {
  open: boolean
  onClose: () => void
  onSelect: (exercise: Exercise) => void
  exclude?: string[]
}

export const ExercisePicker = ({ open, onClose, onSelect, exclude = [] }: ExercisePickerProps) => {
  const [search, setSearch] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    fetchMuscleGroups().then(setGroups)
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = setTimeout(() => {
      fetchExercises({ search: search || undefined, muscleGroup: muscleGroup || undefined })
        .then(setExercises)
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [search, muscleGroup, open])

  const visible = exercises.filter((e) => !exclude.includes(e.id))

  return (
    <Modal open={open} onClose={onClose} title="Add Exercise">
      <div className="flex flex-col gap-3 p-4">
        <Input
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setMuscleGroup('')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              !muscleGroup
                ? 'border-primary text-primary bg-primary-muted'
                : 'border-border text-text-muted hover:border-text-secondary'
            }`}
          >
            All
          </button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setMuscleGroup(g === muscleGroup ? '' : g)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                g === muscleGroup
                  ? 'border-primary text-primary bg-primary-muted'
                  : 'border-border text-text-muted hover:border-text-secondary'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="w-6 h-6 text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-8">No exercises found</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {visible.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => { onSelect(ex); onClose() }}
                  className="w-full flex items-center justify-between px-2 py-3 hover:bg-surface-2 transition-colors text-left rounded"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">{ex.name}</p>
                    <p className="text-xs text-text-muted">{ex.muscleGroup}</p>
                  </div>
                  <Badge variant="default">{ex.category}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
