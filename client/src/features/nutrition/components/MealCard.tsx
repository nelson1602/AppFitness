import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { FoodSearchModal } from './FoodSearchModal'
import { sumMacros, calcItem, fmt } from '@/features/nutrition/macros'
import { addMealItem, deleteMealItem, updateMealItem } from '@/features/nutrition/api'
import type { Meal, MealItem } from '@/types/nutrition'

interface MealCardProps {
  meal: Meal
  onUpdate: (meal: Meal) => void
  onDelete: (mealId: string) => void
}

export const MealCard = ({ meal, onUpdate, onDelete }: MealCardProps) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<{ id: string; value: string } | null>(null)

  const totals = sumMacros(meal.items)

  const handleAddFood = async (foodId: string, quantity: number) => {
    const item = await addMealItem(meal.id, { foodId, quantity })
    onUpdate({ ...meal, items: [...meal.items, item] })
  }

  const handleDeleteItem = async (itemId: string) => {
    await deleteMealItem(itemId)
    onUpdate({ ...meal, items: meal.items.filter((i) => i.id !== itemId) })
  }

  const handleUpdateQty = async (item: MealItem) => {
    if (!editingItem || editingItem.id !== item.id) return
    const qty = Number(editingItem.value)
    if (!qty || qty <= 0) { setEditingItem(null); return }
    const updated = await updateMealItem(item.id, qty)
    onUpdate({ ...meal, items: meal.items.map((i) => (i.id === item.id ? updated : i)) })
    setEditingItem(null)
  }

  return (
    <Card className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-text-primary">{meal.name}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {Math.round(totals.calories)} kcal · P {fmt(totals.protein)}g · C {fmt(totals.carbs)}g · F {fmt(totals.fat)}g
          </p>
        </div>
        <button
          onClick={() => onDelete(meal.id)}
          className="text-text-muted hover:text-error transition-colors p-1"
          aria-label="Delete meal"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Items */}
      {meal.items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {meal.items.map((item) => {
            const m = calcItem(item)
            const isEditing = editingItem?.id === item.id
            return (
              <li key={item.id} className="flex items-center gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{item.food.name}</p>
                  <p className="text-xs text-text-muted">
                    {Math.round(m.calories)} kcal · P {fmt(m.protein)}g · C {fmt(m.carbs)}g · F {fmt(m.fat)}g
                  </p>
                </div>

                {/* Inline quantity edit */}
                {isEditing ? (
                  <input
                    type="number"
                    value={editingItem.value}
                    autoFocus
                    min={1}
                    onChange={(e) => setEditingItem({ id: item.id, value: e.target.value })}
                    onBlur={() => handleUpdateQty(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateQty(item) }}
                    className="w-16 h-7 rounded bg-surface border border-primary text-center text-xs text-text-primary focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingItem({ id: item.id, value: item.quantity.toString() })}
                    className="text-xs text-text-muted hover:text-text-secondary border border-border rounded px-2 py-1 shrink-0"
                  >
                    {item.quantity}g
                  </button>
                )}

                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-text-muted hover:text-error transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Add food */}
      <button
        onClick={() => setPickerOpen(true)}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors py-1"
      >
        <Plus className="w-4 h-4" /> Add food
      </button>

      <FoodSearchModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAddFood}
      />
    </Card>
  )
}
