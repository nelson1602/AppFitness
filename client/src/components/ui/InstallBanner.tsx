import { Download, X } from 'lucide-react'

interface Props {
  onInstall: () => void
  onDismiss: () => void
}

export const InstallBanner = ({ onInstall, onDismiss }: Props) => (
  <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-slide-up">
    <div className="bg-surface border border-border rounded-2xl p-4 shadow-xl flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary-muted flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">Install AppFitness</p>
        <p className="text-xs text-text-muted">Add to home screen for the best experience</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onInstall}
          className="text-xs font-bold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-muted"
        >
          Install
        </button>
        <button
          onClick={onDismiss}
          className="p-1.5 text-text-muted hover:text-text-secondary transition-colors rounded-lg hover:bg-surface-2"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
)
