import type { Achievement } from '@/types/engines'

const CATEGORY_LABELS: Record<string, string> = {
  milestones:  '🏆 Milestones',
  consistency: '🔥 Consistency',
  strength:    '💪 Strength',
  nutrition:   '🥗 Nutrition',
  recovery:    '🔄 Recovery',
}

interface Props {
  achievements: Achievement[]
}

export const AchievementGrid = ({ achievements }: Props) => {
  const categories = [...new Set(achievements.map(a => a.category))]

  return (
    <div className="flex flex-col gap-6">
      {categories.map(cat => (
        <section key={cat}>
          <h3 className="text-sm font-semibold text-text-secondary mb-3">
            {CATEGORY_LABELS[cat] ?? cat}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {achievements.filter(a => a.category === cat).map(a => (
              <div
                key={a.key}
                className={`rounded-xl border p-3 flex flex-col gap-2 transition-all ${
                  a.unlocked
                    ? 'border-primary/30 bg-primary-muted'
                    : 'border-border bg-surface-2 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{a.icon}</span>
                  {a.unlocked && (
                    <span className="text-[10px] bg-primary text-background font-bold px-1.5 py-0.5 rounded">
                      +{a.xpReward} XP
                    </span>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${a.unlocked ? 'text-text-primary' : 'text-text-muted'}`}>
                    {a.name}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">{a.description}</p>
                </div>
                {a.unlocked && a.unlockedAt && (
                  <p className="text-[10px] text-text-muted">
                    {new Date(a.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
