import { useState, useEffect } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTranslation } from 'react-i18next'
import { Spinner }         from '@/components/ui/Spinner'
import { UserLevelCard }   from '@/features/gamification/components/UserLevelCard'
import { AchievementGrid } from '@/features/gamification/components/AchievementGrid'
import { fetchGamification } from '@/features/gamification/api'
import type { GamificationData } from '@/types/engines'

export const GamificationPage = () => {
  usePageTitle('Achievements')
  const { t } = useTranslation()
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
          <h1 className="text-2xl font-bold text-text-primary">{t('gamification.heading')}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('gamification.unlocked', { count: unlocked, total: data.achievements.length })}
          </p>
        </div>
      </div>

      <UserLevelCard stats={data.stats} xpProgress={data.xpProgress} />

      <AchievementGrid achievements={data.achievements} />
    </div>
  )
}
