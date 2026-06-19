import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useToastStore } from '@/store/toast.store'
import type { ToastType } from '@/store/toast.store'
import type { ElementType } from 'react'

const CONFIG: Record<ToastType, { icon: ElementType; border: string; iconClass: string }> = {
  success: { icon: CheckCircle,   border: 'border-success/30', iconClass: 'text-success' },
  error:   { icon: AlertCircle,   border: 'border-error/30',   iconClass: 'text-error'   },
  warning: { icon: AlertTriangle, border: 'border-warning/30', iconClass: 'text-warning' },
  info:    { icon: Info,          border: 'border-info/30',    iconClass: 'text-info'    },
}

export const Toaster = () => {
  const { toasts, remove } = useToastStore()

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none w-full max-w-sm"
    >
      {toasts.map((toast) => {
        const { icon: Icon, border, iconClass } = CONFIG[toast.type]
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 bg-surface border ${border} rounded-xl px-4 py-3 shadow-xl animate-slide-in-right pointer-events-auto`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} />
            <span className="flex-1 text-sm text-text-primary leading-snug">{toast.message}</span>
            <button
              onClick={() => remove(toast.id)}
              className="p-0.5 text-text-muted hover:text-text-secondary transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
