import { Activity, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/lib/useLogout'
import { NotificationBell } from '@/components/layout/NotificationBell'

export const Header = () => {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  const handleLogout = () => void logout()

  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-surface border-b border-border">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <span className="font-bold text-text-primary tracking-tight">Fitness</span>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="w-7 h-7 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-xs">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <button
          onClick={handleLogout}
          className="text-text-muted hover:text-text-primary transition-colors"
          aria-label="Log out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
