import { useState, useEffect } from 'react'
import { Spinner }         from '@/components/ui/Spinner'
import { UserLevelCard }   from '@/features/gamification/components/UserLevelCard'
import { AchievementGrid } from '@/features/gamification/components/AchievementGrid'
import { fetchGamification } from '@/features/gamification/api'
import type { GamificationData } from '@/types/engines'

export const GamificationPage = () => {
  const [data,    setData]    = useState<GamificationData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGamification().then(d => {
      setData(d)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-7 h-7 text-primary" />
      </div>
    )
  }

  if (!data) return null

  const unlocked = data.achievements.filter(a => a.unlocked).length

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Progress & Achievements</h1>
          <p className="text-sm text-text-secondary mt-1">
            {unlocked} / {data.achievements.length} achievements unlocked
          </p>
        </div>
      </div>

      <UserLevelCard stats={data.stats} xpProgress={data.xpProgress} />

      <AchievementGrid achievements={data.achievements} />
    </div>
  )
}
