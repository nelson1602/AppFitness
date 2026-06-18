import { useState, useEffect } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { searchFoods } from '@/features/nutrition/api'
import type { Food } from '@/types/nutrition'

interface FoodSearchModalProps {
  open: boolean
  onClose: () => void
  onAdd: (foodId: string, quantity: number) => Promise<void>
}

export const FoodSearchModal = ({ open, onClose, onAdd }: FoodSearchModalProps) => {
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [selected, setSelected] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!open) { setQuery(''); setSelected(null); setQuantity('100') }
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const t = setTimeout(() => {
      searchFoods(query || undefined)
        .then(setFoods)
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query, open])

  const macrosAt = (food: Food, qty: number) => {
    const f = qty / 100
    return {
      cal: Math.round(food.calories * f),
      p: (food.protein * f).toFixed(1),
      c: (food.carbs * f).toFixed(1),
      fat: (food.fat * f).toFixed(1),
    }
  }

  const handleAdd = async () => {
    if (!selected || !quantity || Number(quantity) <= 0) return
    setAdding(true)
    try {
      await onAdd(selected.id, Number(quantity))
      onClose()
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={selected ? 'Set quantity' : 'Search food'}>
      {!selected ? (
        <div className="flex flex-col gap-3 p-4">
          <Input
            placeholder="Search food..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            autoFocus
          />

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-5 h-5 text-primary" />
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {foods.map((food) => (
                <li key={food.id}>
                  <button
                    onClick={() => setSelected(food)}
                    className="w-full flex items-center justify-between px-2 py-3 hover:bg-surface-2 transition-colors text-left rounded gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{food.name}</p>
                      {food.brand && <p className="text-xs text-text-muted">{food.brand}</p>}
                      <p className="text-xs text-text-secondary mt-0.5">
                        {food.calories} kcal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
                        <span className="text-text-muted"> / 100g</span>
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                  </button>
                </li>
              ))}
              {!loading && foods.length === 0 && (
                <p className="text-center text-text-muted text-sm py-8">No foods found</p>
              )}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          <div>
            <p className="font-semibold text-text-primary">{selected.name}</p>
            {selected.brand && <p className="text-xs text-text-muted">{selected.brand}</p>}
          </div>

          <Input
            label="Quantity (grams)"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min={1}
            step={1}
            autoFocus
          />

          {Number(quantity) > 0 && (() => {
            const m = macrosAt(selected, Number(quantity))
            return (
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Calories', value: m.cal, unit: 'kcal' },
                  { label: 'Protein',  value: m.p,   unit: 'g' },
                  { label: 'Carbs',    value: m.c,   unit: 'g' },
                  { label: 'Fat',      value: m.fat, unit: 'g' },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="bg-surface-2 rounded-lg px-2 py-2">
                    <p className="text-xs text-text-muted">{label}</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5">{value}<span className="text-xs text-text-muted">{unit}</span></p>
                  </div>
                ))}
              </div>
            )
          })()}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setSelected(null)} className="flex-1">
              Back
            </Button>
            <Button onClick={handleAdd} isLoading={adding} className="flex-1">
              Add food
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
