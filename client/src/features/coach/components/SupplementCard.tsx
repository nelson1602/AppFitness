import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { fetchSupplements } from '@/features/progress/api'
import type { SupplementReport, SupplementSuggestion } from '@/types/progress'

const CATEGORY_STYLE: Record<SupplementSuggestion['category'], { bg: string; color: string }> = {
  nutrition:   { bg: 'rgba(59,130,246,0.12)',  color: '#60A5FA' },
  performance: { bg: 'rgba(204,255,0,0.12)',   color: '#CCFF00' },
  health:      { bg: 'rgba(34,197,94,0.12)',   color: '#4ADE80' },
  recovery:    { bg: 'rgba(168,85,247,0.12)',  color: '#C084FC' },
}

export const SupplementCard = () => {
  const [data,    setData]    = useState<SupplementReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSupplements()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-text-primary">Supplementation</h2>
        </div>
        <span className="text-xs text-text-muted italic">Suggestions only — not medical advice</span>
      </div>

      <div className="flex flex-col gap-3">
        {data.suggestions.map((s) => {
          const style = CATEGORY_STYLE[s.category]
          return (
            <div key={s.name} className="flex items-start gap-3">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0 mt-0.5 whitespace-nowrap"
                style={{ backgroundColor: style.bg, color: style.color }}
              >
                {s.category}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{s.name}</p>
                <p className="text-xs text-text-secondary mt-0.5">{s.reason}</p>
                <p className="text-xs text-text-muted mt-0.5">⏱ {s.timing}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
