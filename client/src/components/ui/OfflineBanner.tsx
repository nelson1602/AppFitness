import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const OfflineBanner = () => {
  const { t } = useTranslation()
  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-fade-in bg-warning/10 border-b border-warning/20 px-4 py-2.5 flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4 text-warning shrink-0" />
      <span className="text-sm font-medium text-warning">
        {t('offline.message')}
      </span>
    </div>
  )
}
