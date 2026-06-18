import { useState, FormEvent } from 'react'
import { Button }  from '@/components/ui/Button'
import { Card }    from '@/components/ui/Card'
import { logHealth } from '../api'
import type { ReadinessScore } from '@/types/engines'

interface Props {
  date:      string
  onSaved:   (readiness: ReadinessScore) => void
}

interface Rating {
  label: string
  emoji: string
}

const RATINGS: Rating[] = [
  { label: '1', emoji: '😫' },
  { label: '2', emoji: '😕' },
  { label: '3', emoji: '😐' },
  { label: '4', emoji: '🙂' },
  { label: '5', emoji: '😄' },
]

function RatingRow({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary w-28 shrink-0">{label}</span>
      <div className="flex gap-2">
        {RATINGS.map((r, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i + 1)}
            className={`w-9 h-9 rounded-lg text-lg transition-all ${
              value === i + 1
                ? 'bg-primary text-background scale-110'
                : 'bg-surface-2 hover:bg-surface text-text-secondary'
            }`}
          >
            {r.emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

export const HealthLogForm = ({ date, onSaved }: Props) => {
  const [sleep,        setSleep]        = useState<string>('7')
  const [sleepQuality, setSleepQuality] = useState(3)
  const [energy,       setEnergy]       = useState(3)
  const [stress,       setStress]       = useState(3)
  const [mood,         setMood]         = useState(3)
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await logHealth({
        date,
        sleepHours:   parseFloat(sleep) || undefined,
        sleepQuality,
        energyLevel:  energy,
        stressLevel:  stress,
        mood,
        notes:        notes || undefined,
      })
      onSaved(result.readiness)
    } catch {
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-1">
        <h3 className="font-semibold text-text-primary">How are you feeling today?</h3>

        {error && (
          <p className="text-xs text-error bg-error/10 border border-error/20 rounded px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary w-28 shrink-0">Sleep (hrs)</span>
          <input
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={sleep}
            onChange={e => setSleep(e.target.value)}
            className="w-20 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
          />
        </div>

        <RatingRow label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
        <RatingRow label="Energy"        value={energy}       onChange={setEnergy} />
        <RatingRow label="Stress"        value={stress}       onChange={setStress} />
        <RatingRow label="Mood"          value={mood}         onChange={setMood} />

        <div className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything notable today..."
            rows={2}
            className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <Button type="submit" isLoading={saving} className="w-full">
          Save Check-in
        </Button>
      </form>
    </Card>
  )
}
