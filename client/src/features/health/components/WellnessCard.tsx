import { useState, useEffect } from 'react'
import { Moon, Zap, Brain, Heart } from 'lucide-react'
import { Card }   from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { fetchTodayHealth, logHealth } from '@/features/health/api'
import type { HealthLog, ReadinessScore } from '@/types/engines'

// ── Score ring ────────────────────────────────────────────────────────────────

const COLORS: Record<ReadinessScore['status'], { hex: string; label: string; cls: string }> = {
  excellent: { hex: '#22C55E', label: 'Excellent', cls: 'bg-green-500/10 text-green-400'  },
  good:      { hex: '#6366F1', label: 'Good',      cls: 'bg-primary/10 text-primary'      },
  fair:      { hex: '#F59E0B', label: 'Fair',      cls: 'bg-yellow-500/10 text-yellow-400'},
  poor:      { hex: '#EF4444', label: 'Low',       cls: 'bg-red-500/10 text-red-400'      },
}

const ScoreRing = ({ score, status }: { score: number; status: ReadinessScore['status'] }) => {
  const r = 32
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#1e2130" strokeWidth="6" />
      <circle
        cx="40" cy="40" r={r} fill="none"
        stroke={COLORS[status].hex}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x="40" y="44" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 17, fontWeight: 700, fill: '#f1f5f9' }}>
        {score}
      </text>
    </svg>
  )
}

// ── Emoji picker (1–5) ────────────────────────────────────────────────────────

const EmojiPicker = ({ value, onChange, options }: {
  value:    number | null
  onChange: (v: number) => void
  options:  string[]
}) => (
  <div className="flex gap-1">
    {options.map((em, i) => (
      <button
        key={i}
        type="button"
        onClick={() => onChange(i + 1)}
        className={`w-8 h-8 rounded-lg text-base transition-all ${
          value === i + 1
            ? 'bg-primary/20 scale-110 shadow-sm'
            : 'hover:bg-surface-2 opacity-50 hover:opacity-100'
        }`}
      >
        {em}
      </button>
    ))}
  </div>
)

// ── Component ─────────────────────────────────────────────────────────────────

export const WellnessCard = () => {
  const [log,      setLog]      = useState<HealthLog | null>(null)
  const [readiness,setReadiness]= useState<ReadinessScore | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)

  const [sleep,  setSleep]  = useState('')
  const [energy, setEnergy] = useState<number | null>(null)
  const [stress, setStress] = useState<number | null>(null)
  const [mood,   setMood]   = useState<number | null>(null)

  const todayStr = () => new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchTodayHealth()
      .then(({ log: l, readiness: r }) => { setLog(l); setReadiness(r) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const openForm = () => {
    setSleep(log?.sleepHours != null ? String(log.sleepHours) : '')
    setEnergy(log?.energyLevel ?? null)
    setStress(log?.stressLevel ?? null)
    setMood(log?.mood ?? null)
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await logHealth({
        date:        todayStr(),
        ...(sleep  ? { sleepHours:  parseFloat(sleep)  } : {}),
        ...(energy ? { energyLevel: energy }             : {}),
        ...(stress ? { stressLevel: stress }             : {}),
        ...(mood   ? { mood }                            : {}),
      })
      setLog(res.log)
      setReadiness(res.readiness)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  const colors = COLORS[readiness?.status ?? 'fair']

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-4">
        {/* Score ring */}
        {readiness && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ScoreRing score={readiness.score} status={readiness.status} />
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.cls}`}>
              {colors.label}
            </span>
          </div>
        )}

        {/* Text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-semibold text-text-primary text-sm">Daily Readiness</p>
          {readiness && (
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              {readiness.recommendation}
            </p>
          )}

          {/* Quick metrics summary */}
          {log && (
            <div className="flex flex-wrap gap-3 mt-2">
              {log.sleepHours  != null && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Moon className="w-3 h-3" /> {log.sleepHours}h
                </span>
              )}
              {log.energyLevel != null && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Zap className="w-3 h-3" /> Energy {log.energyLevel}/5
                </span>
              )}
              {log.stressLevel != null && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Brain className="w-3 h-3" /> Stress {log.stressLevel}/5
                </span>
              )}
              {log.mood != null && (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Heart className="w-3 h-3" /> Mood {log.mood}/5
                </span>
              )}
            </div>
          )}

          {!showForm && (
            <button
              onClick={openForm}
              className="mt-2 text-xs text-primary font-medium hover:text-primary/80 transition-colors"
            >
              {log ? 'Update check-in' : '+ Log how you feel today'}
            </button>
          )}
        </div>
      </div>

      {/* Quick-log form */}
      {showForm && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          {/* Sleep */}
          <div className="flex items-center gap-3">
            <Moon className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-xs text-text-secondary w-16 shrink-0">Sleep hrs</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="16"
              value={sleep}
              onChange={e => setSleep(e.target.value)}
              placeholder="7.5"
              className="w-20 h-8 rounded bg-surface-2 border border-border px-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Energy */}
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-xs text-text-secondary w-16 shrink-0">Energy</span>
            <EmojiPicker
              value={energy}
              onChange={setEnergy}
              options={['😴', '😕', '😐', '😊', '⚡']}
            />
          </div>

          {/* Stress */}
          <div className="flex items-center gap-3">
            <Brain className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-xs text-text-secondary w-16 shrink-0">Stress</span>
            <EmojiPicker
              value={stress}
              onChange={setStress}
              options={['😌', '🙂', '😐', '😤', '🤯']}
            />
          </div>

          {/* Mood */}
          <div className="flex items-center gap-3">
            <Heart className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-xs text-text-secondary w-16 shrink-0">Mood</span>
            <EmojiPicker
              value={mood}
              onChange={setMood}
              options={['😞', '😔', '😐', '😊', '😄']}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 h-9 rounded-lg text-sm text-text-secondary border border-border hover:border-primary/40 hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <Button onClick={handleSave} isLoading={saving} size="sm" className="flex-1">
              Save
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
