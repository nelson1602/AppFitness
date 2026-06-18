import { Card } from '@/components/ui/Card'
import type { ReadinessScore } from '@/types/engines'

const STATUS_COLORS = {
  excellent: 'text-green-400',
  good:      'text-primary',
  fair:      'text-yellow-400',
  poor:      'text-error',
}

const STATUS_TRACK = {
  excellent: '#4ade80',
  good:      '#CCFF00',
  fair:      '#facc15',
  poor:      '#ef4444',
}

const R = 54
const CIRC = 2 * Math.PI * R

interface Props {
  readiness: ReadinessScore
}

export const ReadinessCard = ({ readiness }: Props) => {
  const strokeLen = (readiness.score / 100) * CIRC
  const color     = STATUS_TRACK[readiness.status]

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-text-primary">Daily Readiness</h2>
        <span className={`text-xs font-semibold uppercase tracking-wide ${STATUS_COLORS[readiness.status]}`}>
          {readiness.status}
        </span>
      </div>

      <div className="flex items-center gap-6">
        {/* Circular gauge */}
        <div className="relative shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128">
            {/* Track */}
            <circle cx="64" cy="64" r={R} fill="none" stroke="#2A2A2A" strokeWidth="10" />
            {/* Progress */}
            <circle
              cx="64" cy="64" r={R}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${strokeLen} ${CIRC - strokeLen}`}
              strokeDashoffset={CIRC / 4}
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-text-primary">{readiness.score}</span>
            <span className="text-xs text-text-muted">/100</span>
          </div>
        </div>

        {/* Factors */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {readiness.factors.map(f => (
            <div key={f.name} className="flex flex-col gap-0.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">{f.name}</span>
                <span className="text-text-muted">{f.score}%</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${f.score}%`, backgroundColor: color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-sm text-text-secondary bg-surface-2 rounded-lg px-3 py-2">
        💡 {readiness.recommendation}
      </p>
    </Card>
  )
}
