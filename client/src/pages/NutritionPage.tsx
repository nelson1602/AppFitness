import { useState, useEffect, useCallback } from 'react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ChevronLeft, ChevronRight, Plus, Apple } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { NutritionSkeleton } from '@/features/nutrition/components/NutritionSkeleton'
import { MacroRing } from '@/features/nutrition/components/MacroRing'
import { MacroBar } from '@/features/nutrition/components/MacroBar'
import { MealCard } from '@/features/nutrition/components/MealCard'
import { fetchLog, createMeal, deleteMeal, fetchTargets } from '@/features/nutrition/api'
import { sumMacros } from '@/features/nutrition/macros'
import type { NutritionLog, Meal, MacroTargets } from '@/types/nutrition'

const toDateStr = (d: Date) => d.toISOString().split('T')[0]
const addDays = (dateStr: string, n: number) => {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
const formatDate = (dateStr: string) => {
  const today = toDateStr(new Date())
  const yesterday = addDays(today, -1)
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

const MEAL_PRESETS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

export const NutritionPage = () => {
  usePageTitle('Nutrition')
  const [date, setDate] = useState(toDateStr(new Date()))
  const [log, setLog] = useState<NutritionLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [targets, setTargets] = useState<MacroTargets | null>(null)
  const [mealModalOpen, setMealModalOpen] = useState(false)
  const [customMeal, setCustomMeal] = useState('')
  const [addingMeal, setAddingMeal] = useState(false)
  const [deleteMealId, setDeleteMealId] = useState<string | null>(null)
  const [deletingMeal, setDeletingMeal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLog(await fetchLog(date))
    } catch {
      setLog(null)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchTargets().then(setTargets).catch(() => {})
  }, [])

  const handleAddMeal = async (name: string) => {
    if (!name.trim()) return
    setAddingMeal(true)
    try {
      const meal = await createMeal(date, name.trim())
      setLog((prev) =>
        prev
          ? { ...prev, meals: [...prev.meals, meal] }
          : { id: '', date, notes: null, meals: [meal] },
      )
      setMealModalOpen(false)
      setCustomMeal('')
    } finally {
      setAddingMeal(false)
    }
  }

  const handleDeleteMealConfirm = async () => {
    if (!deleteMealId) return
    setDeletingMeal(true)
    try {
      await deleteMeal(deleteMealId)
      setLog((prev) => prev ? { ...prev, meals: prev.meals.filter((m) => m.id !== deleteMealId) } : prev)
      setDeleteMealId(null)
    } finally {
      setDeletingMeal(false)
    }
  }

  const handleMealUpdate = (updated: Meal) => {
    setLog((prev) =>
      prev ? { ...prev, meals: prev.meals.map((m) => (m.id === updated.id ? updated : m)) } : prev,
    )
  }

  const allItems = log?.meals.flatMap((m) => m.items) ?? []
  const totals = sumMacros(allItems)
  const totalCals = Math.max(totals.protein * 4 + totals.carbs * 4 + totals.fat * 9, 1)
  const today = toDateStr(new Date())

  const macroPct = (value: number, targetG: number | null | undefined, cals: number, calFactor: number) =>
    targetG ? Math.min((value / targetG) * 100, 100) : (value * calFactor / cals) * 100

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-2xl mx-auto">
      {/* Date nav */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Nutrition</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate((d) => addDays(d, -1))}
            aria-label="Previous day"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-text-primary w-28 text-center">
            {formatDate(date)}
          </span>
          <button
            onClick={() => setDate((d) => addDays(d, 1))}
            disabled={date >= today}
            aria-label="Next day"
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted hover:text-text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <NutritionSkeleton />
      ) : (
        <>
          {/* Calorie progress */}
          {targets?.targetCalories && (
            <div className="bg-surface-2 rounded-xl border border-border px-4 py-3">
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-medium text-text-primary">Calories</span>
                <span className="text-xs text-text-muted font-mono">
                  {Math.round(totals.calories)} / {targets.targetCalories} kcal
                </span>
              </div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-primary"
                  style={{ width: `${Math.min((totals.calories / targets.targetCalories) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-1.5">
                {Math.max(targets.targetCalories - Math.round(totals.calories), 0)} kcal remaining
              </p>
            </div>
          )}

          {/* Macro summary */}
          <Card className="flex flex-col sm:flex-row items-center gap-5">
            <MacroRing
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
            />
            <div className="flex flex-col gap-3 flex-1 w-full">
              <MacroBar
                label="Protein"
                value={totals.protein}
                color="#3B82F6"
                target={targets?.targetProteinG ?? undefined}
                pct={macroPct(totals.protein, targets?.targetProteinG, totalCals, 4)}
              />
              <MacroBar
                label="Carbs"
                value={totals.carbs}
                color="#F59E0B"
                target={targets?.targetCarbsG ?? undefined}
                pct={macroPct(totals.carbs, targets?.targetCarbsG, totalCals, 4)}
              />
              <MacroBar
                label="Fat"
                value={totals.fat}
                color="#EF4444"
                target={targets?.targetFatG ?? undefined}
                pct={macroPct(totals.fat, targets?.targetFatG, totalCals, 9)}
              />
              {totals.fiber > 0 && (
                <MacroBar
                  label="Fiber"
                  value={totals.fiber}
                  color="#22C55E"
                  pct={Math.min((totals.fiber / 30) * 100, 100)}
                />
              )}
            </div>
          </Card>

          {/* Meals */}
          {log?.meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onUpdate={handleMealUpdate}
              onDelete={setDeleteMealId}
            />
          ))}

          {(!log || log.meals.length === 0) && (
            <Card className="flex flex-col items-center gap-3 py-14 text-center">
              <Apple className="w-10 h-10 text-text-muted" />
              <p className="text-text-secondary text-sm">No meals logged for {formatDate(date)}</p>
            </Card>
          )}

          <Button variant="secondary" onClick={() => setMealModalOpen(true)}>
            <Plus className="w-4 h-4" /> Add meal
          </Button>
        </>
      )}

      {/* Add meal modal */}
      <Modal open={mealModalOpen} onClose={() => { setMealModalOpen(false); setCustomMeal('') }} title="Add meal">
        <div className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-2">
            {MEAL_PRESETS.map((name) => (
              <button
                key={name}
                onClick={() => handleAddMeal(name)}
                disabled={addingMeal}
                className="h-12 rounded-lg border border-border text-sm font-medium text-text-secondary hover:border-primary hover:text-primary hover:bg-primary-muted transition-colors"
              >
                {name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-muted">or custom</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customMeal}
              onChange={(e) => setCustomMeal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddMeal(customMeal) }}
              placeholder="Meal name..."
              className="flex-1 h-10 rounded bg-surface-2 border border-border px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
            <Button size="md" onClick={() => handleAddMeal(customMeal)} isLoading={addingMeal} disabled={!customMeal.trim()}>
              Add
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteMealId}
        title="Delete meal"
        message="This will remove the meal and all its food entries. This action cannot be undone."
        confirmLabel="Delete"
        loading={deletingMeal}
        onConfirm={handleDeleteMealConfirm}
        onClose={() => setDeleteMealId(null)}
      />
    </div>
  )
}
