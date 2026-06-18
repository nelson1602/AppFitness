import { Card } from '@/components/ui/Card'
import type { GoalPrediction } from '@/types/engines'

const fmt = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const GoalTimeline = ({ prediction }: { prediction: GoalPrediction }) => {
  if (!prediction.canPredict) {
    const reasons: Record<string, string> = {
      no_target:         'Set a target weight in your profile to see goal predictions.',
      insufficient_data: 'Log body weight for at least 4 weeks to unlock goal prediction.',
      plateau:           'Weight is currently plateaued — adjustments are recommended.',
      already_reached:   'You\'ve already reached your goal! Set a new one.',
    }
    return (
      <Card className="flex flex-col gap-2">
        <h3 className="font-semibold text-text-primary">🎯 Goal Timeline</h3>
        <p className="text-sm text-text-secondary">{reasons[prediction.reason ?? ''] ?? 'Not enough data yet.'}</p>
      </Card>
    )
  }

  const confidence = prediction.confidencePercent ?? 50

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary">🎯 Goal Timeline</h3>
        <span className="text-xs text-text-muted">{confidence}% confidence</span>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <p className="text-3xl font-bold text-primary">{prediction.weeksRemaining}w</p>
          <p className="text-xs text-text-muted">to goal</p>
        </div>
        <div className="flex flex-col gap-0.5 text-xs text-text-secondary pb-1">
          <span>ETA: <strong className="text-text-primary">{fmt(prediction.estimatedDate!)}</strong></span>
          <span>Rate: {prediction.weeklyRateKg! > 0 ? '+' : ''}{prediction.weeklyRateKg} kg/wk</span>
        </div>
      </div>

      {/* Confidence bar */}
      <div>
        <div className="flex justify-between text-[10px] text-text-muted mb-1">
          <span>Worst: {fmt(prediction.worstCase!)}</span>
          <span>Best: {fmt(prediction.bestCase!)}</span>
        </div>
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>
    </Card>
  )
}
