import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { socket } from '@/lib/socket'
import { useAuthStore } from '@/store/auth.store'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import type { UnlockedAchievement } from '@/types/workout'

export const AppShell = () => {
  const { t } = useTranslation()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [liveAchs, setLiveAchs] = useState<UnlockedAchievement[]>([])

  useEffect(() => {
    if (!accessToken) {
      socket.disconnect()
      return
    }

    socket.connect()

    const handleAch = (ach: UnlockedAchievement) => {
      setLiveAchs((prev) => [...prev, ach])
      setTimeout(() => {
        setLiveAchs((prev) => prev.filter((a) => a.key !== ach.key))
      }, 5000)
    }

    socket.on('achievement:unlocked', handleAch)

    return () => {
      socket.off('achievement:unlocked', handleAch)
      socket.disconnect()
    }
  }, [accessToken])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Header />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      <BottomNav />
      <InstallPrompt />

      {liveAchs.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {liveAchs.map((a) => (
            <div
              key={a.key}
              className="flex items-center gap-3 bg-surface border border-primary/30 rounded-xl px-4 py-3 shadow-xl animate-slide-in-right pointer-events-auto"
              style={{ minWidth: '240px' }}
            >
              <span className="text-2xl shrink-0">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  {t('achievementBanner.unlocked')}
                </p>
                <p className="text-sm font-bold text-text-primary truncate">{a.name}</p>
              </div>
              <span className="text-xs font-bold text-primary shrink-0">
                {t('achievementBanner.xp', { xp: a.xpReward })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
