import { Card } from '@/components/ui/Card'
import type { ProgressAnalysis, NotificationPayload } from '@/types/engines'

const PRIORITY_STYLES = {
  high:   'border-error/30 bg-error/5',
  medium: 'border-yellow-400/30 bg-yellow-400/5',
  low:    'border-border bg-surface-2',
}

const TYPE_ICONS: Record<string, string> = {
  insight:    '💡',
  warning:    '⚠️',
  motivation: '💪',
  reminder:   '🔔',
  achievement:'🏆',
}

export const ProgressInsights = ({
  analysis,
  notifications,
}: {
  analysis:      ProgressAnalysis
  notifications: NotificationPayload[]
}) => (
  <div className="flex flex-col gap-4">
    {/* Progress stats row */}
    <Card className="grid grid-cols-3 gap-3">
      <div className="text-center">
        <p className={`text-xl font-bold ${analysis.weeklyWeightChange < 0 ? 'text-green-400' : analysis.weeklyWeightChange > 0 ? 'text-error' : 'text-text-primary'}`}>
          {analysis.weeklyWeightChange > 0 ? '+' : ''}{analysis.weeklyWeightChange.toFixed(2)}
        </p>
        <p className="text-[10px] text-text-muted">kg/week</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-text-primary">
          {Math.round(analysis.adherenceRate * 100)}%
        </p>
        <p className="text-[10px] text-text-muted">adherence</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-text-primary">
          {analysis.weeksSinceLastDeload}
        </p>
        <p className="text-[10px] text-text-muted">wks since deload</p>
      </div>
    </Card>

    {/* Notifications */}
    <div className="flex flex-col gap-2">
      {notifications.map((n, i) => (
        <div
          key={i}
          className={`rounded-xl border p-3 ${PRIORITY_STYLES[n.priority as keyof typeof PRIORITY_STYLES] ?? PRIORITY_STYLES.low}`}
        >
          <div className="flex items-start gap-2">
            <span className="text-base shrink-0">{TYPE_ICONS[n.type] ?? '📌'}</span>
            <div>
              <p className="text-sm font-semibold text-text-primary">{n.title}</p>
              <p className="text-xs text-text-secondary mt-0.5">{n.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)
