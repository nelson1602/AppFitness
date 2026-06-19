import { useState, useEffect, useRef } from 'react'
import { Bell, Info, AlertTriangle, Zap, Trophy, Clock } from 'lucide-react'
import { fetchNotifications } from '@/features/progress/api'
import type { Notification } from '@/types/progress'

const TYPE_ICON = {
  achievement: Trophy,
  reminder:    Clock,
  insight:     Info,
  warning:     AlertTriangle,
  motivation:  Zap,
} as const

const PRIORITY_COLOR: Record<Notification['priority'], string> = {
  high:   '#EF4444',
  medium: '#F59E0B',
  low:    'var(--text-muted)',
}

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open,          setOpen]          = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications().then(setNotifications).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const importantCount = notifications.filter(
    (n) => n.priority === 'high' || n.priority === 'medium',
  ).length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {importantCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-black">
            {importantCount > 9 ? '9+' : importantCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <p className="text-sm text-text-muted text-center py-8">No notifications</p>
            ) : (
              notifications.map((n, i) => {
                const Icon = TYPE_ICON[n.type] ?? Bell
                return (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                    <Icon
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: PRIORITY_COLOR[n.priority] }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary">{n.title}</p>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
