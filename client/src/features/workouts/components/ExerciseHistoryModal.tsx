import { useState, useEffect } from 'react'
import { TrendingUp, Dumbbell } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Modal }   from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { fetchExerciseHistory } from '../api'
import type { ExerciseSession } from '@/types/workout'

interface Props {
  exerciseId:   string
  exerciseName: string
  muscleGroup:  string
  open:         boolean
  onClose:      () => void
}

export const ExerciseHistoryModal = ({
  exerciseId, exerciseName, muscleGroup, open, onClose,
}: Props) => {
  const [sessions, setSessions] = useState<ExerciseSession[]>([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchExerciseHistory(exerciseId)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, exerciseId])

  // chart data — chronological order (oldest first)
  const chartData = [...sessions].reverse().map(s => ({
    date:   s.date.slice(5),      // "MM-DD"
    weight: s.maxWeightKg || undefined,
    volume: Math.round(s.totalVolumeKg),
  }))

  const best = sessions.length
    ? sessions.reduce((a, b) => b.maxWeightKg > a.maxWeightKg ? b : a)
    : null

  return (
    <Modal open={open} onClose={onClose} title={exerciseName}>
      <div className="flex flex-col gap-4 p-4 pb-6">

        {/* Muscle group badge */}
        <p className="text-xs text-text-muted -mt-2">{muscleGroup}</p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="w-5 h-5 text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Dumbbell className="w-8 h-8 text-text-muted" />
            <p className="text-sm text-text-secondary">No logged sessions yet for this exercise.</p>
          </div>
        ) : (
          <>
            {/* PR summary row */}
            {best && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-2 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-text-muted mb-0.5">Best Weight</p>
                  <p className="text-sm font-bold text-primary">
                    {best.maxWeightKg > 0 ? `${best.maxWeightKg} kg` : '—'}
                  </p>
                </div>
                <div className="bg-surface-2 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-text-muted mb-0.5">Best Reps</p>
                  <p className="text-sm font-bold text-text-primary">{best.bestReps || '—'}</p>
                </div>
                <div className="bg-surface-2 rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-text-muted mb-0.5">Sessions</p>
                  <p className="text-sm font-bold text-text-primary">{sessions.length}</p>
                </div>
              </div>
            )}

            {/* Weight progression chart */}
            {chartData.length >= 2 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs font-medium text-text-secondary">Max Weight Progression</p>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                        width={36}
                        unit=" kg"
                      />
                      <Tooltip
                        contentStyle={{
                          background:   'var(--color-surface)',
                          border:       '1px solid var(--color-border)',
                          borderRadius: 8,
                          fontSize:     11,
                        }}
                        formatter={(v: number) => [`${v} kg`, 'Max Weight']}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#6366F1"
                        strokeWidth={2}
                        dot={{ fill: '#6366F1', r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Session history table */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-text-secondary mb-1">Session History</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[280px]">
                  <thead>
                    <tr className="border-b border-border text-text-muted">
                      <th className="text-left pb-2">Date</th>
                      <th className="text-right pb-2">Max kg</th>
                      <th className="text-right pb-2">Reps</th>
                      <th className="text-right pb-2">Volume</th>
                      <th className="text-right pb-2">Sets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map(s => (
                      <tr key={s.workoutLogId} className="border-b border-border/50 last:border-0">
                        <td className="py-1.5 text-text-muted">
                          {new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                          })}
                        </td>
                        <td className="py-1.5 text-right font-mono text-text-primary">
                          {s.maxWeightKg > 0 ? `${s.maxWeightKg}` : '—'}
                        </td>
                        <td className="py-1.5 text-right font-mono text-text-primary">
                          {s.bestReps || '—'}
                        </td>
                        <td className="py-1.5 text-right font-mono text-text-muted">
                          {s.totalVolumeKg > 0 ? `${Math.round(s.totalVolumeKg)} kg` : '—'}
                        </td>
                        <td className="py-1.5 text-right text-text-muted">{s.setCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
