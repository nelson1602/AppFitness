import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  overdue:  boolean
  onStart:  () => void
}

export const ReevaluationBanner = ({ overdue, onStart }: Props) => (
  <div
    className="rounded-xl border px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
    style={{
      backgroundColor: overdue ? 'rgba(239,68,68,0.07)' : 'rgba(204,255,0,0.07)',
      borderColor:     overdue ? 'rgba(239,68,68,0.35)' : 'rgba(204,255,0,0.35)',
    }}
  >
    <div className="flex items-start gap-3 flex-1">
      <RefreshCw
        className="w-5 h-5 shrink-0 mt-0.5"
        style={{ color: overdue ? '#EF4444' : '#CCFF00' }}
      />
      <div>
        <p className="text-sm font-semibold text-text-primary">
          {overdue ? '4-Week Evaluation Overdue' : '4-Week Evaluation Due'}
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          Recalculate your calorie targets, macros, and training plan based on your current weight and progress.
        </p>
      </div>
    </div>
    <Button size="sm" onClick={onStart} className="shrink-0">
      Start Evaluation
    </Button>
  </div>
)
