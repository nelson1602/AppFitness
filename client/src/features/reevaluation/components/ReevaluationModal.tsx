import { useState, useEffect } from 'react'
import { X, CheckCircle, Scale, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import { logBodyWeight } from '@/features/dashboard/api'
import { completeReevaluation } from '@/features/reevaluation/api'
import type { ReevaluationResult } from '@/types/reevaluation'

interface Props {
  open:          boolean
  onClose:       () => void
  onComplete:    (result: ReevaluationResult) => void
  latestWeight?: number | null
}

type Step = 'weight' | 'done'

export const ReevaluationModal = ({ open, onClose, onComplete, latestWeight }: Props) => {
  const [step,      setStep]      = useState<Step>('weight')
  const [weightStr, setWeightStr] = useState(latestWeight ? String(latestWeight) : '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [result,    setResult]    = useState<ReevaluationResult | null>(null)

  useEffect(() => {
    if (open) {
      setStep('weight')
      setWeightStr(latestWeight ? String(latestWeight) : '')
      setError('')
      setResult(null)
    }
  }, [open, latestWeight])

  if (!open) return null

  const today = new Date().toISOString().split('T')[0]

  const handleConfirm = async () => {
    const w = parseFloat(weightStr)
    if (!w || w < 20 || w > 400) {
      setError('Enter a valid weight (20–400 kg).')
      return
    }
    setSaving(true)
    setError('')
    try {
      await logBodyWeight({ weight: w, date: today })
      const res = await completeReevaluation()
      setResult(res)
      setStep('done')
      onComplete(res)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              4-Week Evaluation
            </p>
            <h2 className="text-lg font-bold text-text-primary mt-0.5">
              {step === 'weight' ? 'Confirm your weight' : 'Plan updated!'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-4">
          {step === 'weight' ? (
            <>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Scale className="w-4 h-4 text-primary shrink-0" />
                <span>Your current weight is used to recalculate your calorie and macro targets.</span>
              </div>

              <Input
                label="Body weight (kg)"
                type="number"
                step="0.1"
                min="20"
                max="400"
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                placeholder="e.g. 78.5"
                autoFocus
              />

              {error && (
                <p className="text-xs text-error bg-error/10 border border-error/20 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <Button onClick={handleConfirm} isLoading={saving} className="w-full">
                Calculate & Apply
              </Button>
            </>
          ) : result ? (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                <p className="text-sm text-text-secondary">
                  Your targets are updated. The next evaluation is in 28 days.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">Calories</p>
                  <p className="text-lg font-bold text-primary">{result.calories}</p>
                  <p className="text-xs text-text-muted">kcal/day</p>
                </div>
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">TDEE</p>
                  <p className="text-lg font-bold text-text-primary">{result.tdee}</p>
                  <p className="text-xs text-text-muted">maintenance</p>
                </div>
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">Protein</p>
                  <p className="text-lg font-bold text-text-primary">{result.proteinG}g</p>
                </div>
                <div className="bg-surface-2 rounded-xl p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">Carbs / Fat</p>
                  <p className="text-sm font-bold text-text-primary">{result.carbsG}g / {result.fatG}g</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-primary/8 border border-primary/20 rounded-lg px-3 py-2">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <p className="text-xs text-primary font-medium">
                  Visit the AI Coach for your updated training routine.
                </p>
              </div>

              <Button onClick={onClose} className="w-full">
                Done
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
