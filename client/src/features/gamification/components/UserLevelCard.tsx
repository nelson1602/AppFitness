import { Card }   from '@/components/ui/Card'
import { Flame }  from 'lucide-react'
import type { UserStats, XPProgress } from '@/types/engines'

interface Props {
  stats:      UserStats
  xpProgress: XPProgress
}

export const UserLevelCard = ({ stats, xpProgress }: Props) => (
  <Card className="flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Level {xpProgress.level}</p>
        <h2 className="text-2xl font-bold text-primary">{xpProgress.levelName}</h2>
      </div>

      <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-1.5">
        <Flame className="w-4 h-4 text-orange-400" />
        <span className="text-base font-bold text-orange-400">{stats.currentStreak}</span>
        <span className="text-xs text-text-muted">day streak</span>
      </div>
    </div>

    {/* XP bar */}
    <div>
      <div className="flex justify-between text-xs text-text-muted mb-1.5">
        <span>{xpProgress.current.toLocaleString()} XP</span>
        <span>{xpProgress.required.toLocaleString()} XP to level {xpProgress.level + 1}</span>
      </div>
      <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-1000"
          style={{ width: `${xpProgress.pct}%` }}
        />
      </div>
    </div>

    {/* Stats grid */}
    <div className="grid grid-cols-4 gap-2 pt-1">
      {[
        { label: 'Workouts',  value: stats.workoutsLogged },
        { label: 'Total XP',  value: stats.totalXp.toLocaleString() },
        { label: 'Best Streak', value: stats.longestStreak },
        { label: 'PRs',       value: stats.prsSet },
      ].map(s => (
        <div key={s.label} className="bg-surface-2 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-text-primary">{s.value}</p>
          <p className="text-[10px] text-text-muted">{s.label}</p>
        </div>
      ))}
    </div>
  </Card>
)
