import { useState, useEffect } from 'react'
import { Search, ChevronRight, Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { searchFoods, createFood } from '@/features/nutrition/api'
import type { Food } from '@/types/nutrition'

interface CreateFoodForm {
  name: string
  calories: string
  protein: string
  carbs: string
  fat: string
  fiber: string
}

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
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateFoodForm>({ name: '', calories: '', protein: '', carbs: '', fat: '', fiber: '' })

  useEffect(() => {
    if (!open) { setQuery(''); setSelected(null); setQuantity('100'); setCreating(false) }
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

  const handleCreateFood = async () => {
    if (!form.name.trim() || !form.calories || !form.protein || !form.carbs || !form.fat) return
    setSaving(true)
    try {
      const food = await createFood({
        name:     form.name.trim(),
        calories: Number(form.calories),
        protein:  Number(form.protein),
        carbs:    Number(form.carbs),
        fat:      Number(form.fat),
        fiber:    form.fiber ? Number(form.fiber) : null,
      })
      setSelected(food)
      setCreating(false)
    } finally {
      setSaving(false)
    }
  }

  const startCreate = () => {
    setForm({ name: query, calories: '', protein: '', carbs: '', fat: '', fiber: '' })
    setCreating(true)
  }

  const modalTitle = selected ? 'Set quantity' : creating ? 'Create food' : 'Search food'

  return (
    <Modal open={open} onClose={onClose} title={modalTitle}>
      {creating ? (
        <div className="flex flex-col gap-3 p-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Calories (kcal)" type="number" min={0} value={form.calories} onChange={(e) => setForm(f => ({ ...f, calories: e.target.value }))} />
            <Input label="Protein (g)" type="number" min={0} value={form.protein} onChange={(e) => setForm(f => ({ ...f, protein: e.target.value }))} />
            <Input label="Carbs (g)" type="number" min={0} value={form.carbs} onChange={(e) => setForm(f => ({ ...f, carbs: e.target.value }))} />
            <Input label="Fat (g)" type="number" min={0} value={form.fat} onChange={(e) => setForm(f => ({ ...f, fat: e.target.value }))} />
          </div>
          <Input label="Fiber (g, optional)" type="number" min={0} value={form.fiber} onChange={(e) => setForm(f => ({ ...f, fiber: e.target.value }))} />
          <p className="text-xs text-text-muted -mt-1">All values are per 100 g</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setCreating(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCreateFood} isLoading={saving} className="flex-1"
              disabled={!form.name.trim() || !form.calories || !form.protein || !form.carbs || !form.fat}
            >
              Create
            </Button>
          </div>
        </div>
      ) : !selected ? (
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
              {foods.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-text-muted text-sm">{query ? `No foods found for "${query}"` : 'No foods yet'}</p>
                  <button
                    onClick={startCreate}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    Create{query ? ` "${query}"` : ' new food'}
                  </button>
                </div>
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
