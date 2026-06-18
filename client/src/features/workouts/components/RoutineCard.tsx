import { useNavigate } from 'react-router-dom'
import { Play, Pencil, Trash2, Dumbbell } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Routine } from '@/types/workout'

interface RoutineCardProps {
  routine: Routine
  onDelete: (id: string) => void
  onStart: (routine: Routine) => void
}

export const RoutineCard = ({ routine, onDelete, onStart }: RoutineCardProps) => {
  const navigate = useNavigate()
  const exerciseNames = routine.exercises.map((re) => re.exercise.name)
  const preview = exerciseNames.slice(0, 3).join(' · ') + (exerciseNames.length > 3 ? ` +${exerciseNames.length - 3}` : '')

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-text-primary truncate">{routine.name}</h3>
          {routine.description && (
            <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{routine.description}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => navigate(`/workouts/${routine.id}/edit`)}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(routine.id)}
            className="p-1.5 text-text-muted hover:text-error transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default">
          <Dumbbell className="w-3 h-3 mr-1" />
          {routine.exercises.length} exercises
        </Badge>
      </div>

      {exerciseNames.length > 0 && (
        <p className="text-xs text-text-muted truncate">{preview}</p>
      )}

      <Button
        variant="primary"
        size="sm"
        className="w-full mt-1"
        onClick={() => onStart(routine)}
      >
        <Play className="w-4 h-4" />
        Start workout
      </Button>
    </Card>
  )
}
