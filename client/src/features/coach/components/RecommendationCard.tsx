import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { Card }   from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { applyNutritionRecommendation } from '../api'
import type { NutritionAdjustment, TrainingAdjustment } from '@/types/engines'

const Delta = ({ val, unit = '' }: { val: number; unit?: string }) => {
  if (Math.abs(val) < 1) return <span className="text-text-muted">—</span>
  const pos = val > 0
  return (
    <span className={pos ? 'text-green-400' : 'text-error'}>
      {pos ? '+' : ''}{Math.round(val)}{unit}
    </span>
  )
}

export const NutritionRecommendationCard = ({ rec }: { rec: NutritionAdjustment }) => {
  const [open,    setOpen]    = useState(false)
  const [applied, setApplied] = useState(false)
  const [loading, setLoading] = useState(false)

  const apply = async () => {
    setLoading(true)
    try {
      await applyNutritionRecommendation()
      setApplied(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary">🍽️ Nutrition Plan</h3>
        <span className="text-xs text-text-muted">TDEE {rec.tdee} kcal</span>
      </div>

      {/* Macro grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Calories', value: rec.targets.calories, delta: rec.changes.calories, unit: '' },
          { label: 'Protein',  value: rec.targets.proteinG, delta: rec.changes.protein,  unit: 'g' },
          { label: 'Carbs',    value: rec.targets.carbsG,   delta: rec.changes.carbs,    unit: 'g' },
          { label: 'Fat',      value: rec.targets.fatG,     delta: rec.changes.fat,      unit: 'g' },
        ].map(m => (
          <div key={m.label} className="bg-surface-2 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-text-primary">{m.value}</p>
            <p className="text-[10px] text-text-muted mb-0.5">{m.label}</p>
            <Delta val={m.delta} unit={m.unit} />
          </div>
        ))}
      </div>

      {/* Rationale toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        Why? {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <ul className="text-xs text-text-secondary space-y-1 pl-3">
          {rec.rationale.map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
      )}

      {applied ? (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle className="w-4 h-4" /> Targets applied to your profile
        </div>
      ) : (
        <Button size="sm" onClick={apply} isLoading={loading} className="self-start">
          Apply Recommendation
        </Button>
      )}
    </Card>
  )
}

export const TrainingRecommendationCard = ({ rec }: { rec: TrainingAdjustment }) => (
  <Card className="flex flex-col gap-3">
    <h3 className="font-semibold text-text-primary">🏋️ Training Adjustment</h3>

    {rec.isDeloadWeek && (
      <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
        <span className="text-yellow-400 font-semibold text-sm">🔄 DELOAD WEEK</span>
      </div>
    )}

    <div className="grid grid-cols-3 gap-2">
      {[
        { label: 'Frequency',  value: `${rec.recommendedFrequency}d/wk` },
        { label: 'Volume',     value: `×${rec.volumeModifier}` },
        { label: 'Intensity',  value: `×${rec.intensityModifier}` },
      ].map(m => (
        <div key={m.label} className="bg-surface-2 rounded-lg p-2.5 text-center">
          <p className="text-base font-bold text-text-primary">{m.value}</p>
          <p className="text-[10px] text-text-muted">{m.label}</p>
        </div>
      ))}
    </div>

    <ul className="text-xs text-text-secondary space-y-1 pl-1">
      {rec.rationale.map((r, i) => <li key={i}>• {r}</li>)}
    </ul>
  </Card>
)
