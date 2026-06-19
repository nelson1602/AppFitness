import { useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'

const FOCUSABLE = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

interface Props {
  open:          boolean
  title:         string
  message:       string
  confirmLabel?: string
  loading?:      boolean
  onConfirm:     () => void
  onClose:       () => void
}

export const ConfirmModal = ({
  open, title, message, confirmLabel = 'Delete', loading, onConfirm, onClose,
}: Props) => {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (!loading) onClose(); return }
      if (e.key !== 'Tab') return
      const els = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      )
      if (!els.length) return
      if (e.shiftKey) {
        if (document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus() }
      } else {
        if (document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus() }
      }
    }

    document.addEventListener('keydown', handleKey)
    requestAnimationFrame(() => {
      // auto-focus Cancel (first focusable = safer default for destructive dialogs)
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)[0]?.focus()
    })

    return () => {
      document.removeEventListener('keydown', handleKey)
      prev?.focus()
    }
  }, [open, loading, onClose])

  if (!open) return null

  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={loading ? undefined : onClose} />

      <div
        ref={panelRef}
        className="relative w-full max-w-sm bg-surface border border-border rounded-2xl shadow-glow-lg animate-slide-up p-6 flex flex-col gap-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-error" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="font-semibold text-text-primary">{title}</h2>
            <p id={descId} className="text-sm text-text-secondary mt-1 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold bg-error text-white rounded-lg hover:bg-error/90 transition-colors disabled:opacity-60"
          >
            {loading && <Spinner className="w-3.5 h-3.5 text-white" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
