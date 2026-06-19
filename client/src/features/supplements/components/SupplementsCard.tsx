import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, FlaskConical } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { fetchSupplements } from '@/features/supplements/api'
import type { SupplementSuggestion, SupplementsResult } from '@/types/supplement'

// ── Priority badge ────────────────────────────────────────────────────────────

const PRIORITY_STYLE = {
  high:   'bg-green-500/10 text-green-400 border-green-500/20',
  medium: 'bg-primary/10 text-primary border-primary/20',
  low:    'bg-surface-2 text-text-muted border-border',
}

const CATEGORY_STYLE = {
  nutrition:   'bg-yellow-500/10 text-yellow-400',
  performance: 'bg-purple-500/10 text-purple-400',
  recovery:    'bg-blue-500/10 text-blue-400',
  health:      'bg-teal-500/10 text-teal-400',
}

// ── Single row ────────────────────────────────────────────────────────────────

const SuggestionRow = ({ s }: { s: SupplementSuggestion }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors"
      >
        <span className="text-xl shrink-0">{s.emoji}</span>

        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-text-primary truncate">{s.name}</p>
          <p className="text-xs text-text-muted mt-0.5 truncate">{s.timing}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden sm:inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_STYLE[s.priority]}`}>
            {s.priority}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_STYLE[s.category]}`}>
            {s.category}
          </span>
          {open
            ? <ChevronUp className="w-4 h-4 text-text-muted" />
            : <ChevronDown className="w-4 h-4 text-text-muted" />
          }
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-2 border-t border-border bg-surface-2/30">
          <p className="text-xs text-text-secondary pt-3 leading-relaxed">{s.reason}</p>
          <div className="flex gap-4 mt-1">
            <div>
              <p className="text-xs text-text-muted">Dosage</p>
              <p className="text-xs font-medium text-text-primary">{s.dosage}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">When</p>
              <p className="text-xs font-medium text-text-primary">{s.timing}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

export const SupplementsCard = () => {
  const [data,    setData]    = useState<SupplementsResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSupplements()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) return null
  if (!data.eligible) {
    if (!data.daysUntilEligible) return null
    return (
      <Card className="flex items-center gap-3">
        <FlaskConical className="w-5 h-5 text-text-muted shrink-0" />
        <div>
          <p className="text-sm font-semibold text-text-primary">Supplement Recommendations</p>
          <p className="text-xs text-text-muted mt-0.5">
            Available in {data.daysUntilEligible} more {data.daysUntilEligible === 1 ? 'day' : 'days'} after your first completed workout week.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-primary shrink-0" />
        <div>
          <h2 className="font-semibold text-text-primary text-sm">Supplement Suggestions</h2>
          <p className="text-xs text-text-muted">
            Based on your {data.goal.replace(/_/g, ' ')} goal · tap each to expand
          </p>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {data.suggestions.map((s) => (
          <SuggestionRow key={s.key} s={s} />
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-text-muted border-t border-border pt-3 leading-relaxed">
        ⚠️ These are general suggestions based on your fitness data, not medical advice. Consult a healthcare professional before starting any supplement regimen.
      </p>
    </Card>
  )
}
