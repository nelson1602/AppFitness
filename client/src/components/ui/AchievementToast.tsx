import { useEffect, useState } from 'react'
import type { UnlockedAchievement } from '@/types/workout'

interface Props {
  achievements: UnlockedAchievement[]
}

interface ToastItem extends UnlockedAchievement {
  visible: boolean
}

export const AchievementToast = ({ achievements }: Props) => {
  const [items, setItems] = useState<ToastItem[]>(() =>
    achievements.map((a) => ({ ...a, visible: true })),
  )

  useEffect(() => {
    if (!achievements.length) return
    // Stagger dismiss: first after 4s, each subsequent +1s
    achievements.forEach((a, i) => {
      setTimeout(() => {
        setItems((prev) =>
          prev.map((item) => (item.key === a.key ? { ...item, visible: false } : item)),
        )
      }, 4000 + i * 1000)
    })
  }, []) // run once on mount

  const visible = items.filter((i) => i.visible)
  if (!visible.length) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {visible.map((item) => (
        <div
          key={item.key}
          className="flex items-center gap-3 bg-surface border border-primary/30 rounded-xl px-4 py-3 shadow-xl animate-slide-in-right pointer-events-auto"
          style={{ minWidth: '240px' }}
        >
          <span className="text-2xl shrink-0">{item.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">Achievement Unlocked</p>
            <p className="text-sm font-bold text-text-primary truncate">{item.name}</p>
          </div>
          <span className="text-xs font-bold text-primary shrink-0">+{item.xpReward} XP</span>
        </div>
      ))}
    </div>
  )
}
