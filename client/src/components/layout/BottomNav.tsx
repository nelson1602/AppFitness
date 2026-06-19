import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Dumbbell, Apple, Bot, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

export const BottomNav = () => {
  const { t } = useTranslation()

  const NAV_ITEMS = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('nav.home')     },
    { to: '/workouts',  icon: Dumbbell,        label: t('nav.workouts') },
    { to: '/nutrition', icon: Apple,           label: t('nav.food')     },
    { to: '/coach',     icon: Bot,             label: t('nav.coach')    },
    { to: '/progress',  icon: TrendingUp,      label: t('nav.progress') },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border z-40 safe-area-inset-bottom">
      <div className="flex">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 flex-1 py-2.5 text-xs font-medium transition-colors',
                isActive ? 'text-primary' : 'text-text-muted hover:text-text-secondary',
              )
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
