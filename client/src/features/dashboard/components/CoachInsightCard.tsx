import { ChevronRight, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import type { CoachInsight } from '@/types/dashboard'

const GOAL_LABELS: Record<string, string> = {
  lose_fat:            'Lose Fat',
  build_muscle:        'Build Muscle',
  improve_performance: 'Improve Performance',
  maintain:            'Maintain',
}

interface CoachInsightCardProps {
  insight: CoachInsight
}

export const CoachInsightCard = ({ insight }: CoachInsightCardProps) => (
  <Card className="flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-text-primary">AI Coach</h2>
      </div>
      <Link
        to="/coach"
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Full report <ChevronRight className="w-3 h-3" />
      </Link>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div>
        <p className="text-xs text-text-muted mb-1">Goal</p>
        <p className="text-sm font-medium text-text-primary">
          {GOAL_LABELS[insight.goal] ?? insight.goal.replace(/_/g, ' ')}
        </p>
      </div>
      <div>
        <p className="text-xs text-text-muted mb-1">Training</p>
        <p className="text-sm font-medium text-text-primary">{insight.trainingDaysPerWeek}× / week</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-text-muted mb-1">Next eval</p>
        <p className="text-sm font-medium text-text-primary">
          {insight.daysToNextEval <= 0 ? 'Due now' : `In ${insight.daysToNextEval}d`}
        </p>
      </div>
    </div>

    {insight.daysToNextEval <= 3 && (
      <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary font-medium">
        {insight.daysToNextEval <= 0
          ? 'Your 4-week evaluation is due — visit the AI Coach for updated recommendations.'
          : `Your 4-week evaluation is coming up in ${insight.daysToNextEval} days.`}
      </div>
    )}
  </Card>
)
