import { Card } from '@/components/ui/Card'

interface FitnessScoreCardProps {
  score: number
}

export const FitnessScoreCard = ({ score }: FitnessScoreCardProps) => {
  const R = 42
  const C = 2 * Math.PI * R
  const filled = (score / 100) * C
  const color  = score >= 70 ? '#CCFF00' : score >= 40 ? '#F59E0B' : '#EF4444'
  const label  = score >= 70 ? 'Great shape' : score >= 40 ? 'On track' : 'Getting started'

  return (
    <Card className="flex items-center gap-6 p-5">
      <svg width="110" height="110" viewBox="0 0 110 110" className="shrink-0">
        <circle cx="55" cy="55" r={R} fill="none" stroke="#2A2A2A" strokeWidth="8" />
        <circle
          cx="55" cy="55" r={R} fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${C}`}
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="51" textAnchor="middle" dominantBaseline="middle" fontSize="24" fontWeight="700" fill="white">
          {score}
        </text>
        <text x="55" y="68" textAnchor="middle" fontSize="10" fill="#888888">
          / 100
        </text>
      </svg>

      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-text-primary">Fitness Score</h2>
        <p className="text-sm font-semibold mt-0.5" style={{ color }}>{label}</p>
        <p className="text-xs text-text-muted mt-2 leading-relaxed">
          Tracks consistency, training volume, weight logging, and nutrition this week.
        </p>
      </div>
    </Card>
  )
}
