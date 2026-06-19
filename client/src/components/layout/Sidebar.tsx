import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, Apple, LogOut, Activity, Bot, User, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/auth.store'
import { useLogout } from '@/lib/useLogout'

export const Sidebar = () => {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  const NAV_ITEMS = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/workouts',  icon: Dumbbell,        label: t('nav.workouts')  },
    { to: '/nutrition', icon: Apple,           label: t('nav.nutrition') },
    { to: '/coach',     icon: Bot,             label: t('nav.coach')     },
    { to: '/progress',  icon: TrendingUp,      label: t('nav.progress')  },
    { to: '/profile',   icon: User,            label: t('nav.profile')   },
  ]

  const handleLogout = () => void logout()

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
        <Activity className="w-6 h-6 text-primary" />
        <span className="text-lg font-bold text-text-primary tracking-tight">Fitness</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-muted text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2',
              )
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <span className="text-sm font-medium text-text-primary truncate">{user?.username}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-text-secondary hover:text-error hover:bg-error/10 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {t('nav.logOut')}
        </button>
      </div>
    </aside>
  )
}
